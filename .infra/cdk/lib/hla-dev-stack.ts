import { Duration, RemovalPolicy, Stack, StackProps,
  aws_s3 as s3, aws_ecr as ecr, aws_kms as kms, aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class HlaDevStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const key = new kms.Key(this, 'ArtifactsKey', {
      alias: 'alias/hla-artifacts-dev',
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const artifacts = new s3.Bucket(this, 'ArtifactsBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: key,
      versioned: false,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: Duration.days(7) }],
      removalPolicy: RemovalPolicy.DESTROY
    });

    const backend = new ecr.Repository(this, 'BackendRepo', {
      repositoryName: 'hla-backend',
      imageScanOnPush: true,
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const frontend = new ecr.Repository(this, 'FrontendRepo', {
      repositoryName: 'hla-frontend',
      imageScanOnPush: true,
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY
    });

    new ssm.StringParameter(this, 'BackendRepoUri', {
      parameterName: '/hla/dev/backendRepoUri',
      stringValue: backend.repositoryUri
    });

    new ssm.StringParameter(this, 'FrontendRepoUri', {
      parameterName: '/hla/dev/frontendRepoUri',
      stringValue: frontend.repositoryUri
    });

    void artifacts; void backend; void frontend;
  }
}
