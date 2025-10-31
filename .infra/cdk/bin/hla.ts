#!/usr/bin/env node
import 'source-map-support/register';
import { App, Environment } from 'aws-cdk-lib';
import { HlaEcrStack } from '../lib/hla-ecr-stack';
import { HlaDevStack } from '../lib/hla-dev-stack';

const app = new App();

const env: Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION,
};

new HlaEcrStack(app, 'HLAEcrStack', { env });  // ECR repos + SSM URIs
new HlaDevStack(app, 'HLAStack', { env });     // App (ALB + Fargate), digest-aware
