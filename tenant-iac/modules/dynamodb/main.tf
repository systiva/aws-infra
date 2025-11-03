# DynamoDB tables for tenant infrastructure
resource "aws_dynamodb_table" "tenant_data" {
  name         = local.is_same_account ? "${var.workspace_prefix}-tenant-${var.tenant_id}-data${var.table_name_suffix}" : "${var.workspace_prefix}-tenant-data"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = merge(var.common_tags, {
    Name      = "${var.workspace_prefix}-tenant-data"
    Purpose   = "Tenant-specific data storage"
    TenantId  = var.tenant_id
    Component = "dynamodb"
  })
}

resource "aws_dynamodb_table" "tenant_config" {
  name         = local.is_same_account ? "${var.workspace_prefix}-tenant-${var.tenant_id}-config${var.table_name_suffix}" : "${var.workspace_prefix}-tenant-config"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "config_key"

  attribute {
    name = "config_key"
    type = "S"
  }

  tags = merge(var.common_tags, {
    Name      = "${var.workspace_prefix}-tenant-config"
    Purpose   = "Tenant configuration storage"
    TenantId  = var.tenant_id
    Component = "dynamodb"
  })
}

locals {
  is_same_account = var.admin_account_id == var.tenant_account_id
}