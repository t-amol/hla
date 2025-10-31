// .infra/cdk/lib/hla-dev-stack.ts
import {
  Stack, StackProps, Duration, RemovalPolicy, CfnOutput, Tags,
  aws_s3 as s3,
  aws_kms as kms,
  aws_ecr as ecr,
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

    // ----------------------
    // Tags
    // ----------------------
    Tags.of(this).add("project", "hla");
    Tags.of(this).add("env", "dev");

    // ----------------------
    // KMS for artifacts (destroyable for DEV)
    // ----------------------
    const artifactsKey = new kms.Key(this, "ArtifactsKey", {
      alias: "alias/hla-artifacts-dev",
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ----------------------
    // Artifacts bucket (auto-delete, destroy on stack delete)
    // ----------------------
    const artifactsBucket = new s3.Bucket(this, "ArtifactsBucket", {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: artifactsKey,
      versioned: false,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: Duration.days(7) }],
      removalPolicy: RemovalPolicy.DESTROY,
      enforceSSL: true,
    });

    // ----------------------
    // ECR repos (destroyable)
    // ----------------------
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

    // SSM pointers for CI/CD
    new ssm.StringParameter(this, "BackendRepoUri", {
      parameterName: "/hla/dev/backendRepoUri",
      stringValue: backendRepo.repositoryUri,
    });
    new ssm.StringParameter(this, "FrontendRepoUri", {
      parameterName: "/hla/dev/frontendRepoUri",
      stringValue: frontendRepo.repositoryUri,
    });

    // ----------------------
    // VPC (public only) + ECS cluster
    // ----------------------
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: "public", subnetType: ec2.SubnetType.PUBLIC }],
    });

    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    // ----------------------
    // Task roles
    // ----------------------
    const execRole = new iam.Role(this, "ExecRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });

    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    backendRepo.grantPull(execRole);

    // ----------------------
    // Container image strategy:
    // - If env HLA_PLACEHOLDER=1 at synth time, use nginx so stack completes even before you push an image.
    // - Otherwise, use your ECR image :latest.
    // ----------------------
    const usePlaceholder = (process.env.HLA_PLACEHOLDER || "") === "1";

    const containerImage = usePlaceholder
      ? ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/nginx:stable")
      : ecs.ContainerImage.fromEcrRepository(backendRepo, "latest");

    // ----------------------
    // Task definition + container
    // ----------------------
    const taskDef = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: execRole,
      taskRole,
    });

    const container = taskDef.addContainer("BackendContainer", {
      image: containerImage,
      containerName: "backend",
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "backend" }),
      environment: usePlaceholder
        ? {}
        : {
            DJANGO_SETTINGS_MODULE: "config.settings",
            PYTHONUNBUFFERED: "1",
          },
      healthCheck: usePlaceholder
        ? undefined
        : {
            // Basic container-level health check (optional; ALB health check is the main one)
            command: ["CMD-SHELL", "python -c 'print(1)' || exit 1"],
            interval: Duration.seconds(30),
            timeout: Duration.seconds(5),
            retries: 3,
            startPeriod: Duration.seconds(60),
          },
    });

    // If you want to start Gunicorn inside the container (only when NOT placeholder),
    // uncomment this and ensure your image includes gunicorn & config.wsgi
    // if (!usePlaceholder) {
    //   container.addOverride("command", [
    //     "bash",
    //     "-lc",
    //     "gunicorn config.wsgi:application -b 0.0.0.0:8000 --workers 2"
    //   ]);
    // }

    // nginx listens on 80; django listens on 8000 - map accordingly
    container.addPortMappings({
      containerPort: usePlaceholder ? 80 : 8000,
    });

    // ----------------------
    // Security groups
    // ----------------------
    const svcSG = new ec2.SecurityGroup(this, "ServiceSG", { vpc, allowAllOutbound: true });
    const albSG = new ec2.SecurityGroup(this, "AlbSG", { vpc, allowAllOutbound: true });

    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP");

    // Allow ALB -> Service on containerPort
    svcSG.addIngressRule(
      albSG,
      ec2.Port.tcp(usePlaceholder ? 80 : 8000),
      "ALB to Service"
    );

    // ----------------------
    // Fargate service with circuit breaker & HC grace
    // ----------------------
    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: true,
      securityGroups: [svcSG],
      healthCheckGracePeriod: Duration.seconds(120),
      circuitBreaker: { rollback: true }, // auto-rollback failed deployments
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
    });

    // ----------------------
    // ALB + Listener + TG (tolerant health check initially)
    // ----------------------
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSG,
    });

    const http = alb.addListener("Http", { port: 80, open: true });

    const tg = new elbv2.ApplicationTargetGroup(this, "Tg", {
      vpc,
      targetType: elbv2.TargetType.IP,
      port: usePlaceholder ? 80 : 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: {
        path: "/",                 // change to "/health" once your app has it
        healthyHttpCodes: "200-499", // tolerant for early app states
        interval: Duration.seconds(20),
        timeout: Duration.seconds(5),
        unhealthyThresholdCount: 5,
        healthyThresholdCount: 2,
      },
      deregistrationDelay: Duration.seconds(15),
    });

    http.addTargetGroups("AddTg", { targetGroups: [tg] });
    service.attachToApplicationTargetGroup(tg);

    // ----------------------
    // SSM & Outputs for Backend URL
    // ----------------------
    new ssm.StringParameter(this, "BackendAlbDnsParam", {
      parameterName: "/hla/dev/backendAlbDns",
      stringValue: alb.loadBalancerDnsName,
    });

    new CfnOutput(this, "BackendAlbDns", {
      value: alb.loadBalancerDnsName,
      exportName: "HLA-BackendAlbDns",
      description: "Public DNS of the backend ALB",
    });

    // ----------------------
    // Frontend: S3 + CloudFront (destroyable)
    // ----------------------
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
      enforceSSL: true,
    });

    const oai = new cloudfront.OriginAccessIdentity(this, "OAI");
    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [siteBucket.arnForObjects("*")],
        principals: [
          new iam.CanonicalUserPrincipal(
            oai.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    const dist = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
      enabled: true,
    });

    // SSM params for frontend
    new ssm.StringParameter(this, "FrontendBucketNameParam", {
      parameterName: "/hla/dev/frontendBucketName",
      stringValue: siteBucket.bucketName,
    });

    new ssm.StringParameter(this, "FrontendDistributionIdParam", {
      parameterName: "/hla/dev/frontendDistributionId",
      stringValue: dist.distributionId,
    });

    // Outputs for frontend
    new CfnOutput(this, "FrontendDomain", {
      value: dist.distributionDomainName,
      exportName: "HLA-FrontendDomain",
      description: "CloudFront domain for the frontend",
    });

    new CfnOutput(this, "FrontendBucketName", {
      value: siteBucket.bucketName,
      exportName: "HLA-FrontendBucketName",
    });

    // Repo URIs also exported (nice for humans)
    new CfnOutput(this, "BackendRepoUriOut", {
      value: backendRepo.repositoryUri,
      exportName: "HLA-BackendRepoUri",
    });
    new CfnOutput(this, "FrontendRepoUriOut", {
      value: frontendRepo.repositoryUri,
      exportName: "HLA-FrontendRepoUri",
    });
  }
}
