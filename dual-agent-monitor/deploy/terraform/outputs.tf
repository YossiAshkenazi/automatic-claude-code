# Terraform Outputs for Dual Agent Monitor Infrastructure

# Application URLs
output "application_url" {
  description = "URL of the deployed application"
  value       = var.enable_ssl ? "https://${var.domain_name}" : "http://${var.domain_name}"
}

output "monitoring_url" {
  description = "URL of Grafana monitoring dashboard"
  value       = var.enable_ssl ? "https://${var.domain_name}:3000" : "http://${var.domain_name}:3000"
}

# Database information
output "database_endpoint" {
  description = "Database endpoint"
  value       = try(module.aws[0].database_endpoint, try(module.azure[0].database_endpoint, try(module.gcp[0].database_endpoint, "Not deployed")))
  sensitive   = true
}

output "database_port" {
  description = "Database port"
  value       = 5432
}

# Redis information
output "redis_endpoint" {
  description = "Redis cache endpoint"
  value       = try(module.aws[0].redis_endpoint, try(module.azure[0].redis_endpoint, try(module.gcp[0].redis_endpoint, "Not deployed")))
  sensitive   = true
}

output "redis_port" {
  description = "Redis cache port"
  value       = 6379
}

# Load Balancer information
output "load_balancer_dns" {
  description = "Load balancer DNS name"
  value       = try(module.aws[0].load_balancer_dns, try(module.azure[0].load_balancer_dns, try(module.gcp[0].load_balancer_dns, "Not deployed")))
}

output "load_balancer_zone_id" {
  description = "Load balancer zone ID"
  value       = try(module.aws[0].load_balancer_zone_id, "N/A")
}

# SSL Certificate information
output "ssl_certificate_arn" {
  description = "SSL certificate ARN"
  value       = try(module.aws[0].ssl_certificate_arn, "Not deployed")
  sensitive   = true
}

# Backup information
output "backup_bucket" {
  description = "S3 bucket for backups"
  value       = var.enable_backup ? try(module.aws[0].backup_bucket, try(module.azure[0].backup_container, try(module.gcp[0].backup_bucket, "Not deployed"))) : "Backups disabled"
}

# VPC information
output "vpc_id" {
  description = "VPC ID"
  value       = try(module.aws[0].vpc_id, try(module.azure[0].vnet_id, try(module.gcp[0].vpc_id, "Not deployed")))
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = try(module.aws[0].private_subnet_ids, try(module.azure[0].private_subnet_ids, try(module.gcp[0].private_subnet_ids, [])))
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = try(module.aws[0].public_subnet_ids, try(module.azure[0].public_subnet_ids, try(module.gcp[0].public_subnet_ids, [])))
}

# Security Group information
output "security_group_id" {
  description = "Security group ID for application"
  value       = try(module.aws[0].security_group_id, try(module.azure[0].security_group_id, try(module.gcp[0].security_group_id, "Not deployed")))
}

# Auto Scaling information
output "autoscaling_group_name" {
  description = "Auto Scaling Group name"
  value       = try(module.aws[0].autoscaling_group_name, "Not deployed")
}

# Kubernetes cluster information (if deployed)
output "kubernetes_cluster_name" {
  description = "Kubernetes cluster name"
  value       = try(module.aws[0].kubernetes_cluster_name, try(module.azure[0].kubernetes_cluster_name, try(module.gcp[0].kubernetes_cluster_name, "Not deployed")))
}

output "kubernetes_cluster_endpoint" {
  description = "Kubernetes cluster endpoint"
  value       = try(module.aws[0].kubernetes_cluster_endpoint, try(module.azure[0].kubernetes_cluster_endpoint, try(module.gcp[0].kubernetes_cluster_endpoint, "Not deployed")))
  sensitive   = true
}

# CloudWatch Log Groups (AWS) or equivalent
output "application_log_group" {
  description = "Application log group name"
  value       = try(module.aws[0].application_log_group, "Not deployed")
}

# IAM roles and policies
output "application_role_arn" {
  description = "IAM role ARN for the application"
  value       = try(module.aws[0].application_role_arn, "Not deployed")
}

# Monitoring information
output "prometheus_endpoint" {
  description = "Prometheus endpoint (internal)"
  value       = var.enable_monitoring ? "http://prometheus:9090" : "Monitoring disabled"
}

output "grafana_admin_password" {
  description = "Grafana admin password (retrieve from secrets manager)"
  value       = "Retrieve from secrets manager"
  sensitive   = true
}

# DNS information
output "dns_zone_id" {
  description = "DNS hosted zone ID"
  value       = try(module.aws[0].dns_zone_id, try(module.azure[0].dns_zone_id, try(module.gcp[0].dns_zone_id, "Not deployed")))
}

output "dns_name_servers" {
  description = "DNS name servers"
  value       = try(module.aws[0].dns_name_servers, try(module.azure[0].dns_name_servers, try(module.gcp[0].dns_name_servers, []))
}

# Container Registry information
output "container_registry_url" {
  description = "Container registry URL"
  value       = var.container_registry != "" ? var.container_registry : try(module.aws[0].container_registry_url, try(module.azure[0].container_registry_url, try(module.gcp[0].container_registry_url, "Not deployed")))
}

# Secrets Manager information
output "secrets_manager_arn" {
  description = "Secrets manager ARN for application secrets"
  value       = try(module.aws[0].secrets_manager_arn, "Not deployed")
  sensitive   = true
}

# Cost estimation
output "estimated_monthly_cost" {
  description = "Estimated monthly cost (approximate)"
  value = {
    database  = "$25-50"
    redis     = "$15-25"
    compute   = "$50-150"
    storage   = "$10-30"
    network   = "$5-20"
    total     = "$105-275"
    note      = "Costs vary by region and actual usage"
  }
}

# Deployment information
output "deployment_timestamp" {
  description = "Deployment timestamp"
  value       = timestamp()
}

output "terraform_workspace" {
  description = "Terraform workspace used for deployment"
  value       = terraform.workspace
}

output "deployment_region" {
  description = "Deployment region"
  value       = var.region
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

# SSH key information (if EC2 instances are used)
output "ssh_key_name" {
  description = "SSH key pair name for EC2 access"
  value       = try(module.aws[0].ssh_key_name, "Not deployed")
}

# Bastion host information (if deployed)
output "bastion_host_ip" {
  description = "Bastion host public IP"
  value       = try(module.aws[0].bastion_host_ip, try(module.azure[0].bastion_host_ip, try(module.gcp[0].bastion_host_ip, "Not deployed")))
}

# WAF information
output "waf_web_acl_id" {
  description = "WAF Web ACL ID"
  value       = var.enable_waf ? try(module.aws[0].waf_web_acl_id, "Not deployed") : "WAF disabled"
}

# Health check URLs
output "health_check_urls" {
  description = "Health check endpoints"
  value = {
    application = "${var.enable_ssl ? "https" : "http"}://${var.domain_name}/health"
    api         = "${var.enable_ssl ? "https" : "http"}://${var.domain_name}/api/health"
    monitoring  = var.enable_monitoring ? "${var.enable_ssl ? "https" : "http"}://${var.domain_name}:3000/api/health" : "Monitoring disabled"
  }
}