import {
  Stack,
  StackProps,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Aws,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as kms from "aws-cdk-lib/aws-kms";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as cr from "aws-cdk-lib/custom-resources";

export class HlaDevStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // --- KMS for artifacts ---
    const artifactsKey = new kms.Key(this, "ArtifactsKey", {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // --- S3 buckets (auto-deletable in DEV) ---
    const artifactsBucket = new s3.Bucket(this, "ArtifactsBucket", {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: artifactsKey,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: Duration.days(7) }],
    });

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // --- CloudFront over S3 for frontend ---
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI");
    siteBucket.grantRead(oai);

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
    });

    // Optional: deploy a placeholder index.html so URL serves something
    new s3deploy.BucketDeployment(this, "DeployPlaceholder", {
      sources: [s3deploy.Source.data("index.html", "<h1>HLA Frontend</h1>")],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // --- ECR repositories (destroyable + empty on delete for DEV) ---
    const backendRepo = new ecr.Repository(this, "BackendRepo", {
      repositoryName: "hla-backend",
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    const frontendRepo = new ecr.Repository(this, "FrontendRepo", {
      repositoryName: "hla-frontend",
      imageScanOnPush: true,
      removalPolicy: RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // *** WRITE the repo URIs to SSM (do NOT read from SSM) ***
    new ssm.StringParameter(this, "BackendRepoUriParam", {
      parameterName: "/hla/dev/backendRepoUri",
      stringValue: backendRepo.repositoryUri,
    });

    new ssm.StringParameter(this, "FrontendRepoUriParam", {
      parameterName: "/hla/dev/frontendRepoUri",
      stringValue: frontendRepo.repositoryUri,
    });

    // --- ECS Fargate + ALB for backend (simple, internet-facing) ---
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0, // keep DEV cheap
      subnetConfiguration: [{ name: "public", subnetType: ec2.SubnetType.PUBLIC }],
    });

    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const execRole = new iam.Role(this, "ExecRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    // Basic permissions for pulling from ECR
    backendRepo.grantPull(execRole);

    const logGroup = new logs.LogGroup(this, "BackendLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
      taskRole,
      executionRole: execRole,
    });

    const container = taskDef.addContainer("BackendContainer", {
      image: ecs.ContainerImage.fromRegistry(
        // deploys even before you push an image; switch to fromEcrRepository after image exists
        "public.ecr.aws/docker/library/nginx:alpine"
      ),
      // Once you have image pushed to ECR, replace with:
      // image: ecs.ContainerImage.fromEcrRepository(backendRepo, "latest"),
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: "backend",
      }),
      environment: {
        // your app env vars
        DJANGO_DEBUG: "1",
      },
    });
    container.addPortMappings({ containerPort: 8000 });

    const albSG = new ec2.SecurityGroup(this, "AlbSG", { vpc });
    const svcSG = new ec2.SecurityGroup(this, "ServiceSG", { vpc });
    svcSG.addIngressRule(albSG, ec2.Port.tcp(8000), "alb to backend");

    const lb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSG,
    });

    const listener = lb.addListener("Http", { port: 80, open: true });

    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: true,
      securityGroups: [svcSG],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const tg = new elbv2.ApplicationTargetGroup(this, "Tg", {
      vpc,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 8000,
      targets: [service],
      healthCheck: {
        path: "/",
        healthyHttpCodes: "200-399",
      },
      targetType: elbv2.TargetType.IP,
    });

    listener.addTargetGroups("Targets", { targetGroups: [tg] });

    // Expose values cleanly
    new ssm.StringParameter(this, "BackendAlbDnsParam", {
      parameterName: "/hla/dev/backendAlbDns",
      stringValue: lb.loadBalancerDnsName,
    });

    new ssm.StringParameter(this, "FrontendDistributionIdParam", {
      parameterName: "/hla/dev/frontendDistributionId",
      stringValue: distribution.distributionId,
    });

    // Helpful outputs
    new CfnOutput(this, "BackendAlbUrl", {
      value: `http://${lb.loadBalancerDnsName}`,
    });
    new CfnOutput(this, "FrontendCdnUrl", {
      value: `https://${distribution.domainName}`,
    });
    new CfnOutput(this, "BackendRepoUri", { value: backendRepo.repositoryUri });
    new CfnOutput(this, "FrontendRepoUri", { value: frontendRepo.repositoryUri });
    new CfnOutput(this, "Region", { value: Aws.REGION });
    new CfnOutput(this, "Account", { value: Aws.ACCOUNT_ID });
  }
}
