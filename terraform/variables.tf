# Variables for Kafka Infrastructure
# Optimized for high-throughput, low-latency messaging (100K+ msgs/sec)

variable "aws_region" {
  description = "AWS region for Kafka cluster deployment"
  type        = string
  default     = "us-west-2"
}

variable "cluster_name" {
  description = "Name of the Kafka cluster"
  type        = string
  default     = "kafka-production"

  validation {
    condition     = length(var.cluster_name) > 0 && length(var.cluster_name) <= 32
    error_message = "Cluster name must be between 1 and 32 characters."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "ami_id" {
  description = "AMI ID for EC2 instances (Amazon Linux 2 recommended)"
  type        = string
  default     = "ami-0c02fb55956c7d316" # Amazon Linux 2 in us-west-2

  validation {
    condition     = can(regex("^ami-[a-z0-9]{8,17}$", var.ami_id))
    error_message = "AMI ID must be a valid AWS AMI identifier."
  }
}

variable "public_key" {
  description = "Public key for EC2 instances SSH access"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.public_key) > 0
    error_message = "Public key cannot be empty."
  }
}

# Kafka-specific variables
variable "kafka_instance_type" {
  description = "Instance type for Kafka brokers (m5.2xlarge recommended for high throughput)"
  type        = string
  default     = "m5.2xlarge"

  validation {
    condition = contains([
      "m5.large", "m5.xlarge", "m5.2xlarge", "m5.4xlarge", "m5.8xlarge",
      "m5n.large", "m5n.xlarge", "m5n.2xlarge", "m5n.4xlarge",
      "c5.large", "c5.xlarge", "c5.2xlarge", "c5.4xlarge",
      "r5.large", "r5.xlarge", "r5.2xlarge", "r5.4xlarge"
    ], var.kafka_instance_type)
    error_message = "Kafka instance type must be a suitable instance type for high-performance messaging."
  }
}

variable "kafka_log_volume_size" {
  description = "Size of EBS volume for Kafka logs (GB)"
  type        = number
  default     = 1000

  validation {
    condition     = var.kafka_log_volume_size >= 100 && var.kafka_log_volume_size <= 16384
    error_message = "Kafka log volume size must be between 100 GB and 16 TB."
  }
}

variable "kafka_log_volume_iops" {
  description = "IOPS for Kafka log volumes (GP3)"
  type        = number
  default     = 6000

  validation {
    condition     = var.kafka_log_volume_iops >= 3000 && var.kafka_log_volume_iops <= 16000
    error_message = "Kafka log volume IOPS must be between 3000 and 16000 for optimal performance."
  }
}

variable "kafka_log_volume_throughput" {
  description = "Throughput for Kafka log volumes (MB/s)"
  type        = number
  default     = 250

  validation {
    condition     = var.kafka_log_volume_throughput >= 125 && var.kafka_log_volume_throughput <= 1000
    error_message = "Kafka log volume throughput must be between 125 and 1000 MB/s."
  }
}

variable "use_kraft_mode" {
  description = "Use KRaft mode instead of ZooKeeper (recommended for new clusters)"
  type        = bool
  default     = true
}

# ZooKeeper variables (only used if use_kraft_mode = false)
variable "zookeeper_instance_type" {
  description = "Instance type for ZooKeeper nodes"
  type        = string
  default     = "m5.large"

  validation {
    condition = contains([
      "m5.large", "m5.xlarge", "m5.2xlarge",
      "c5.large", "c5.xlarge", "c5.2xlarge",
      "t3.medium", "t3.large", "t3.xlarge"
    ], var.zookeeper_instance_type)
    error_message = "ZooKeeper instance type must be suitable for coordination services."
  }
}

# Schema Registry variables
variable "schema_registry_instance_type" {
  description = "Instance type for Schema Registry"
  type        = string
  default     = "m5.large"

  validation {
    condition = contains([
      "m5.large", "m5.xlarge", "m5.2xlarge",
      "c5.large", "c5.xlarge", "c5.2xlarge",
      "t3.medium", "t3.large", "t3.xlarge"
    ], var.schema_registry_instance_type)
    error_message = "Schema Registry instance type must be suitable for schema management."
  }
}

# Monitoring variables
variable "monitoring_instance_type" {
  description = "Instance type for monitoring stack (Prometheus, Grafana, ELK)"
  type        = string
  default     = "m5.xlarge"

  validation {
    condition = contains([
      "m5.large", "m5.xlarge", "m5.2xlarge", "m5.4xlarge",
      "c5.large", "c5.xlarge", "c5.2xlarge", "c5.4xlarge",
      "r5.large", "r5.xlarge", "r5.2xlarge", "r5.4xlarge"
    ], var.monitoring_instance_type)
    error_message = "Monitoring instance type must be suitable for observability stack."
  }
}

