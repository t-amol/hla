import {
  Stack, StackProps, RemovalPolicy, Tags,
  aws_ecr as ecr, aws_ssm as ssm,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class HlaEcrStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Tags.of(this).add('project', 'hla');
    Tags.of(this).add('env', 'dev');

    const backendRepo = new ecr.Repository(this, 'BackendRepo', {
      repositoryName: 'hla-backend',
      imageScanOnPush: true,
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const frontendRepo = new ecr.Repository(this, 'FrontendRepo', {
      repositoryName: 'hla-frontend',
      imageScanOnPush: true,
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new ssm.StringParameter(this, 'BackendRepoUri', {
      parameterName: '/hla/dev/backendRepoUri',
      stringValue: backendRepo.repositoryUri,
    });

    new ssm.StringParameter(this, 'FrontendRepoUri', {
      parameterName: '/hla/dev/frontendRepoUri',
      stringValue: frontendRepo.repositoryUri,
    });
  }
}
