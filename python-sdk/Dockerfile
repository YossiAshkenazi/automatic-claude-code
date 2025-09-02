# Multi-stage Dockerfile for Claude Code Python SDK
# Optimized for size and performance

# Stage 1: Build stage
FROM python:3.11-slim AS builder

# Set build arguments
ARG BUILD_DATE
ARG VERSION=0.1.0
ARG VCS_REF

# Labels for metadata
LABEL maintainer="Claude Code SDK Team <sdk@example.com>" \
      org.opencontainers.image.title="Claude Code Python SDK" \
      org.opencontainers.image.description="Official Python SDK for Claude Code CLI with dual-agent support" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.source="https://github.com/yossiashkenazi/automatic-claude-code" \
      org.opencontainers.image.licenses="MIT"

# Install system dependencies for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js and npm (required for Claude CLI)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Set working directory
WORKDIR /build

# Copy SDK source files
COPY . .

# Install Python build dependencies
RUN pip install --no-cache-dir build wheel setuptools

# Build the SDK wheel
RUN python -m build --wheel --outdir dist/

# Stage 2: Runtime stage
FROM python:3.11-slim AS runtime

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (runtime only)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user for security
RUN groupadd -r claude && useradd -r -g claude -s /bin/bash claude

# Set working directory
WORKDIR /app

# Copy built wheel from builder stage
COPY --from=builder /build/dist/*.whl ./

# Install runtime dependencies first
RUN pip install --no-cache-dir aiohttp>=3.8.0

# Install the SDK from wheel
RUN pip install --no-cache-dir $(ls *.whl) && rm *.whl

# Create examples directory and copy scripts
RUN mkdir -p ./examples
COPY --from=builder /build/demo.py ./
COPY --from=builder /build/example_basic_usage.py ./examples/
COPY --from=builder /build/interactive_demo.py ./examples/
COPY --from=builder /build/examples/ ./examples/

# Copy documentation
COPY --from=builder /build/README.md ./
COPY --from=builder /build/QUICKSTART.md ./
COPY --from=builder /build/USAGE_GUIDE.md ./

# Create directories for user data
RUN mkdir -p /home/claude/.claude /app/workspace \
    && chown -R claude:claude /home/claude /app

# Switch to non-root user
USER claude

# Set environment variables
ENV PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/home/claude/.local/bin:$PATH"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import claude_code_sdk; print('SDK imported successfully')" || exit 1

# Default command - run the demo
CMD ["python", "demo.py"]

# Expose common monitoring ports (optional)
EXPOSE 6011 4005

# Volume for workspace and Claude config
VOLUME ["/app/workspace", "/home/claude/.claude"]