# Performance tuning variables
variable "kafka_heap_size" {
  description = "Kafka JVM heap size (e.g., '4g', '8g')"
  type        = string
  default     = "6g"

  validation {
    condition     = can(regex("^[0-9]+[gG]$", var.kafka_heap_size))
    error_message = "Kafka heap size must be in format like '4g' or '8g'."
  }
}

variable "kafka_num_network_threads" {
  description = "Number of network threads for Kafka brokers"
  type        = number
  default     = 8

  validation {
    condition     = var.kafka_num_network_threads >= 3 && var.kafka_num_network_threads <= 16
    error_message = "Kafka network threads must be between 3 and 16."
  }
}

variable "kafka_num_io_threads" {
  description = "Number of I/O threads for Kafka brokers"
  type        = number
  default     = 16

  validation {
    condition     = var.kafka_num_io_threads >= 8 && var.kafka_num_io_threads <= 32
    error_message = "Kafka I/O threads must be between 8 and 32."
  }
}

variable "kafka_socket_send_buffer_bytes" {
  description = "Socket send buffer size for Kafka brokers"
  type        = number
  default     = 102400

  validation {
    condition     = var.kafka_socket_send_buffer_bytes >= 65536
    error_message = "Kafka socket send buffer must be at least 64KB."
  }
}

variable "kafka_socket_receive_buffer_bytes" {
  description = "Socket receive buffer size for Kafka brokers"
  type        = number
  default     = 102400

  validation {
    condition     = var.kafka_socket_receive_buffer_bytes >= 65536
    error_message = "Kafka socket receive buffer must be at least 64KB."
  }
}

variable "kafka_num_replica_fetchers" {
  description = "Number of replica fetcher threads"
  type        = number
  default     = 4

  validation {
    condition     = var.kafka_num_replica_fetchers >= 1 && var.kafka_num_replica_fetchers <= 8
    error_message = "Kafka replica fetchers must be between 1 and 8."
  }
}

variable "kafka_log_retention_hours" {
  description = "Log retention period in hours"
  type        = number
  default     = 168 # 7 days

  validation {
    condition     = var.kafka_log_retention_hours >= 1
    error_message = "Log retention must be at least 1 hour."
  }
}

variable "kafka_log_segment_bytes" {
  description = "Log segment size in bytes"
  type        = number
  default     = 1073741824 # 1GB

  validation {
    condition     = var.kafka_log_segment_bytes >= 134217728 # 128MB minimum
    error_message = "Log segment size must be at least 128MB."
  }
}

# Security variables
variable "enable_ssl" {
  description = "Enable SSL/TLS encryption for Kafka"
  type        = bool
  default     = true
}

variable "enable_sasl" {
  description = "Enable SASL authentication for Kafka"
  type        = bool
  default     = true
}

variable "ssl_keystore_password" {
  description = "Password for SSL keystore"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ssl_truststore_password" {
  description = "Password for SSL truststore"
  type        = string
  sensitive   = true
  default     = ""
}

# Monitoring and alerting
variable "enable_jmx_monitoring" {
  description = "Enable JMX monitoring for Kafka brokers"
  type        = bool
  default     = true
}

variable "prometheus_retention_days" {
  description = "Prometheus data retention period in days"
  type        = number
  default     = 15

  validation {
    condition     = var.prometheus_retention_days >= 1 && var.prometheus_retention_days <= 365
    error_message = "Prometheus retention must be between 1 and 365 days."
  }
}

variable "grafana_admin_password" {
  description = "Admin password for Grafana"
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = length(var.grafana_admin_password) >= 8
    error_message = "Grafana admin password must be at least 8 characters long."
  }
}

# Backup and disaster recovery
variable "enable_automated_backups" {
  description = "Enable automated EBS snapshots"
  type        = bool
  default     = true
}

variable "backup_retention_days" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "Backup retention must be between 1 and 35 days."
  }
}

# Cost optimization
variable "enable_spot_instances" {
  description = "Use spot instances for non-critical components (monitoring, etc.)"
  type        = bool
  default     = false
}

variable "spot_max_price" {
  description = "Maximum price for spot instances as percentage of on-demand (0.1-1.0)"
  type        = number
  default     = 0.7

  validation {
    condition     = var.spot_max_price >= 0.1 && var.spot_max_price <= 1.0
    error_message = "Spot max price must be between 0.1 and 1.0 (10%-100% of on-demand)."
  }
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "project_tag" {
  description = "Project tag for cost allocation"
  type        = string
  default     = "kafka-infrastructure"
}

variable "owner_tag" {
  description = "Owner tag for resource management"
  type        = string
  default     = "platform-team"
}

# Multi-AZ and rack awareness
variable "availability_zones" {
  description = "List of availability zones (leave empty for automatic selection)"
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.availability_zones) == 0 || length(var.availability_zones) >= 3
    error_message = "Must specify at least 3 availability zones or leave empty for automatic selection."
  }
}