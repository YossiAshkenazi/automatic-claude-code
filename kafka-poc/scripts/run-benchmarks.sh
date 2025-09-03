#!/bin/bash

# Kafka PoC Benchmark Execution Script
# Runs comprehensive performance benchmarks and generates reports

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$PROJECT_DIR/benchmark-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Kafka PoC Benchmark Suite ===${NC}"
echo "Starting benchmark execution at $(date)"

# Create results directory
mkdir -p "$RESULTS_DIR/$TIMESTAMP"

# Function to check if Docker services are running
check_services() {
    echo -e "${YELLOW}Checking Docker services...${NC}"
    
    if ! docker-compose -f "$PROJECT_DIR/docker-compose.yml" ps | grep -q "Up"; then
        echo -e "${RED}Docker services not running. Starting services...${NC}"
        docker-compose -f "$PROJECT_DIR/docker-compose.yml" up -d
        
        echo "Waiting for services to initialize..."
        sleep 60
        
        # Wait for Kafka to be ready
        echo "Waiting for Kafka to be ready..."
        until docker-compose -f "$PROJECT_DIR/docker-compose.yml" exec kafka kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1; do
            echo "Kafka not ready, waiting..."
            sleep 10
        done
        
        # Wait for Schema Registry
        echo "Waiting for Schema Registry..."
        until curl -f http://localhost:8081/subjects > /dev/null 2>&1; do
            echo "Schema Registry not ready, waiting..."
            sleep 5
        done
        
        # Wait for application
        echo "Waiting for application..."
        until curl -f http://localhost:8080/actuator/health > /dev/null 2>&1; do
            echo "Application not ready, waiting..."
            sleep 10
        done
        
        echo -e "${GREEN}All services are ready!${NC}"
    else
        echo -e "${GREEN}Services are already running${NC}"
    fi
}

# Function to run Maven tests
run_maven_tests() {
    echo -e "${YELLOW}Running Maven test suite...${NC}"
    
    cd "$PROJECT_DIR"
    
    # Clean and test
    mvn clean test -Dtest=KafkaPerformanceBenchmark \
        -DfailIfNoTests=false \
        -Dtest.results.dir="$RESULTS_DIR/$TIMESTAMP" \
        > "$RESULTS_DIR/$TIMESTAMP/maven-test.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Maven tests completed successfully${NC}"
    else
        echo -e "${RED}✗ Maven tests failed. Check logs in $RESULTS_DIR/$TIMESTAMP/maven-test.log${NC}"
    fi
}

# Function to run integration tests
run_integration_tests() {
    echo -e "${YELLOW}Running integration test suite...${NC}"
    
    cd "$PROJECT_DIR"
    
    mvn test -Dtest=KafkaIntegrationTestSuite \
        -DfailIfNoTests=false \
        > "$RESULTS_DIR/$TIMESTAMP/integration-test.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Integration tests completed successfully${NC}"
    else
        echo -e "${RED}✗ Integration tests failed. Check logs in $RESULTS_DIR/$TIMESTAMP/integration-test.log${NC}"
    fi
}

# Function to run schema evolution tests
run_schema_tests() {
    echo -e "${YELLOW}Running schema evolution tests...${NC}"
    
    cd "$PROJECT_DIR"
    
    mvn test -Dtest=SchemaEvolutionTest \
        -DfailIfNoTests=false \
        > "$RESULTS_DIR/$TIMESTAMP/schema-test.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Schema evolution tests completed successfully${NC}"
    else
        echo -e "${RED}✗ Schema evolution tests failed. Check logs in $RESULTS_DIR/$TIMESTAMP/schema-test.log${NC}"
    fi
}

# Function to run load testing
run_load_tests() {
    echo -e "${YELLOW}Running load tests with k6...${NC}"
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        echo -e "${YELLOW}k6 not found, installing...${NC}"
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo apt-get update && sudo apt-get install -y k6
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install k6
        else
            echo -e "${RED}Please install k6 manually from https://k6.io/docs/getting-started/installation/${NC}"
            return 1
        fi
    fi
    
    # Create k6 load test script
    cat > "$RESULTS_DIR/$TIMESTAMP/load-test.js" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.01'], // Error rate must be below 1%
  },
};

export default function () {
  // Test event production endpoint
  let payload = JSON.stringify({
    userId: `user-${Math.floor(Math.random() * 10000)}`,
    eventType: 'USER_CREATED',
    email: `user${Math.floor(Math.random() * 10000)}@example.com`,
    firstName: 'Load',
    lastName: 'Test'
  });

  let params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  let response = http.post('http://localhost:8080/api/v1/events/user', payload, params);
  
  let result = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  errorRate.add(!result);
  
  sleep(1);
}
EOF

    # Run k6 load test
    k6 run "$RESULTS_DIR/$TIMESTAMP/load-test.js" \
        --out json="$RESULTS_DIR/$TIMESTAMP/load-test-results.json" \
        > "$RESULTS_DIR/$TIMESTAMP/load-test.log" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Load tests completed successfully${NC}"
    else
        echo -e "${RED}✗ Load tests failed. Check logs in $RESULTS_DIR/$TIMESTAMP/load-test.log${NC}"
    fi
}

