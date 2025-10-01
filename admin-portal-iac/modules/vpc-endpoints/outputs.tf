# Outputs for VPC Endpoints Module

output "vpc_endpoint_ids" {
  description = "Map of VPC endpoint IDs by service name"
  value = {
    for service, endpoint in aws_vpc_endpoint.endpoints :
    service => endpoint.id
  }
}

output "vpc_endpoint_dns_names" {
  description = "Map of VPC endpoint DNS names by service name (interface endpoints only)"
  value = {
    for service, endpoint in aws_vpc_endpoint.endpoints :
    service => endpoint.dns_entry[*].dns_name
    if endpoint.vpc_endpoint_type == "Interface"
  }
}

output "vpc_endpoint_hosted_zone_ids" {
  description = "Map of VPC endpoint hosted zone IDs by service name (interface endpoints only)"
  value = {
    for service, endpoint in aws_vpc_endpoint.endpoints :
    service => endpoint.dns_entry[*].hosted_zone_id
    if endpoint.vpc_endpoint_type == "Interface"
  }
}

output "gateway_endpoint_prefix_list_ids" {
  description = "Map of gateway endpoint prefix list IDs by service name"
  value = {
    for service, endpoint in aws_vpc_endpoint.endpoints :
    service => endpoint.prefix_list_id
    if endpoint.vpc_endpoint_type == "Gateway"
  }
}

output "security_group_id" {
  description = "Security group ID for interface endpoints"
  value       = length(aws_security_group.vpc_endpoints) > 0 ? aws_security_group.vpc_endpoints[0].id : null
}

output "endpoint_services_created" {
  description = "List of VPC endpoint services that were created"
  value       = keys(local.enabled_services)
}