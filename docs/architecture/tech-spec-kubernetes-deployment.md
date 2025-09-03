# Technical Specifications - Kubernetes Deployment & Auto-scaling
*Epic 3: Production Kubernetes Infrastructure*

---

## 1. Kubernetes Architecture Overview

### Core Components
- **Control Plane**: EKS/GKE managed service with multi-AZ deployment
- **Node Groups**: Mixed instance types (compute-optimized for agents, memory-optimized for dashboard)
- **Service Mesh**: Istio for traffic management and security
- **Storage**: EBS/GCE persistent volumes with CSI drivers
- **Networking**: VPC-native with private subnets and NAT gateways

### Resource Topology
```
automatic-claude-code/
├── core/                    # Main application services
│   ├── manager-agent        # Manager agent deployment
│   ├── worker-agent         # Worker agent deployment  
│   └── api-gateway         # API gateway service
├── dashboard/              # Monitoring dashboard
│   ├── frontend            # React dashboard
│   └── backend             # WebSocket server
├── infrastructure/         # Supporting services
│   ├── redis              # Session store
│   ├── postgres           # Task persistence
│   └── monitoring         # Observability stack
└── security/              # Security components
    ├── rbac               # Role-based access control
    └── network-policies   # Network security
```

## 2. Helm Chart Structure

### Chart Organization
```yaml
# charts/automatic-claude-code/Chart.yaml
apiVersion: v2
name: automatic-claude-code
version: 2.0.0
appVersion: "2.0.0"
dependencies:
  - name: redis
    version: "17.x.x"
    repository: "https://charts.bitnami.com/bitnami"
  - name: postgresql
    version: "12.x.x"
    repository: "https://charts.bitnami.com/bitnami"
```

### Values Structure
```yaml
# values.yaml
global:
  environment: production
  domain: claude-code.company.com
  imageRegistry: ghcr.io/yossiashkenazi

core:
  managerAgent:
    replicas: 3
    image:
      repository: automatic-claude-code/manager
      tag: "2.0.0"
    resources:
      requests: { cpu: "500m", memory: "1Gi" }
      limits: { cpu: "2000m", memory: "4Gi" }
  
  workerAgent:
    replicas: 10
    image:
      repository: automatic-claude-code/worker
      tag: "2.0.0"
    resources:
      requests: { cpu: "1000m", memory: "2Gi" }
      limits: { cpu: "4000m", memory: "8Gi" }

dashboard:
  frontend:
    replicas: 2
    ingress:
      enabled: true
      className: "nginx"
      annotations:
        cert-manager.io/cluster-issuer: "letsencrypt-prod"
      hosts:
        - host: dashboard.claude-code.company.com
          paths: ["/"]

autoscaling:
  enabled: true
  hpa:
    minReplicas: 3
    maxReplicas: 50
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
  vpa:
    enabled: true
    updateMode: "Auto"
  clusterAutoscaler:
    enabled: true
    maxNodes: 100
    minNodes: 3
```

## 3. Deployment Manifests

### Manager Agent Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: manager-agent
  labels:
    app: manager-agent
    version: v2.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: manager-agent
  template:
    metadata:
      labels:
        app: manager-agent
        version: v2.0.0
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 2000
      containers:
      - name: manager-agent
        image: ghcr.io/yossiashkenazi/automatic-claude-code/manager:2.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2000m"
            memory: "4Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### ConfigMap for Application Configuration
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  config.json: |
    {
      "defaultModel": "sonnet",
      "sdkIntegration": {
        "enabled": true,
        "timeout": 300000,
        "retryAttempts": 3
      },
      "dualAgentMode": {
        "enabled": true,
        "managerModel": "opus",
        "workerModel": "sonnet"
      },
      "monitoring": {
        "enabled": true,
        "dashboardPort": 6011,
        "apiPort": 4005
      }
    }
```

## 4. Auto-scaling Configurations

### Horizontal Pod Autoscaler (HPA)
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker-agent
  minReplicas: 5
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: active_tasks_per_pod
      target:
        type: AverageValue
        averageValue: "5"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### Vertical Pod Autoscaler (VPA)
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: manager-agent-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: manager-agent
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: manager-agent
      maxAllowed:
        cpu: "4000m"
        memory: "8Gi"
      minAllowed:
        cpu: "100m"
        memory: "128Mi"
      controlledResources: ["cpu", "memory"]
```

## 5. Network Policies & Ingress

### Network Policy
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-network-policy
spec:
  podSelector:
    matchLabels:
      app: worker-agent
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: manager-agent
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to: []
    ports:
    - protocol: TCP
      port: 443  # HTTPS for Claude API
