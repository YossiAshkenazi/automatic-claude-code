#!/bin/bash
# Kafka Broker User Data Script
# Optimized for high-performance messaging (100K+ msgs/sec)

set -euo pipefail

# Variables from template
BROKER_ID=${broker_id}
CLUSTER_NAME=${cluster_name}
USE_KRAFT=${use_kraft}

# Logging
exec > >(tee /var/log/kafka-bootstrap.log)
exec 2>&1

echo "Starting Kafka broker bootstrap for broker ID: $BROKER_ID"

# Update system
yum update -y
yum install -y java-17-openjdk wget curl vim htop iotop sysstat net-tools

# Configure system for high performance
echo "Configuring system for high performance..."

# Kernel parameters
cat >> /etc/sysctl.conf << EOF
# Kafka performance tuning
vm.max_map_count=262144
vm.swappiness=1
net.core.rmem_max=134217728
net.core.wmem_max=134217728
net.ipv4.tcp_rmem=4096 87380 134217728
net.ipv4.tcp_wmem=4096 65536 134217728
net.core.netdev_max_backlog=5000
net.ipv4.tcp_congestion_control=bbr
EOF

sysctl -p

# File descriptor limits
cat >> /etc/security/limits.conf << EOF
kafka soft nofile 100000
kafka hard nofile 100000
kafka soft nproc 32768
kafka hard nproc 32768
EOF

# Create kafka user
groupadd kafka
useradd -r -g kafka -d /opt/kafka -s /bin/bash kafka

# Mount data volume
echo "Mounting data volume..."
mkfs.ext4 /dev/nvme1n1
mkdir -p /opt/kafka/data
mount /dev/nvme1n1 /opt/kafka/data
echo "/dev/nvme1n1 /opt/kafka/data ext4 defaults,noatime,nodiratime 0 2" >> /etc/fstab

# Set ownership
chown -R kafka:kafka /opt/kafka

# Configure automatic startup
cat > /etc/systemd/system/kafka-bootstrap.service << EOF
[Unit]
Description=Kafka Bootstrap Service
After=network.target

[Service]
Type=oneshot
User=root
ExecStart=/opt/kafka/bootstrap-kafka.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# Create bootstrap script for Ansible
cat > /opt/kafka/bootstrap-kafka.sh << EOF
#!/bin/bash
# This script will be called by Ansible for final Kafka configuration
echo "Kafka bootstrap completed. Ready for Ansible configuration."
echo "Broker ID: $BROKER_ID"
echo "Cluster: $CLUSTER_NAME"
echo "Mode: $([ "$USE_KRAFT" == "true" ] && echo "KRaft" || echo "ZooKeeper")"
echo "Data volume mounted at: /opt/kafka/data"
echo "Bootstrap completed at: \$(date)"
EOF

chmod +x /opt/kafka/bootstrap-kafka.sh

# Enable and start bootstrap service
systemctl enable kafka-bootstrap
systemctl start kafka-bootstrap

# Install CloudWatch agent for monitoring
yum install -y amazon-cloudwatch-agent

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/kafka-bootstrap.log",
            "log_group_name": "/aws/kafka/$CLUSTER_NAME",
            "log_stream_name": "broker-$BROKER_ID-bootstrap"
          },
          {
            "file_path": "/opt/kafka/logs/server.log",
            "log_group_name": "/aws/kafka/$CLUSTER_NAME",
            "log_stream_name": "broker-$BROKER_ID-server"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "Kafka/$CLUSTER_NAME",
    "metrics_collected": {
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": ["used_percent"],
        "metrics_collection_interval": 60,
        "resources": ["*"]
      },
      "diskio": {
        "measurement": ["io_time"],
        "metrics_collection_interval": 60,
        "resources": ["*"]
      },
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      },
      "netstat": {
        "measurement": ["tcp_established", "tcp_time_wait"],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s

# Signal successful completion
echo "Kafka broker bootstrap completed successfully at $(date)"
echo "Ready for Ansible configuration phase"

# Create status file for Ansible to check
echo "BOOTSTRAP_COMPLETE" > /opt/kafka/bootstrap-status
chown kafka:kafka /opt/kafka/bootstrap-status