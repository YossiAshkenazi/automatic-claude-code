# Kafka Infrastructure as Code
# High-performance Kafka cluster with 3 brokers, rack awareness, and 100K+ msgs/sec capacity

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Data sources for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# VPC for Kafka cluster
resource "aws_vpc" "kafka_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.cluster_name}-vpc"
    Environment = var.environment
    Project     = "kafka-infrastructure"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "kafka_igw" {
  vpc_id = aws_vpc.kafka_vpc.id

  tags = {
    Name        = "${var.cluster_name}-igw"
    Environment = var.environment
  }
}

# Private subnets for Kafka brokers (one per AZ)
resource "aws_subnet" "kafka_private" {
  count = 3

  vpc_id            = aws_vpc.kafka_vpc.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 1)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "${var.cluster_name}-private-${count.index + 1}"
    Environment = var.environment
    Tier        = "private"
    AZ          = data.aws_availability_zones.available.names[count.index]
  }
}

# Public subnets for NAT gateways
resource "aws_subnet" "kafka_public" {
  count = 3

  vpc_id                  = aws_vpc.kafka_vpc.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.cluster_name}-public-${count.index + 1}"
    Environment = var.environment
    Tier        = "public"
  }
}

# Elastic IPs for NAT gateways
resource "aws_eip" "kafka_nat" {
  count = 3

  domain = "vpc"
  depends_on = [aws_internet_gateway.kafka_igw]

  tags = {
    Name        = "${var.cluster_name}-nat-eip-${count.index + 1}"
    Environment = var.environment
  }
}

# NAT gateways for private subnet internet access
resource "aws_nat_gateway" "kafka_nat" {
  count = 3

  allocation_id = aws_eip.kafka_nat[count.index].id
  subnet_id     = aws_subnet.kafka_public[count.index].id

  tags = {
    Name        = "${var.cluster_name}-nat-${count.index + 1}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.kafka_igw]
}

# Route tables for private subnets
resource "aws_route_table" "kafka_private" {
  count = 3

  vpc_id = aws_vpc.kafka_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.kafka_nat[count.index].id
  }

  tags = {
    Name        = "${var.cluster_name}-private-rt-${count.index + 1}"
    Environment = var.environment
  }
}

# Route table for public subnets
resource "aws_route_table" "kafka_public" {
  vpc_id = aws_vpc.kafka_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.kafka_igw.id
  }

  tags = {
    Name        = "${var.cluster_name}-public-rt"
    Environment = var.environment
  }
}

# Route table associations
resource "aws_route_table_association" "kafka_private" {
  count = 3

  subnet_id      = aws_subnet.kafka_private[count.index].id
  route_table_id = aws_route_table.kafka_private[count.index].id
}

resource "aws_route_table_association" "kafka_public" {
  count = 3

  subnet_id      = aws_subnet.kafka_public[count.index].id
  route_table_id = aws_route_table.kafka_public.id
}

# Security group for Kafka brokers
resource "aws_security_group" "kafka_brokers" {
  name        = "${var.cluster_name}-brokers"
  description = "Security group for Kafka brokers"
  vpc_id      = aws_vpc.kafka_vpc.id

  # Kafka broker communication
  ingress {
    from_port = 9092
    to_port   = 9092
    protocol  = "tcp"
    self      = true
  }

  # Kafka SSL/TLS
  ingress {
    from_port = 9093
    to_port   = 9093
    protocol  = "tcp"
    self      = true
  }

  # Kafka inter-broker communication
  ingress {
    from_port = 9094
    to_port   = 9094
    protocol  = "tcp"
    self      = true
  }

  # JMX monitoring
  ingress {
    from_port = 9999
    to_port   = 9999
    protocol  = "tcp"
    self      = true
  }

  # SSH access
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.cluster_name}-brokers-sg"
    Environment = var.environment
  }
}

# Security group for ZooKeeper (if not using KRaft)
resource "aws_security_group" "zookeeper" {
  count = var.use_kraft_mode ? 0 : 1

  name        = "${var.cluster_name}-zookeeper"
  description = "Security group for ZooKeeper ensemble"
  vpc_id      = aws_vpc.kafka_vpc.id

  # ZooKeeper client port
  ingress {
    from_port       = 2181
    to_port         = 2181
    protocol        = "tcp"
    security_groups = [aws_security_group.kafka_brokers.id]
  }

  # ZooKeeper peer communication
  ingress {
    from_port = 2888
    to_port   = 2888
    protocol  = "tcp"
    self      = true
  }

  # ZooKeeper leader election
  ingress {
    from_port = 3888
    to_port   = 3888
    protocol  = "tcp"
    self      = true
  }

  # SSH access
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.cluster_name}-zookeeper-sg"
    Environment = var.environment
  }
}

