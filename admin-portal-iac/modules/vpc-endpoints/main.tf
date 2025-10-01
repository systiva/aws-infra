# VPC Endpoints Module
# Creates VPC endpoints for private access to AWS services

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  # Define available VPC endpoint services
  endpoint_services = {
    s3 = {
      service_name = "com.amazonaws.${data.aws_region.current.name}.s3"
      type         = "Gateway"
      policy       = data.aws_iam_policy_document.s3_endpoint_policy.json
    }
    dynamodb = {
      service_name = "com.amazonaws.${data.aws_region.current.name}.dynamodb"
      type         = "Gateway"
      policy       = data.aws_iam_policy_document.dynamodb_endpoint_policy.json
    }
    lambda = {
      service_name = "com.amazonaws.${data.aws_region.current.name}.lambda"
      type         = "Interface"
      policy       = null
    }
    states = {
      service_name = "com.amazonaws.${data.aws_region.current.name}.states"
      type         = "Interface"
      policy       = null
    }
    sts = {
      service_name = "com.amazonaws.${data.aws_region.current.name}.sts"
      type         = "Interface"
      policy       = null
    }
    ssm = {
      service_name = "com.amazonaws.${data.aws_region.current.name}.ssm"
      type         = "Interface"
      policy       = null
    }
    kms = {
      service_name = "com.amazonaws.${data.aws_region.current.name}.kms"
      type         = "Interface"
      policy       = null
    }
  }
  
  # Filter services based on input
  enabled_services = {
    for service in var.vpc_endpoint_services :
    service => local.endpoint_services[service]
    if contains(keys(local.endpoint_services), service)
  }
}

# Security group for interface endpoints
resource "aws_security_group" "vpc_endpoints" {
  count       = length([for k, v in local.enabled_services : k if v.type == "Interface"]) > 0 ? 1 : 0
  name_prefix = "${var.project_name}-${var.environment}-vpc-endpoints-"
  vpc_id      = var.vpc_id
  description = "Security group for VPC interface endpoints"

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-vpc-endpoints-sg"
    Type = "SecurityGroup"
  })
}

# Data source for VPC information
data "aws_vpc" "main" {
  id = var.vpc_id
}

# Data source for route tables
data "aws_route_tables" "private" {
  vpc_id = var.vpc_id
  
  filter {
    name   = "tag:Name"
    values = ["*private*"]
  }
}

# VPC Endpoints
resource "aws_vpc_endpoint" "endpoints" {
  for_each = local.enabled_services
  
  vpc_id              = var.vpc_id
  service_name        = each.value.service_name
  vpc_endpoint_type   = each.value.type
  
  # Gateway endpoints use route tables, Interface endpoints use subnets
  route_table_ids = each.value.type == "Gateway" ? data.aws_route_tables.private.ids : null
  subnet_ids      = each.value.type == "Interface" ? var.private_subnet_ids : null
  
  # Interface endpoints need security groups
  security_group_ids = each.value.type == "Interface" ? [aws_security_group.vpc_endpoints[0].id] : null
  
  # Policy (mainly for gateway endpoints)
  policy = each.value.policy
  
  # DNS settings for interface endpoints
  private_dns_enabled = each.value.type == "Interface" ? true : null

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-${var.environment}-${each.key}-endpoint"
    Type = "VPCEndpoint"
    Service = each.key
  })
}

# IAM policy documents for gateway endpoints
data "aws_iam_policy_document" "s3_endpoint_policy" {
  statement {
    effect = "Allow"
    
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListBucket",
      "s3:DeleteObject",
      "s3:GetBucketLocation"
    ]
    
    resources = [
      "arn:aws:s3:::*"
    ]
    
    condition {
      test     = "StringEquals"
      variable = "aws:PrincipalAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_iam_policy_document" "dynamodb_endpoint_policy" {
  statement {
    effect = "Allow"
    
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem", 
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:DescribeTable"
    ]
    
    resources = [
      "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/*"
    ]
    
    condition {
      test     = "StringEquals"
      variable = "aws:PrincipalAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}