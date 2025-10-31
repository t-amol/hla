#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { HlaDevStack } from "../lib/hla-dev-stack";

const app = new App();
const stackName = process.env.CDK_STACK_NAME || "HLAStack";

const account =
  process.env.CDK_DEFAULT_ACCOUNT ||
  process.env.AWS_ACCOUNT_ID; // fallback for local dev

const region =
  process.env.CDK_DEFAULT_REGION ||
  process.env.AWS_REGION;

console.log("Synth env:", { stackName, account, region });

new HlaDevStack(app, stackName, {
  env: { account, region },
});
