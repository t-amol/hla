param(
  [string]$Profile = "role-ma",
  [string]$Region  = "eu-north-1",
  [string]$Stack   = "HLAStack"
)

$outs = aws cloudformation describe-stacks --stack-name $Stack --region $Region --profile $Profile --query "Stacks[0].Outputs" | ConvertFrom-Json
$alb = ($outs | ? { $_.OutputKey -eq "BackendAlbDns" }).OutputValue
$cf  = ($outs | ? { $_.OutputKey -eq "FrontendDomain" }).OutputValue

if (-not $alb) {
  $alb = aws ssm get-parameter --name /hla/dev/backendAlbDns --region $Region --profile $Profile --query "Parameter.Value" --output text 2>$null
}
if (-not $cf) {
  $distId = aws ssm get-parameter --name /hla/dev/frontendDistributionId --region $Region --profile $Profile --query "Parameter.Value" --output text 2>$null
  if ($distId) { $cf = aws cloudfront get-distribution --id $distId --query "Distribution.DomainName" --output text }
}

Write-Host "Backend ALB : http://$alb"
Write-Host "Frontend CF : https://$cf"