```

### Ingress Configuration
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dashboard-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/websocket-services: "dashboard-backend"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - dashboard.claude-code.company.com
    secretName: dashboard-tls
  rules:
  - host: dashboard.claude-code.company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: dashboard-frontend
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: dashboard-backend
            port:
              number: 4005
```

## 6. Persistent Storage

### StorageClass
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  fsType: ext4
allowVolumeExpansion: true
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
```

### PersistentVolumeClaim
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 100Gi
```

## 7. Health Probes & Monitoring

### Service Monitor for Prometheus
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: agent-metrics
spec:
  selector:
    matchLabels:
      app: manager-agent
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### Custom Health Checks
```yaml
# In deployment spec
livenessProbe:
  exec:
    command:
    - /bin/sh
    - -c
    - |
      curl -f http://localhost:3000/health &&
      pgrep -f "node.*manager-agent" > /dev/null
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
    httpHeaders:
    - name: Custom-Health-Check
      value: kubernetes
  initialDelaySeconds: 5
  periodSeconds: 5
  successThreshold: 1
  failureThreshold: 3
```

## 8. Resource Limits & Quotas

### ResourceQuota
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: claude-code-quota
spec:
  hard:
    requests.cpu: "100"
    requests.memory: 200Gi
    limits.cpu: "200"
    limits.memory: 400Gi
    persistentvolumeclaims: "10"
    services: "10"
    secrets: "20"
```

### LimitRange
```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: claude-code-limits
spec:
  limits:
  - default:
      cpu: "2000m"
      memory: "4Gi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    type: Container
  - max:
      cpu: "8000m"
      memory: "16Gi"
    min:
      cpu: "50m"
      memory: "64Mi"
    type: Container
```

## 9. GitOps Workflow with ArgoCD

### Application Definition
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: automatic-claude-code
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/yossiashkenazi/automatic-claude-code
    targetRevision: HEAD
    path: deploy/kubernetes/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: claude-code
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

## 10. Multi-Environment Strategy

### Kustomization Overlay Structure
```
deploy/kubernetes/
├── base/                    # Base manifests
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
├── overlays/
│   ├── development/         # Dev environment
│   │   ├── kustomization.yaml
│   │   └── patches/
│   ├── staging/             # Staging environment
│   │   ├── kustomization.yaml
│   │   └── patches/
│   └── production/          # Production environment
│       ├── kustomization.yaml
│       └── patches/
```

### Environment-Specific Values
```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

patchesStrategicMerge:
- replica-count.yaml
- resource-limits.yaml

images:
- name: ghcr.io/yossiashkenazi/automatic-claude-code
  newTag: "2.0.0"

configMapGenerator:
- name: env-config
  envs:
  - production.env
```

## 11. Security Policies

### RBAC Configuration
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: claude-code-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: claude-code-binding
subjects:
- kind: ServiceAccount
  name: claude-code-sa
roleRef:
  kind: Role
  name: claude-code-role
  apiGroup: rbac.authorization.k8s.io
```

### Pod Security Policy
```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: claude-code-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

## 12. CI/CD Pipeline Integration

### GitHub Actions Workflow
```yaml
name: Deploy to Kubernetes
on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name claude-code-cluster
    
    - name: Deploy with Helm
      run: |
        helm upgrade --install claude-code ./charts/automatic-claude-code \
          --namespace claude-code \
          --create-namespace \
          --values values-production.yaml \
          --set image.tag=${{ github.sha }}
    
    - name: Wait for rollout
      run: |
        kubectl rollout status deployment/manager-agent -n claude-code
        kubectl rollout status deployment/worker-agent -n claude-code
```

## 13. Backup & Disaster Recovery

### Database Backup CronJob
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:14
            command:
            - /bin/bash
            - -c
            - |
              pg_dump $DATABASE_URL | gzip > /backup/claude-code-$(date +%Y%m%d).sql.gz
              aws s3 cp /backup/claude-code-$(date +%Y%m%d).sql.gz s3://claude-code-backups/
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: url
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
```

### Velero Backup Configuration
```yaml
apiVersion: velero.io/v1
kind: Backup
metadata:
  name: claude-code-daily-backup
spec:
  includedNamespaces:
  - claude-code
  storageLocation: default
  volumeSnapshotLocations:
  - default
  ttl: 720h0m0s  # 30 days retention
```

This comprehensive Kubernetes specification provides production-ready infrastructure for automatic-claude-code with advanced auto-scaling, security, and operational capabilities.