# Security group for monitoring
resource "aws_security_group" "monitoring" {
  name        = "${var.cluster_name}-monitoring"
  description = "Security group for monitoring stack"
  vpc_id      = aws_vpc.kafka_vpc.id

  # Prometheus
  ingress {
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # Grafana
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # ElasticSearch
  ingress {
    from_port   = 9200
    to_port     = 9200
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # Kibana
  ingress {
    from_port   = 5601
    to_port     = 5601
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  # SSH access
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.cluster_name}-monitoring-sg"
    Environment = var.environment
  }
}

# Key pair for EC2 instances
resource "aws_key_pair" "kafka_key" {
  key_name   = "${var.cluster_name}-key"
  public_key = var.public_key
}

# ZooKeeper instances (if not using KRaft)
resource "aws_instance" "zookeeper" {
  count = var.use_kraft_mode ? 0 : 3

  ami                    = var.ami_id
  instance_type          = var.zookeeper_instance_type
  key_name              = aws_key_pair.kafka_key.key_name
  subnet_id             = aws_subnet.kafka_private[count.index].id
  vpc_security_group_ids = [aws_security_group.zookeeper[0].id]
  availability_zone     = data.aws_availability_zones.available.names[count.index]

  root_block_device {
    volume_type           = "gp3"
    volume_size          = 100
    delete_on_termination = true
    encrypted            = true
  }

  # Additional EBS volume for ZooKeeper data
  ebs_block_device {
    device_name           = "/dev/sdf"
    volume_type          = "gp3"
    volume_size          = 200
    delete_on_termination = true
    encrypted            = true
    iops                 = 3000
    throughput           = 125
  }

  user_data = base64encode(templatefile("${path.module}/user-data/zookeeper.sh", {
    zookeeper_id = count.index + 1
    cluster_name = var.cluster_name
  }))

  tags = {
    Name        = "${var.cluster_name}-zookeeper-${count.index + 1}"
    Environment = var.environment
    Role        = "zookeeper"
    AZ          = data.aws_availability_zones.available.names[count.index]
  }
}

# Kafka broker instances
resource "aws_instance" "kafka_brokers" {
  count = 3

  ami                    = var.ami_id
  instance_type          = var.kafka_instance_type
  key_name              = aws_key_pair.kafka_key.key_name
  subnet_id             = aws_subnet.kafka_private[count.index].id
  vpc_security_group_ids = [aws_security_group.kafka_brokers.id]
  availability_zone     = data.aws_availability_zones.available.names[count.index]

  root_block_device {
    volume_type           = "gp3"
    volume_size          = 100
    delete_on_termination = true
    encrypted            = true
  }

  # Kafka logs volume - high performance SSD
  ebs_block_device {
    device_name           = "/dev/sdf"
    volume_type          = "gp3"
    volume_size          = var.kafka_log_volume_size
    delete_on_termination = true
    encrypted            = true
    iops                 = var.kafka_log_volume_iops
    throughput           = var.kafka_log_volume_throughput
  }

  user_data = base64encode(templatefile("${path.module}/user-data/kafka.sh", {
    broker_id    = count.index + 1
    cluster_name = var.cluster_name
    use_kraft    = var.use_kraft_mode
  }))

  tags = {
    Name        = "${var.cluster_name}-broker-${count.index + 1}"
    Environment = var.environment
    Role        = "kafka-broker"
    AZ          = data.aws_availability_zones.available.names[count.index]
    RackId      = "rack-${count.index + 1}"
  }
}

# Application Load Balancer for Kafka client access
resource "aws_lb" "kafka_alb" {
  name               = "${var.cluster_name}-alb"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [aws_security_group.kafka_brokers.id]
  subnets            = aws_subnet.kafka_private[*].id

  enable_deletion_protection = false

  tags = {
    Name        = "${var.cluster_name}-alb"
    Environment = var.environment
  }
}

# Target group for Kafka brokers
resource "aws_lb_target_group" "kafka_brokers" {
  name     = "${var.cluster_name}-brokers"
  port     = 9092
  protocol = "HTTP"
  vpc_id   = aws_vpc.kafka_vpc.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "9092"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name        = "${var.cluster_name}-brokers-tg"
    Environment = var.environment
  }
}

# ALB listener for Kafka
resource "aws_lb_listener" "kafka" {
  load_balancer_arn = aws_lb.kafka_alb.arn
  port              = "9092"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.kafka_brokers.arn
  }
}

# Target group attachments
resource "aws_lb_target_group_attachment" "kafka_brokers" {
  count = 3

  target_group_arn = aws_lb_target_group.kafka_brokers.arn
  target_id        = aws_instance.kafka_brokers[count.index].id
  port             = 9092
}

# Schema Registry instance
resource "aws_instance" "schema_registry" {
  ami                    = var.ami_id
  instance_type          = var.schema_registry_instance_type
  key_name              = aws_key_pair.kafka_key.key_name
  subnet_id             = aws_subnet.kafka_private[0].id
  vpc_security_group_ids = [aws_security_group.kafka_brokers.id]

  root_block_device {
    volume_type           = "gp3"
    volume_size          = 50
    delete_on_termination = true
    encrypted            = true
  }

  user_data = base64encode(templatefile("${path.module}/user-data/schema-registry.sh", {
    cluster_name = var.cluster_name
  }))

  tags = {
    Name        = "${var.cluster_name}-schema-registry"
    Environment = var.environment
    Role        = "schema-registry"
  }
}

# Monitoring instance
resource "aws_instance" "monitoring" {
  ami                    = var.ami_id
  instance_type          = var.monitoring_instance_type
  key_name              = aws_key_pair.kafka_key.key_name
  subnet_id             = aws_subnet.kafka_private[0].id
  vpc_security_group_ids = [aws_security_group.monitoring.id]

  root_block_device {
    volume_type           = "gp3"
    volume_size          = 100
    delete_on_termination = true
    encrypted            = true
  }

  # Additional volume for monitoring data
  ebs_block_device {
    device_name           = "/dev/sdf"
    volume_type          = "gp3"
    volume_size          = 500
    delete_on_termination = true
    encrypted            = true
    iops                 = 3000
    throughput           = 125
  }

  user_data = base64encode(templatefile("${path.module}/user-data/monitoring.sh", {
    cluster_name = var.cluster_name
  }))

  tags = {
    Name        = "${var.cluster_name}-monitoring"
    Environment = var.environment
    Role        = "monitoring"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "kafka" {
  name              = "/aws/kafka/${var.cluster_name}"
  retention_in_days = 30

  tags = {
    Name        = "${var.cluster_name}-logs"
    Environment = var.environment
  }
}