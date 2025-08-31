# Global Variables for Dual Agent Monitor Infrastructure

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "dual-agent-monitor"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "region" {
  description = "Cloud provider region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Primary domain name for the application"
  type        = string
}

variable "enable_ssl" {
  description = "Enable SSL certificate generation"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable monitoring stack (Prometheus, Grafana)"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

# Database configuration
variable "db_instance_class" {
  description = "Database instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Database allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Database max allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Database backup retention period in days"
  type        = number
  default     = 7
}

# Application configuration
variable "app_instance_type" {
  description = "Application instance type"
  type        = string
  default     = "t3.small"
}

variable "app_min_capacity" {
  description = "Minimum number of application instances"
  type        = number
  default     = 2
}

variable "app_max_capacity" {
  description = "Maximum number of application instances"
  type        = number
  default     = 10
}

variable "app_desired_capacity" {
  description = "Desired number of application instances"
  type        = number
  default     = 2
}

# Redis configuration
variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 1
}

# Security configuration
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_waf" {
  description = "Enable Web Application Firewall"
  type        = bool
  default     = true
}

# Notification configuration
variable "notification_email" {
  description = "Email for notifications and alerts"
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

# Tags
variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "dual-agent-monitor"
    Terraform = "true"
  }
}

# Kubernetes-specific variables (for EKS)
variable "kubernetes_version" {
  description = "Kubernetes version for managed cluster"
  type        = string
  default     = "1.28"
}

variable "node_group_instance_types" {
  description = "Instance types for Kubernetes node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_group_scaling_config" {
  description = "Node group scaling configuration"
  type = object({
    desired_size = number
    max_size     = number
    min_size     = number
  })
  default = {
    desired_size = 3
    max_size     = 6
    min_size     = 2
  }
}

# Container Registry
variable "container_registry" {
  description = "Container registry URL"
  type        = string
  default     = ""
}

# Secrets configuration
variable "db_master_password" {
  description = "Master password for database (use AWS Secrets Manager in production)"
  type        = string
  sensitive   = true
}

variable "redis_auth_token" {
  description = "Authentication token for Redis"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "session_secret" {
  description = "Session secret key"
  type        = string
  sensitive   = true
}