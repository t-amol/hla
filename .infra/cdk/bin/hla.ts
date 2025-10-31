#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { HlaDevStack } from '../lib/hla-dev-stack';

const app = new App();
const stackName = process.env.CDK_STACK_NAME || 'HLAStack';

new HlaDevStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
    region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION
  }
});
