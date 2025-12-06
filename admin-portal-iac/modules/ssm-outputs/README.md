# SSM Outputs Module

This module automatically stores Terraform outputs in AWS Systems Manager Parameter Store for cross-pipeline communication.

## Purpose

Enables decoupled pipeline architecture where:
- Bootstrap pipelines create backend resources and store config in SSM
- Infrastructure pipelines read bootstrap config and store their outputs
- Application deployment pipelines read infrastructure config

## Parameter Hierarchy

```
/admin-portal/{workspace}/{account_type}/{category}/
├── {output-key-1}
├── {output-key-2}
├── metadata/
│   ├── deployed-at
│   ├── version
│   └── terraform-version
└── status
```

## Usage

### In Bootstrap

```hcl
module "bootstrap_outputs" {
  source = "./modules/ssm-outputs"
  
  workspace    = var.workspace_prefix
  account_type = "admin"
  category     = "bootstrap"
  aws_region   = var.aws_region
  
  outputs = {
    backend-bucket       = aws_s3_bucket.terraform_state.id
    backend-bucket-arn   = aws_s3_bucket.terraform_state.arn
    dynamodb-table       = aws_dynamodb_table.terraform_lock.id
    dynamodb-table-arn   = aws_dynamodb_table.terraform_lock.arn
    kms-key-id           = aws_kms_key.terraform.key_id
    kms-key-arn          = aws_kms_key.terraform.arn
    region               = var.aws_region
  }
}
```

### In Infrastructure

```hcl
module "infrastructure_outputs" {
  source = "./modules/ssm-outputs"
  
  workspace    = var.workspace_prefix
  account_type = "admin"
  category     = "infrastructure"
  aws_region   = var.aws_region
  
  outputs = {
    vpc-id              = module.networking[0].vpc_id
    private-subnet-ids  = join(",", module.networking[0].private_subnet_ids)
    cognito-user-pool-id = module.cognito[0].user_pool_id
    api-gateway-id      = module.api_gateway[0].api_id
    api-gateway-url     = module.api_gateway[0].api_url
  }
}
```

## Parameter Types

- **String**: Default for most values
- **SecureString**: Automatically used for keys matching patterns:
  - `*password*`
  - `*secret*`
  - `*key-id*`
  - `*client-id*`
- **StringList**: For comma-separated arrays (handled in cicd.sh)

## Benefits

1. **No S3 dependency** for config sharing
2. **Free tier friendly** (10,000 standard parameters free)
3. **Native AWS integration** with Console, CLI, SDK
4. **Versioned** - Last 100 versions retained automatically
5. **Encrypted** - SecureString uses KMS encryption
6. **IAM integrated** - Fine-grained access control

## Inputs

| Name | Description | Type | Required |
|------|-------------|------|----------|
| workspace | Workspace name | string | yes |
| account_type | admin or tenant | string | yes |
| category | bootstrap or infrastructure | string | yes |
| outputs | Map of key-value pairs to store | map(any) | yes |
| aws_region | AWS region | string | no |
| enabled | Enable/disable module | bool | no |

## Outputs

| Name | Description |
|------|-------------|
| ssm_prefix | SSM parameter prefix path |
| parameter_count | Number of parameters created |
| parameter_names | List of parameter names |
| ssm_parameters | Map of parameter ARNs |
