# Multi-stage build for optimized Kafka PoC container
FROM openjdk:17-jdk-slim AS builder

# Install Maven
RUN apt-get update && apt-get install -y maven && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy POM and download dependencies (cached layer)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY src ./src
RUN mvn clean package -DskipTests

# Production runtime stage
FROM openjdk:17-jre-slim AS runtime

# Install curl for health checks and debugging
RUN apt-get update && \
    apt-get install -y curl netcat-traditional && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r kafka-poc && useradd -r -g kafka-poc kafka-poc

# Set working directory
WORKDIR /app

# Copy JAR from builder stage
COPY --from=builder /app/target/kafka-poc-*.jar app.jar

# Copy configuration files
COPY --from=builder /app/src/main/resources/application*.yml ./config/

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data && \
    chown -R kafka-poc:kafka-poc /app

# Switch to non-root user
USER kafka-poc

# Expose application port and management port
EXPOSE 8080 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Environment variables for configuration
ENV JAVA_OPTS="-Xmx1g -Xms512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+HeapDumpOnOutOfMemoryError"
ENV SPRING_PROFILES_ACTIVE=docker
ENV JVM_ARGS="-Djava.security.egd=file:/dev/./urandom"

# JVM tuning for containerized environments
ENV JAVA_OPTS="$JAVA_OPTS -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

# Application entry point
ENTRYPOINT exec java $JVM_ARGS $JAVA_OPTS \
    -Dspring.config.location=classpath:/application.yml,classpath:/application-docker.yml \
    -jar app.jar

# Labels for metadata
LABEL maintainer="kafka-poc-team"
LABEL version="1.0.0"
LABEL description="Kafka Proof of Concept - Production Ready Implementation"
LABEL org.opencontainers.image.source="https://github.com/example/kafka-poc"