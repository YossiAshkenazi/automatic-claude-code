# Dual Agent Monitor - Production Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Options](#infrastructure-options)
4. [Docker Compose Deployment](#docker-compose-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Cloud Provider Deployments](#cloud-provider-deployments)
7. [SSL Certificate Configuration](#ssl-certificate-configuration)
8. [Monitoring and Observability](#monitoring-and-observability)
9. [Security Configuration](#security-configuration)
10. [Backup and Recovery](#backup-and-recovery)
11. [Scaling and High Availability](#scaling-and-high-availability)
12. [Troubleshooting](#troubleshooting)
13. [Maintenance](#maintenance)

## Overview

This guide provides comprehensive instructions for deploying the Dual Agent Monitor system to production environments. The system supports multiple deployment architectures:

- **Single Server Deployment** - Docker Compose based deployment for smaller installations
- **Kubernetes Deployment** - Container orchestration for scalable deployments
- **Cloud Provider Deployment** - Infrastructure as Code using Terraform for AWS, Azure, or GCP

## Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 1Gbps

**Recommended Production:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 50GB+ SSD
- Network: 1Gbps+
- Load balancer with SSL termination

### Software Prerequisites

```bash
# Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo pip install docker-compose

# Node.js and pnpm (for building from source)
curl -fsSL https://nodejs.org/dist/v20.x/node-v20.x.x-linux-x64.tar.xz
pnpm install -g pnpm

# Additional tools
sudo apt-get install -y git nginx certbot openssl
```

### Environment Preparation

1. **Create deployment user:**
```bash
sudo useradd -m -s /bin/bash dual-agent-deploy
sudo usermod -aG docker dual-agent-deploy
```

2. **Create directory structure:**
```bash
sudo mkdir -p /opt/dual-agent-monitor
sudo mkdir -p /var/log/dual-agent-monitor
sudo mkdir -p /var/backups/dual-agent-monitor
sudo chown -R dual-agent-deploy:dual-agent-deploy /opt/dual-agent-monitor
```

3. **Clone repository:**
```bash
cd /opt/dual-agent-monitor
git clone https://github.com/your-org/automatic-claude-code.git .
cd dual-agent-monitor
```

## Infrastructure Options

### Option 1: Single Server with Docker Compose

**Pros:**
- Simple setup and maintenance
- Cost-effective for smaller deployments
- All services on one machine

**Cons:**
- Single point of failure
- Limited scaling options
- Resource contention

**Use Case:** Development, staging, small production deployments (<1000 users)

### Option 2: Kubernetes Cluster

**Pros:**
- High availability and fault tolerance
- Horizontal scaling capabilities
- Service mesh and advanced networking
- Rolling deployments

**Cons:**
- Complex setup and management
- Higher resource overhead
- Requires Kubernetes expertise

**Use Case:** Large production deployments, multi-environment setups

### Option 3: Cloud Provider Managed Services

**Pros:**
- Managed infrastructure components
- Built-in scaling and backup
- Integration with cloud services
- Monitoring and alerting

**Cons:**
- Vendor lock-in
- Higher costs
- Less control over infrastructure

**Use Case:** Enterprise deployments, teams preferring managed services

## Docker Compose Deployment

### Step 1: Configuration

1. **Copy environment template:**
```bash
cp deploy/.env.production .env.production
```

2. **Edit configuration:**
```bash
vim .env.production
```

Required settings:
```env
# Basic configuration
DOMAIN=your-domain.com
NODE_ENV=production

# Database
POSTGRES_PASSWORD=your-secure-postgres-password-here

# Redis
REDIS_PASSWORD=your-secure-redis-password-here

# Application secrets (generate with: openssl rand -hex 32)
JWT_SECRET=your-32-character-jwt-secret-here
SESSION_SECRET=your-32-character-session-secret-here

# SSL
SSL_EMAIL=admin@your-domain.com

# Monitoring
GRAFANA_PASSWORD=your-grafana-admin-password
```

### Step 2: SSL Certificate Setup

**Option A: Let's Encrypt (Recommended)**
```bash
sudo ./deploy/security/ssl-setup.sh \
  --domain your-domain.com \
  --email admin@your-domain.com
```

**Option B: Manual Certificate**
```bash
sudo ./deploy/security/ssl-setup.sh \
  --domain your-domain.com \
  --manual-cert /path/to/your/certificates
```

### Step 3: Build and Deploy

```bash
# Build application
pnpm install --frozen-lockfile
pnpm run build:validate

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### Step 4: Verify Deployment

```bash
# Check application health
curl -f https://your-domain.com/health

# Check logs
docker-compose -f docker-compose.prod.yml logs -f dual-agent-monitor

# Access monitoring
# Grafana: https://your-domain.com:3000 (admin/your-grafana-password)
# Prometheus: https://your-domain.com:9090
```

## Kubernetes Deployment

### Step 1: Cluster Preparation

**Create namespace:**
```bash
kubectl apply -f deploy/kubernetes/namespace.yaml
```

**Configure secrets:**
```bash
# Edit secrets with your values
vim deploy/kubernetes/secrets.yaml

# Apply secrets
kubectl apply -f deploy/kubernetes/secrets.yaml
```

### Step 2: Storage Configuration

**Create storage classes (if needed):**
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  fsType: ext4
allowVolumeExpansion: true
```

### Step 3: Deploy Infrastructure Components

```bash
# Deploy in order:
kubectl apply -f deploy/kubernetes/configmap.yaml
kubectl apply -f deploy/kubernetes/postgres.yaml
kubectl apply -f deploy/kubernetes/redis.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n dual-agent-monitor --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n dual-agent-monitor --timeout=300s
```

### Step 4: Deploy Application

```bash
# Deploy application
kubectl apply -f deploy/kubernetes/application.yaml

# Deploy load balancer
kubectl apply -f deploy/kubernetes/nginx.yaml

# Deploy monitoring (optional)
kubectl apply -f deploy/kubernetes/monitoring.yaml
```

### Step 5: Configure Ingress

```bash
# Update domain in ingress configuration
sed -i 's/your-domain.com/actual-domain.com/g' deploy/kubernetes/nginx.yaml

# Apply ingress
kubectl apply -f deploy/kubernetes/nginx.yaml

# Check ingress status
kubectl get ingress -n dual-agent-monitor
```

### Step 6: Verify Deployment

```bash
# Check all pods
kubectl get pods -n dual-agent-monitor

# Check services
kubectl get services -n dual-agent-monitor

# Check logs
kubectl logs -f deployment/dual-agent-monitor -n dual-agent-monitor

# Port forward for testing (if needed)
kubectl port-forward service/dual-agent-monitor-service 8080:8080 -n dual-agent-monitor
```

## Cloud Provider Deployments

### AWS Deployment with Terraform

1. **Prerequisites:**
```bash
# Install AWS CLI and Terraform
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Install Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

2. **Configure AWS credentials:**
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

3. **Deploy infrastructure:**
```bash
cd deploy/terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars
cat > terraform.tfvars <<EOF
project_name = "dual-agent-monitor"
environment = "prod"
region = "us-east-1"
domain_name = "your-domain.com"

# Database configuration
db_instance_class = "db.t3.micro"
db_master_password = "your-secure-database-password"

# Application configuration
app_instance_type = "t3.small"
app_min_capacity = 2
app_max_capacity = 10

# Security
allowed_cidr_blocks = ["0.0.0.0/0"]  # Restrict as needed
enable_waf = true

# Secrets
jwt_secret = "your-32-character-jwt-secret"
session_secret = "your-32-character-session-secret"
redis_auth_token = "your-redis-password"

# Notifications
notification_email = "admin@your-domain.com"
slack_webhook_url = "https://hooks.slack.com/services/..."
EOF

# Plan deployment
terraform plan

# Deploy
terraform apply
```

4. **Configure application:**
```bash
# Get outputs
terraform output

# SSH to application server
ssh -i ssh-key-dual-agent-monitor-prod.pem ec2-user@$(terraform output bastion_host_ip)

# Deploy application using Docker Compose or configure auto-deployment
```

### Azure Deployment

```bash
cd deploy/terraform

# Login to Azure
az login

# Select subscription
az account set --subscription "your-subscription-id"

# Deploy with Azure provider
terraform init
terraform plan -var-file="azure.tfvars"
terraform apply -var-file="azure.tfvars"
```

### Google Cloud Deployment

```bash
cd deploy/terraform

# Login to GCP
gcloud auth application-default login

# Set project
gcloud config set project your-project-id

# Deploy with GCP provider
terraform init
terraform plan -var-file="gcp.tfvars"
terraform apply -var-file="gcp.tfvars"
```

## SSL Certificate Configuration

### Automated Let's Encrypt

```bash
# Production certificate
sudo ./deploy/security/ssl-setup.sh \
  --domain your-domain.com \
  --email admin@your-domain.com

# Staging certificate (for testing)
sudo ./deploy/security/ssl-setup.sh \
  --domain staging.your-domain.com \
  --email admin@your-domain.com \
  --staging
```

### Manual Certificate Installation

1. **Prepare certificate files:**
```
/path/to/certificates/
├── fullchain.pem    # Full certificate chain
├── privkey.pem      # Private key
└── dhparam.pem      # DH parameters (optional)
```

2. **Install certificate:**
```bash
sudo ./deploy/security/ssl-setup.sh \
  --domain your-domain.com \
  --manual-cert /path/to/certificates
```

### Certificate Renewal

**Automatic renewal** is set up during installation. Manual renewal:

```bash
# Renew Let's Encrypt certificate
sudo ./deploy/security/ssl-setup.sh \
  --domain your-domain.com \
  --renew

# Test renewal process
sudo certbot renew --dry-run
```

## Monitoring and Observability

### Prometheus Configuration

1. **Access Prometheus:**
   - URL: `https://your-domain.com:9090`
   - Default metrics retention: 30 days

2. **Key metrics to monitor:**
   - `up{job="dual-agent-monitor"}` - Application availability
   - `http_requests_total` - Request rates
   - `http_request_duration_seconds` - Response times
   - `agent_tasks_completed_total` - Agent performance

### Grafana Dashboards

1. **Access Grafana:**
   - URL: `https://your-domain.com:3000`
   - Username: `admin`
   - Password: Set in `.env.production`

2. **Import dashboards:**
   - Main dashboard is auto-provisioned
   - Additional dashboards in `deploy/monitoring/grafana/dashboards/`

### Log Management

**Docker Compose:**
```bash
# View application logs
docker-compose logs -f dual-agent-monitor

# View all service logs
docker-compose logs -f
```

**Kubernetes:**
```bash
# Application logs
kubectl logs -f deployment/dual-agent-monitor -n dual-agent-monitor

# All pods logs
kubectl logs -f -l app=dual-agent-monitor -n dual-agent-monitor
```

### Alerting

**Configure alert notifications:**

1. **Edit alert manager configuration:**
```yaml
# deploy/monitoring/alertmanager/alertmanager.yml
global:
  smtp_smarthost: 'your-smtp-server:587'
  smtp_from: 'alerts@your-domain.com'

receivers:
  - name: 'default-receiver'
    email_configs:
      - to: 'admin@your-domain.com'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/...'
        channel: '#alerts'
```

2. **Test alerts:**
```bash
# Trigger test alert
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning"
    },
    "annotations": {
      "summary": "Test alert from deployment"
    }
  }]'
```

## Security Configuration

### Firewall Setup

```bash
# Configure firewall rules
sudo ./deploy/security/firewall-rules.sh setup

# Allow additional IP range
sudo ./deploy/security/firewall-rules.sh --allow-ip 203.0.113.0/24 setup

# Check firewall status
sudo ./deploy/security/firewall-rules.sh status
```

### Security Headers

**Nginx security headers** are automatically configured in `deploy/nginx.conf`. Key headers include:

- `Strict-Transport-Security` - HSTS enforcement
- `Content-Security-Policy` - XSS protection
- `X-Frame-Options` - Clickjacking protection
- `X-Content-Type-Options` - MIME sniffing protection

### Access Control

1. **Database access:**
   - Only accessible from application servers
   - Strong passwords enforced
   - SSL connections required

2. **Redis access:**
   - Authentication required
   - Network restricted to application servers
   - TLS encryption enabled

3. **Admin interfaces:**
   - IP-restricted access to monitoring dashboards
   - Strong authentication required
   - Regular password rotation

## Backup and Recovery

### Automated Backups

**Docker Compose:**
```bash
# Set up automated backups
./scripts/backup-database.sh

# Schedule in crontab
echo "0 2 * * * /opt/dual-agent-monitor/scripts/backup-database.sh" | crontab -
```

**Kubernetes:**
```bash
# Create backup job
kubectl create job --from=cronjob/backup-job backup-manual -n dual-agent-monitor
```

### Manual Backup

```bash
# Database backup
docker exec dual-agent-monitor-postgres-1 pg_dump \
  -U postgres dual_agent_monitor > backup_$(date +%Y%m%d).sql

# Application data backup
docker run --rm \
  -v dual-agent-monitor_app_data:/data:ro \
  -v $(pwd):/backup \
  alpine tar -czf /backup/app_data_$(date +%Y%m%d).tar.gz -C /data .
```

### Recovery Procedures

**Database recovery:**
```bash
# Stop application
docker-compose stop dual-agent-monitor

# Restore database
docker exec -i dual-agent-monitor-postgres-1 psql \
  -U postgres dual_agent_monitor < backup_20241201.sql

# Start application
docker-compose start dual-agent-monitor
```

**Full system recovery:**
```bash
# Use emergency rollback
./scripts/rollback.sh emergency --force
```

## Scaling and High Availability

### Horizontal Scaling

**Docker Compose (limited):**
```bash
# Scale application instances
docker-compose up -d --scale dual-agent-monitor=3
```

**Kubernetes (recommended):**
```yaml
# Update replicas in application.yaml
spec:
  replicas: 5
  
# Apply changes
kubectl apply -f deploy/kubernetes/application.yaml

# Auto-scaling based on metrics
kubectl autoscale deployment dual-agent-monitor \
  --cpu-percent=70 --min=2 --max=10 -n dual-agent-monitor
```

### Load Balancing

**Nginx configuration** is included for load balancing multiple application instances. Key features:

- Health checks on `/health` endpoint
- Session affinity for WebSocket connections
- Rate limiting and DDoS protection
- SSL termination

### Database High Availability

**PostgreSQL clustering:**
```yaml
# Use PostgreSQL operator for Kubernetes
# Or set up streaming replication for Docker deployments
```

**Redis clustering:**
```yaml
# Configure Redis Sentinel for high availability
# Or use managed Redis services in cloud deployments
```

## Troubleshooting

### Common Issues

**1. Application not starting:**
```bash
# Check logs
docker-compose logs dual-agent-monitor

# Common causes:
# - Database connection failure
# - Missing environment variables
# - Port conflicts
```

**2. Database connection errors:**
```bash
# Check database status
docker-compose ps postgres

# Test connection
docker exec dual-agent-monitor-postgres-1 pg_isready

# Check configuration
grep DATABASE_URL .env.production
```

**3. SSL certificate issues:**
```bash
# Test SSL configuration
./deploy/security/ssl-setup.sh --domain your-domain.com test

# Check certificate expiry
openssl x509 -enddate -noout -in /etc/nginx/ssl/fullchain.pem

# Renew certificate
sudo certbot renew --force-renewal
```

**4. Performance issues:**
```bash
# Check system resources
docker stats

# Check application metrics
curl https://your-domain.com/metrics

# Scale application
docker-compose up -d --scale dual-agent-monitor=2
```

### Health Checks

**Automated health monitoring:**
```bash
# Run comprehensive health check
./scripts/health-check.sh

# Check specific components
./scripts/health-check.sh --verbose
```

**Manual checks:**
```bash
# Application health
curl -f https://your-domain.com/health

# API health
curl -f https://your-domain.com/api/health

# Database health
docker exec dual-agent-monitor-postgres-1 pg_isready

# Redis health
docker exec dual-agent-monitor-redis-1 redis-cli ping
```

### Log Analysis

**Important log locations:**
- Application: `/var/log/dual-agent-monitor/app.log`
- Nginx: `/var/log/nginx/`
- System: `/var/log/syslog`

**Log analysis commands:**
```bash
# Recent errors
tail -n 100 /var/log/dual-agent-monitor/app.log | grep ERROR

# Failed authentication attempts
grep "Authentication failed" /var/log/dual-agent-monitor/app.log

# Performance issues
grep "slow query\|timeout" /var/log/dual-agent-monitor/app.log
```

## Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor system health and alerts
- Check backup completion
- Review security logs

**Weekly:**
- Update system packages
- Review performance metrics
- Clean up old logs and backups

**Monthly:**
- Update application dependencies
- Review and rotate passwords
- Test backup recovery procedures
- Update SSL certificates (if not auto-renewed)

### Update Procedures

**Application updates:**
```bash
# Backup current state
./scripts/backup-database.sh

# Pull latest code
git pull origin main

# Build new version
pnpm install --frozen-lockfile
pnpm run build

# Deploy with rolling update
docker-compose up -d --no-deps dual-agent-monitor

# Verify deployment
curl -f https://your-domain.com/health
```

**System updates:**
```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Restart services if needed
docker-compose restart
```

### Monitoring Maintenance

**Prometheus data retention:**
```bash
# Clean old metrics (if disk space is low)
docker exec dual-agent-monitor-prometheus-1 \
  promtool query range --start=-30d --end=-7d 'up' | wc -l
```

**Grafana maintenance:**
```bash
# Backup Grafana dashboards
docker exec dual-agent-monitor-grafana-1 \
  tar -czf - /var/lib/grafana/dashboards > grafana-dashboards-backup.tar.gz
```

### Security Maintenance

**Certificate renewal:**
```bash
# Check certificate expiry
./deploy/security/ssl-setup.sh --domain your-domain.com test

# Renew if needed
sudo certbot renew
```

**Security updates:**
```bash
# Update security policies
sudo ./deploy/security/firewall-rules.sh setup

# Review access logs
tail -n 1000 /var/log/nginx/access.log | grep -v "200\|301\|304"

# Update fail2ban rules
sudo systemctl status fail2ban
sudo fail2ban-client status
```

### Disaster Recovery

**Emergency procedures:**

1. **Application rollback:**
```bash
./scripts/rollback.sh emergency --force
```

2. **Database recovery:**
```bash
# Find latest backup
ls -la /var/backups/dual-agent-monitor/

# Restore database
./scripts/rollback.sh database --backup-timestamp 20241201_020000
```

3. **Full system recovery:**
```bash
# From infrastructure backup
terraform destroy  # if needed
terraform apply

# Restore data
./scripts/rollback.sh full --backup-id backup_20241201_020000
```

---

## Support and Contact

For deployment issues or questions:

- **Documentation**: [Link to detailed docs]
- **Issue Tracker**: [GitHub issues URL]  
- **Support Email**: support@your-domain.com
- **Emergency Contact**: +1-xxx-xxx-xxxx

**Remember to:**
- Keep this documentation updated with your specific configuration
- Test all procedures in a staging environment first  
- Maintain regular backups and test recovery procedures
- Monitor security advisories and apply updates promptly