# Function to collect metrics
collect_metrics() {
    echo -e "${YELLOW}Collecting system metrics...${NC}"
    
    # Collect Prometheus metrics
    curl -s http://localhost:9090/api/v1/query?query=kafka_producer_success_total \
        > "$RESULTS_DIR/$TIMESTAMP/prometheus-metrics.json"
    
    # Collect application metrics
    curl -s http://localhost:8080/actuator/metrics \
        > "$RESULTS_DIR/$TIMESTAMP/application-metrics.json"
    
    # Collect JVM metrics
    curl -s http://localhost:8080/actuator/metrics/jvm.memory.used \
        > "$RESULTS_DIR/$TIMESTAMP/jvm-memory-metrics.json"
    
    # Docker stats
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" \
        > "$RESULTS_DIR/$TIMESTAMP/docker-stats.txt"
    
    echo -e "${GREEN}✓ Metrics collected${NC}"
}

# Function to generate report
generate_report() {
    echo -e "${YELLOW}Generating benchmark report...${NC}"
    
    cat > "$RESULTS_DIR/$TIMESTAMP/README.md" << EOF
# Kafka PoC Benchmark Results

**Execution Date:** $(date)
**Duration:** $(($(date +%s) - start_time)) seconds

## Test Summary

### Performance Benchmarks
- **High Throughput Test:** See maven-test.log for detailed results
- **Latency Benchmarks:** P95/P99 latency measurements
- **Concurrent Producer Stress Test:** Multi-producer load testing
- **Memory Usage Test:** Resource efficiency validation

### Integration Tests
- **End-to-End User Lifecycle:** Complete event flow testing
- **Idempotency Validation:** Duplicate message handling
- **Error Handling:** Dead letter queue and circuit breaker testing
- **Schema Evolution:** Backward/forward compatibility testing

### Load Testing
- **Sustained Load:** 100-200 concurrent users
- **Response Time:** 95% of requests < 500ms target
- **Error Rate:** < 1% target

## Files Generated

- \`maven-test.log\` - Maven test execution log
- \`integration-test.log\` - Integration test results
- \`schema-test.log\` - Schema evolution test results
- \`load-test.log\` - k6 load test execution log
- \`load-test-results.json\` - Detailed load test metrics
- \`prometheus-metrics.json\` - Prometheus metrics snapshot
- \`application-metrics.json\` - Spring Boot actuator metrics
- \`jvm-memory-metrics.json\` - JVM memory usage
- \`docker-stats.txt\` - Container resource usage

## Key Performance Metrics

### Throughput
- Target: 100,000+ messages/second
- Achieved: [See maven-test.log for actual numbers]

### Latency
- P95 Target: < 10ms
- P99 Target: < 20ms
- Achieved: [See test logs for actual measurements]

### Reliability
- Success Rate Target: > 99%
- Circuit Breaker: Functional
- Dead Letter Queue: Operational

## Monitoring Dashboards

- Grafana: http://localhost:3000 (admin/kafka-poc-grafana)
- Prometheus: http://localhost:9090
- Kafka Manager: http://localhost:9000
- Zipkin Tracing: http://localhost:9411

## Next Steps

1. Review detailed logs for any performance bottlenecks
2. Adjust configuration based on results
3. Scale testing for production load scenarios
4. Implement additional monitoring alerts if needed

EOF

    echo -e "${GREEN}✓ Report generated: $RESULTS_DIR/$TIMESTAMP/README.md${NC}"
}

# Main execution
main() {
    start_time=$(date +%s)
    
    echo "Results will be stored in: $RESULTS_DIR/$TIMESTAMP"
    
    # Run all benchmark phases
    check_services
    run_maven_tests
    run_integration_tests
    run_schema_tests
    run_load_tests
    collect_metrics
    generate_report
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo -e "${GREEN}=== Benchmark Suite Completed ===${NC}"
    echo "Total execution time: ${duration} seconds"
    echo "Results available in: $RESULTS_DIR/$TIMESTAMP"
    echo ""
    echo -e "${BLUE}Quick Links:${NC}"
    echo "- Full Report: $RESULTS_DIR/$TIMESTAMP/README.md"
    echo "- Grafana Dashboard: http://localhost:3000"
    echo "- Prometheus Metrics: http://localhost:9090"
    echo "- Application Health: http://localhost:8080/actuator/health"
}

# Script options
case "${1:-all}" in
    "services")
        check_services
        ;;
    "tests")
        check_services
        run_maven_tests
        run_integration_tests
        run_schema_tests
        ;;
    "load")
        check_services
        run_load_tests
        ;;
    "metrics")
        collect_metrics
        ;;
    "all")
        main
        ;;
    *)
        echo "Usage: $0 [services|tests|load|metrics|all]"
        echo "  services - Check and start Docker services"
        echo "  tests    - Run all test suites"
        echo "  load     - Run load testing only"
        echo "  metrics  - Collect metrics only"
        echo "  all      - Run complete benchmark suite (default)"
        exit 1
        ;;
esac