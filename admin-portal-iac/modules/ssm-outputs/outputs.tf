# Outputs for SSM Outputs module

output "ssm_prefix" {
  description = "SSM parameter prefix path"
  value       = local.ssm_prefix
}

output "parameter_count" {
  description = "Number of parameters created"
  value       = length(var.outputs)
}

output "parameter_names" {
  description = "List of created parameter names"
  value       = [for k, v in aws_ssm_parameter.outputs : v.name]
}

output "ssm_parameters" {
  description = "Map of parameter names to ARNs"
  value = {
    for k, v in aws_ssm_parameter.outputs :
    k => v.arn
  }
}
