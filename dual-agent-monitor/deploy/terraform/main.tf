# Main Terraform Configuration for Dual Agent Monitor
# Multi-cloud deployment support (AWS, Azure, GCP)

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Backend configuration - uncomment and configure for remote state
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "dual-agent-monitor/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

# Local variables
locals {
  common_tags = merge(var.common_tags, {
    Environment = var.environment
    Timestamp   = timestamp()
  })
  
  # Determine which cloud provider to use based on provider configuration
  deploy_aws   = try(length(aws.main), 0) > 0
  deploy_azure = try(length(azurerm.main), 0) > 0
  deploy_gcp   = try(length(google.main), 0) > 0
  
  # Generate secure passwords if not provided
  db_password     = var.db_master_password != "" ? var.db_master_password : random_password.db_password.result
  redis_password  = var.redis_auth_token != "" ? var.redis_auth_token : random_password.redis_password.result
  jwt_secret      = var.jwt_secret != "" ? var.jwt_secret : random_password.jwt_secret.result
  session_secret  = var.session_secret != "" ? var.session_secret : random_password.session_secret.result
}

# Generate secure random passwords
resource "random_password" "db_password" {
  length  = 16
  special = true
}

resource "random_password" "redis_password" {
  length  = 16
  special = true
}

resource "random_password" "jwt_secret" {
  length  = 32
  special = true
}

resource "random_password" "session_secret" {
  length  = 32
  special = true
}

# SSH key pair for EC2 instances (AWS)
resource "tls_private_key" "ssh_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# AWS Provider Configuration
provider "aws" {
  alias  = "main"
  region = var.region
  
  default_tags {
    tags = local.common_tags
  }
}

# Azure Provider Configuration
provider "azurerm" {
  alias = "main"
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# Google Cloud Provider Configuration
provider "google" {
  alias   = "main"
  region  = var.region
  project = var.project_name
}

# AWS Deployment Module
module "aws" {
  count  = local.deploy_aws ? 1 : 0
  source = "./aws"
  
  # Pass all variables to AWS module
  project_name     = var.project_name
  environment      = var.environment
  region           = var.region
  domain_name      = var.domain_name
  enable_ssl       = var.enable_ssl
  enable_monitoring = var.enable_monitoring
  enable_backup    = var.enable_backup
  
  # Database configuration
  db_instance_class           = var.db_instance_class
  db_allocated_storage        = var.db_allocated_storage
  db_max_allocated_storage    = var.db_max_allocated_storage
  db_backup_retention_period  = var.db_backup_retention_period
  db_master_password          = local.db_password
  
  # Application configuration
  app_instance_type     = var.app_instance_type
  app_min_capacity      = var.app_min_capacity
  app_max_capacity      = var.app_max_capacity
  app_desired_capacity  = var.app_desired_capacity
  
  # Redis configuration
  redis_node_type         = var.redis_node_type
  redis_num_cache_nodes   = var.redis_num_cache_nodes
  redis_auth_token        = local.redis_password
  
  # Security configuration
  allowed_cidr_blocks = var.allowed_cidr_blocks
  enable_waf         = var.enable_waf
  ssh_public_key     = tls_private_key.ssh_key.public_key_openssh
  
  # Secrets
  jwt_secret     = local.jwt_secret
  session_secret = local.session_secret
  
  # Kubernetes configuration
  kubernetes_version           = var.kubernetes_version
  node_group_instance_types    = var.node_group_instance_types
  node_group_scaling_config    = var.node_group_scaling_config
  
  # Notifications
  notification_email   = var.notification_email
  slack_webhook_url   = var.slack_webhook_url
  
  # Tags
  common_tags = local.common_tags
  
  providers = {
    aws = aws.main
  }
}

# Azure Deployment Module
module "azure" {
  count  = local.deploy_azure ? 1 : 0
  source = "./azure"
  
  # Pass all variables to Azure module
  project_name     = var.project_name
  environment      = var.environment
  region           = var.region
  domain_name      = var.domain_name
  enable_ssl       = var.enable_ssl
  enable_monitoring = var.enable_monitoring
  enable_backup    = var.enable_backup
  
  # Database configuration
  db_sku_name                 = var.db_instance_class  # Will be mapped to Azure equivalent
  db_storage_mb               = var.db_allocated_storage * 1024
  db_backup_retention_days    = var.db_backup_retention_period
  db_administrator_password   = local.db_password
  
  # Application configuration
  app_sku_name         = var.app_instance_type  # Will be mapped to Azure equivalent
  app_min_capacity     = var.app_min_capacity
  app_max_capacity     = var.app_max_capacity
  app_desired_capacity = var.app_desired_capacity
  
  # Redis configuration
  redis_sku_name = var.redis_node_type  # Will be mapped to Azure equivalent
  redis_password = local.redis_password
  
  # Security configuration
  allowed_ip_ranges = var.allowed_cidr_blocks
  enable_waf       = var.enable_waf
  
  # Secrets
  jwt_secret     = local.jwt_secret
  session_secret = local.session_secret
  
  # Kubernetes configuration
  kubernetes_version        = var.kubernetes_version
  node_pool_vm_size        = var.node_group_instance_types[0]
  node_pool_node_count     = var.node_group_scaling_config.desired_size
  
  # Notifications
  notification_email = var.notification_email
  slack_webhook_url = var.slack_webhook_url
  
  # Tags
  common_tags = local.common_tags
  
  providers = {
    azurerm = azurerm.main
  }
}

# Google Cloud Deployment Module
module "gcp" {
  count  = local.deploy_gcp ? 1 : 0
  source = "./gcp"
  
  # Pass all variables to GCP module
  project_name     = var.project_name
  environment      = var.environment
  region           = var.region
  domain_name      = var.domain_name
  enable_ssl       = var.enable_ssl
  enable_monitoring = var.enable_monitoring
  enable_backup    = var.enable_backup
  
  # Database configuration
  db_tier                 = var.db_instance_class  # Will be mapped to GCP equivalent
  db_disk_size           = var.db_allocated_storage
  db_backup_enabled      = var.enable_backup
  db_root_password       = local.db_password
  
  # Application configuration
  app_machine_type     = var.app_instance_type  # Will be mapped to GCP equivalent
  app_min_replicas     = var.app_min_capacity
  app_max_replicas     = var.app_max_capacity
  app_target_replicas  = var.app_desired_capacity
  
  # Redis configuration
  redis_memory_size_gb = 1  # Will be configurable based on node type
  redis_auth_enabled   = true
  redis_password       = local.redis_password
  
  # Security configuration
  allowed_cidr_blocks = var.allowed_cidr_blocks
  enable_armor       = var.enable_waf  # Cloud Armor equivalent of WAF
  
  # Secrets
  jwt_secret     = local.jwt_secret
  session_secret = local.session_secret
  
  # Kubernetes configuration
  kubernetes_version     = var.kubernetes_version
  node_pool_machine_type = var.node_group_instance_types[0]
  node_pool_node_count   = var.node_group_scaling_config.desired_size
  
  # Notifications
  notification_email = var.notification_email
  slack_webhook_url = var.slack_webhook_url
  
  # Tags/Labels
  common_labels = local.common_tags
  
  providers = {
    google = google.main
  }
}

# DNS Zone (if domain management is handled by Terraform)
# This example uses AWS Route 53, but can be adapted for other providers
resource "aws_route53_zone" "main" {
  count = local.deploy_aws && var.domain_name != "" ? 1 : 0
  name  = var.domain_name
  
  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-dns-zone"
  })
}

