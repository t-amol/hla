# HLA — CDK (Destroyable DEV)

Creates destroy-safe dev infra:
- KMS key (rotation on)
- S3 artifacts bucket (autoDeleteObjects, 7-day lifecycle)
- ECR repos: hla-backend, hla-frontend (emptyOnDelete, scan on push)
- SSM params: /hla/dev/backendRepoUri, /hla/dev/frontendRepoUri

## Use (Windows Git Bash or PowerShell)
```bash
cd .infra/cdk
npm install

# Pick one: profile with SSO/keys that ASSUMES your role, e.g. hla-dev
export AWS_PROFILE=hla-dev
export AWS_REGION=eu-north-1
export CDK_STACK_NAME=HLAStack

# Bootstrap once per account+region
npx cdk bootstrap aws://<ACCOUNT_ID>/$AWS_REGION --profile $AWS_PROFILE

# Deploy / Destroy
npx cdk deploy --require-approval never --profile $AWS_PROFILE
npx cdk destroy --force --profile $AWS_PROFILE
```
