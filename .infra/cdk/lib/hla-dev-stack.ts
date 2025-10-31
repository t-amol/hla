import {
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
  CfnOutput,
  aws_s3 as s3,
  aws_ecr as ecr,
  aws_kms as kms,
  aws_ssm as ssm,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class HlaDevStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // -------------------- Shared artifacts (DEV-friendly) --------------------
    const key = new kms.Key(this, "ArtifactsKey", {
      alias: "alias/hla-artifacts-dev",
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const artifacts = new s3.Bucket(this, "ArtifactsBucket", {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: key,
      versioned: false,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: Duration.days(7) }],
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ECR repos for CI
    const backendRepo = new ecr.Repository(this, "BackendRepo", {
      repositoryName: "hla-backend",
      imageScanOnPush: true,
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const frontendRepo = new ecr.Repository(this, "FrontendRepo", {
      repositoryName: "hla-frontend",
      imageScanOnPush: true,
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new ssm.StringParameter(this, "BackendRepoUri", {
      parameterName: "/hla/dev/backendRepoUri",
      stringValue: backendRepo.repositoryUri,
    });

    new ssm.StringParameter(this, "FrontendRepoUri", {
      parameterName: "/hla/dev/frontendRepoUri",
      stringValue: frontendRepo.repositoryUri,
    });

    // -------------------- Backend: ECS Fargate + public ALB -------------------
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0, // save cost in DEV
      subnetConfiguration: [{ name: "public", subnetType: ec2.SubnetType.PUBLIC }],
    });

    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const execRole = new iam.Role(this, "ExecRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    backendRepo.grantPull(execRole);

    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: execRole,
      taskRole: taskRole,
    });

    const container = taskDef.addContainer("BackendContainer", {
      containerName: "backend",
      image: ecs.ContainerImage.fromEcrRepository(backendRepo, "latest"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "backend" }),
      environment: {
        DJANGO_SETTINGS_MODULE: "config.settings",
        PYTHONUNBUFFERED: "1",
      },
    });
    container.addPortMappings({ containerPort: 8000 });

    const svcSG = new ec2.SecurityGroup(this, "ServiceSG", {
      vpc,
      allowAllOutbound: true,
    });

    const albSG = new ec2.SecurityGroup(this, "AlbSG", {
      vpc,
      allowAllOutbound: true,
    });
    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP");

    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: true,
      securityGroups: [svcSG],
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSG,
    });

    const listener = alb.addListener("Http", { port: 80, open: true });

    const tg = new elbv2.ApplicationTargetGroup(this, "Tg", {
      vpc,
      targetType: elbv2.TargetType.IP,
      port: 8000,
      healthCheck: { path: "/", healthyHttpCodes: "200-499" },
    });

    listener.addTargetGroups("AttachTg", { targetGroups: [tg] });
    service.attachToApplicationTargetGroup(tg);

    new ssm.StringParameter(this, "BackendAlbDnsParam", {
      parameterName: "/hla/dev/backendAlbDns",
      stringValue: alb.loadBalancerDnsName,
    });

    new CfnOutput(this, "BackendAlbDns", {
      value: alb.loadBalancerDnsName,
      exportName: "HLA-BackendAlbDns",
    });

    // -------------------- Frontend: S3 + CloudFront (OAI) --------------------
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ✅ Use Origin Access Identity (broadly supported across CDK v2)
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI", {
      comment: "HLA dev OAI",
    });

    // Allow CloudFront OAI to read content
    siteBucket.grantRead(oai);

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
    });

    new ssm.StringParameter(this, "FrontendBucketName", {
      parameterName: "/hla/dev/frontendBucketName",
      stringValue: siteBucket.bucketName,
    });

    new ssm.StringParameter(this, "FrontendDistributionId", {
      parameterName: "/hla/dev/frontendDistributionId",
      stringValue: distribution.distributionId,
    });

    new CfnOutput(this, "FrontendDomain", {
      value: distribution.distributionDomainName,
      exportName: "HLA-FrontendDomain",
    });
  }
}