# DNS Records pointing to load balancer
resource "aws_route53_record" "main" {
  count   = local.deploy_aws && var.domain_name != "" ? 1 : 0
  zone_id = aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"
  
  alias {
    name                   = module.aws[0].load_balancer_dns
    zone_id                = module.aws[0].load_balancer_zone_id
    evaluate_target_health = true
  }
}

# Wildcard DNS record for subdomains
resource "aws_route53_record" "wildcard" {
  count   = local.deploy_aws && var.domain_name != "" ? 1 : 0
  zone_id = aws_route53_zone.main[0].zone_id
  name    = "*.${var.domain_name}"
  type    = "A"
  
  alias {
    name                   = module.aws[0].load_balancer_dns
    zone_id                = module.aws[0].load_balancer_zone_id
    evaluate_target_health = true
  }
}

# Save SSH private key to local file (for debugging - not recommended for production)
resource "local_file" "ssh_private_key" {
  count           = local.deploy_aws ? 1 : 0
  content         = tls_private_key.ssh_key.private_key_pem
  filename        = "${path.module}/ssh-key-${var.project_name}-${var.environment}.pem"
  file_permission = "0600"
  
  # Only create in development environment
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [content]
  }
}

# Output sensitive information to be stored securely
resource "local_file" "deployment_secrets" {
  content = jsonencode({
    db_password     = local.db_password
    redis_password  = local.redis_password
    jwt_secret      = local.jwt_secret
    session_secret  = local.session_secret
    ssh_private_key = tls_private_key.ssh_key.private_key_pem
    deployment_info = {
      timestamp   = timestamp()
      environment = var.environment
      region      = var.region
      domain      = var.domain_name
    }
  })
  filename        = "${path.module}/.secrets-${var.project_name}-${var.environment}.json"
  file_permission = "0600"
  
  lifecycle {
    ignore_changes = [content]
  }
}