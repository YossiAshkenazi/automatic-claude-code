# Outputs for Kafka Infrastructure
# Critical endpoints and connection information for 100K+ msgs/sec cluster

# Network Information
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.kafka_vpc.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.kafka_vpc.cidr_block
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.kafka_private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.kafka_public[*].id
}

output "availability_zones" {
  description = "Availability zones used for the cluster"
  value       = data.aws_availability_zones.available.names
}

# Kafka Cluster Information
output "kafka_broker_ids" {
  description = "Instance IDs of Kafka brokers"
  value       = aws_instance.kafka_brokers[*].id
}

output "kafka_broker_private_ips" {
  description = "Private IP addresses of Kafka brokers"
  value       = aws_instance.kafka_brokers[*].private_ip
}

output "kafka_broker_dns_names" {
  description = "Private DNS names of Kafka brokers"
  value       = aws_instance.kafka_brokers[*].private_dns
}

output "kafka_broker_endpoints" {
  description = "Kafka broker endpoints for client connections"
  value       = [for i, broker in aws_instance.kafka_brokers : "${broker.private_ip}:9092"]
}

output "kafka_ssl_endpoints" {
  description = "Kafka SSL/TLS endpoints for secure connections"
  value       = [for i, broker in aws_instance.kafka_brokers : "${broker.private_ip}:9093"]
}

output "kafka_bootstrap_servers" {
  description = "Comma-separated list of Kafka bootstrap servers"
  value       = join(",", [for broker in aws_instance.kafka_brokers : "${broker.private_ip}:9092"])
}

output "kafka_ssl_bootstrap_servers" {
  description = "Comma-separated list of Kafka SSL bootstrap servers"
  value       = join(",", [for broker in aws_instance.kafka_brokers : "${broker.private_ip}:9093"])
}

# Load Balancer Information
output "kafka_load_balancer_dns" {
  description = "DNS name of the Kafka Application Load Balancer"
  value       = aws_lb.kafka_alb.dns_name
}

output "kafka_load_balancer_zone_id" {
  description = "Zone ID of the Kafka Application Load Balancer"
  value       = aws_lb.kafka_alb.zone_id
}

output "kafka_load_balancer_endpoint" {
  description = "Load balancer endpoint for Kafka clients"
  value       = "${aws_lb.kafka_alb.dns_name}:9092"
}

# ZooKeeper Information (if not using KRaft mode)
output "zookeeper_instance_ids" {
  description = "Instance IDs of ZooKeeper nodes"
  value       = var.use_kraft_mode ? [] : aws_instance.zookeeper[*].id
}

output "zookeeper_private_ips" {
  description = "Private IP addresses of ZooKeeper nodes"
  value       = var.use_kraft_mode ? [] : aws_instance.zookeeper[*].private_ip
}

output "zookeeper_endpoints" {
  description = "ZooKeeper connection string"
  value       = var.use_kraft_mode ? "" : join(",", [for zk in aws_instance.zookeeper : "${zk.private_ip}:2181"])
}

# Schema Registry Information
output "schema_registry_instance_id" {
  description = "Instance ID of Schema Registry"
  value       = aws_instance.schema_registry.id
}

output "schema_registry_private_ip" {
  description = "Private IP address of Schema Registry"
  value       = aws_instance.schema_registry.private_ip
}

output "schema_registry_endpoint" {
  description = "Schema Registry REST API endpoint"
  value       = "http://${aws_instance.schema_registry.private_ip}:8081"
}

# Monitoring Information
output "monitoring_instance_id" {
  description = "Instance ID of monitoring server"
  value       = aws_instance.monitoring.id
}

output "monitoring_private_ip" {
  description = "Private IP address of monitoring server"
  value       = aws_instance.monitoring.private_ip
}

output "prometheus_endpoint" {
  description = "Prometheus web UI endpoint"
  value       = "http://${aws_instance.monitoring.private_ip}:9090"
}

output "grafana_endpoint" {
  description = "Grafana dashboard endpoint"
  value       = "http://${aws_instance.monitoring.private_ip}:3000"
}

output "kibana_endpoint" {
  description = "Kibana dashboard endpoint"
  value       = "http://${aws_instance.monitoring.private_ip}:5601"
}

output "elasticsearch_endpoint" {
  description = "Elasticsearch API endpoint"
  value       = "http://${aws_instance.monitoring.private_ip}:9200"
}

# Security Group Information
output "kafka_brokers_security_group_id" {
  description = "Security group ID for Kafka brokers"
  value       = aws_security_group.kafka_brokers.id
}

