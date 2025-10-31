#!/usr/bin/env bash
set -euo pipefail
PROFILE=${1:-role-ma}
REGION=${2:-eu-north-1}
STACK=${3:-HLAStack}

alb=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" --profile "$PROFILE" \
  --query "Stacks[0].Outputs[?OutputKey=='BackendAlbDns'].OutputValue" --output text || true)

cf=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" --profile "$PROFILE" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDomain'].OutputValue" --output text || true)

if [ -z "$alb" ] || [ "$alb" = "None" ]; then
  alb=$(aws ssm get-parameter --name /hla/dev/backendAlbDns --region "$REGION" --profile "$PROFILE" --query "Parameter.Value" --output text 2>/dev/null || true)
fi
if [ -z "$cf" ] || [ "$cf" = "None" ]; then
  distId=$(aws ssm get-parameter --name /hla/dev/frontendDistributionId --region "$REGION" --profile "$PROFILE" --query "Parameter.Value" --output text 2>/dev/null || true)
  if [ -n "$distId" ] && [ "$distId" != "None" ]; then
    cf=$(aws cloudfront get-distribution --id "$distId" --query "Distribution.DomainName" --output text || true)
  fi
fi

echo "Backend ALB : http://$alb"
echo "Frontend CF : https://$cf"
