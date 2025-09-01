# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set build arguments
ARG VERSION=unknown
ARG BUILD_TIME=unknown

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files first for better layer caching
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Set build info
RUN echo "{\"version\":\"$VERSION\",\"buildTime\":\"$BUILD_TIME\"}" > build-info.json

# Build the application
RUN pnpm run build

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

# Install pnpm globally in production stage
RUN npm install -g pnpm

# Copy pnpm lockfile if available, install production dependencies
COPY pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune

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

# Expose port (align with config)
EXPOSE 4005

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4005
ENV WEBSOCKET_SERVER_PORT=4005

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the server
CMD ["node", "dist/server/websocket-server.js"]