output "zookeeper_security_group_id" {
  description = "Security group ID for ZooKeeper (if used)"
  value       = var.use_kraft_mode ? "" : aws_security_group.zookeeper[0].id
}

output "monitoring_security_group_id" {
  description = "Security group ID for monitoring stack"
  value       = aws_security_group.monitoring.id
}

# Key Pair Information
output "key_pair_name" {
  description = "Name of the EC2 key pair"
  value       = aws_key_pair.kafka_key.key_name
}

# CloudWatch Log Group
output "cloudwatch_log_group" {
  description = "CloudWatch log group for Kafka cluster"
  value       = aws_cloudwatch_log_group.kafka.name
}

# Cluster Configuration Summary
output "cluster_summary" {
  description = "Summary of cluster configuration"
  value = {
    cluster_name    = var.cluster_name
    environment     = var.environment
    use_kraft_mode  = var.use_kraft_mode
    broker_count    = 3
    zookeeper_count = var.use_kraft_mode ? 0 : 3
    aws_region      = var.aws_region
    vpc_cidr        = var.vpc_cidr
  }
}

# Performance Configuration
output "performance_config" {
  description = "Performance configuration summary"
  value = {
    kafka_instance_type    = var.kafka_instance_type
    kafka_heap_size        = var.kafka_heap_size
    log_volume_size_gb     = var.kafka_log_volume_size
    log_volume_iops        = var.kafka_log_volume_iops
    log_volume_throughput  = var.kafka_log_volume_throughput
    network_threads        = var.kafka_num_network_threads
    io_threads             = var.kafka_num_io_threads
    expected_throughput    = "100K+ messages/second"
    target_availability    = "99.9%"
  }
}

# Security Configuration
output "security_config" {
  description = "Security configuration summary"
  value = {
    ssl_enabled           = var.enable_ssl
    sasl_enabled          = var.enable_sasl
    jmx_monitoring        = var.enable_jmx_monitoring
    encryption_at_rest    = true
    vpc_private_subnets   = true
    security_groups       = "restrictive"
  }
}

# Connection Instructions
output "client_connection_instructions" {
  description = "Instructions for connecting Kafka clients"
  value = {
    bootstrap_servers = join(",", [for broker in aws_instance.kafka_brokers : "${broker.private_ip}:9092"])
    ssl_bootstrap_servers = var.enable_ssl ? join(",", [for broker in aws_instance.kafka_brokers : "${broker.private_ip}:9093"]) : "SSL not enabled"
    load_balancer_endpoint = "${aws_lb.kafka_alb.dns_name}:9092"
    schema_registry = "http://${aws_instance.schema_registry.private_ip}:8081"
    security_protocol = var.enable_ssl ? (var.enable_sasl ? "SASL_SSL" : "SSL") : (var.enable_sasl ? "SASL_PLAINTEXT" : "PLAINTEXT")
    note = "Clients must be in the same VPC or have VPC peering/VPN connectivity"
  }
}

# Monitoring Access
output "monitoring_access" {
  description = "Monitoring dashboard access information"
  value = {
    grafana_url     = "http://${aws_instance.monitoring.private_ip}:3000"
    prometheus_url  = "http://${aws_instance.monitoring.private_ip}:9090"
    kibana_url      = "http://${aws_instance.monitoring.private_ip}:5601"
    elasticsearch_url = "http://${aws_instance.monitoring.private_ip}:9200"
    note           = "Access these URLs from within the VPC or via bastion host"
  }
}

# Operational Information
output "operational_info" {
  description = "Operational management information"
  value = {
    ssh_access = "Use key pair '${aws_key_pair.kafka_key.key_name}' to SSH into instances"
    log_location = "CloudWatch Log Group: ${aws_cloudwatch_log_group.kafka.name}"
    backup_enabled = var.enable_automated_backups
    rack_awareness = "Enabled across 3 availability zones"
    deployment_ready = "Infrastructure ready for Ansible configuration"
  }
}

# Resource ARNs (for IAM policies and automation)
output "resource_arns" {
  description = "ARNs of created resources for automation and IAM"
  value = {
    vpc_arn = aws_vpc.kafka_vpc.arn
    kafka_instance_arns = aws_instance.kafka_brokers[*].arn
    zookeeper_instance_arns = var.use_kraft_mode ? [] : aws_instance.zookeeper[*].arn
    schema_registry_arn = aws_instance.schema_registry.arn
    monitoring_instance_arn = aws_instance.monitoring.arn
    load_balancer_arn = aws_lb.kafka_alb.arn
    log_group_arn = aws_cloudwatch_log_group.kafka.arn
  }
}