# HLA — GitHub & Infra bundle

This adds:
- `.infra/cdk` destroy-safe dev infra (KMS, S3, ECR, SSM)
- `.infra/iam/policies/cdk-dev-deploy.json` least-privilege policy for a CDK deploy role
- `.github/workflows` CI + ECR build & push + CDK deploy + PR preview

## 1) Create an AWS role for GitHub OIDC (in account 752095361522)
- Trust policy: allow `token.actions.githubusercontent.com` with `sub` = `repo:t-amol/hla:*`
- Attach **least-priv** policy from `.infra/iam/policies/cdk-dev-deploy.json` (scope tighter later)

## 2) Add repository secrets (GitHub → Settings → Secrets and variables → Actions)
- `AWS_REGION` = `eu-north-1`
- `AWS_ROLE_TO_ASSUME` = `arn:aws:iam::752095361522:role/<YourGitHubOIDCRole>`
- `ECR_REGISTRY` = `752095361522.dkr.ecr.eu-north-1.amazonaws.com`
- `CDK_STACK_NAME` = `HLAStack`

## 3) Run the workflows
- On push to `main`: CI + image build/push + CDK deploy
- On PR: temporary stack `hla-dev-pr-<PR#>` created, destroyed on close

## 4) Local deploy (optional)
```bash
cd .infra/cdk
npm install
export AWS_PROFILE=hla-dev   # profile that assumes your dev role
export AWS_REGION=eu-north-1
export CDK_STACK_NAME=HLAStack
npx cdk bootstrap aws://752095361522/$AWS_REGION --profile $AWS_PROFILE
npx cdk deploy --require-approval never --profile $AWS_PROFILE
```
