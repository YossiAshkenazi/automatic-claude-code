# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set build arguments
ARG VERSION=unknown
ARG BUILD_TIME=unknown

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Set build info
RUN echo "{\"version\":\"$VERSION\",\"buildTime\":\"$BUILD_TIME\"}" > build-info.json

# Build the application
RUN npm run build:validate

# Production stage
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Install runtime dependencies only
RUN apk add --no-cache \
    tini \
    dumb-init

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-optional && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build-info.json ./
COPY --from=builder /app/server ./server

# Create necessary directories
RUN mkdir -p /app/data /app/logs && \
    chown -R nextjs:nodejs /app

# Health check
COPY --chown=nextjs:nodejs docker-healthcheck.js ./
RUN chmod +x docker-healthcheck.js

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node docker-healthcheck.js

# Security: don't run as root
USER nextjs

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the server
CMD ["node", "dist/server/websocket-server.js"]