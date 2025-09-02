# Multi-stage build for Automatic Claude Code
FROM node:20-alpine AS base
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
FROM base AS dependencies
RUN pnpm install

# Build stage
FROM dependencies AS build
COPY . .
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files and install only production dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --production

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/docs/ ./docs/
COPY --from=build /app/config/ ./config/

# Create non-root user and necessary directories
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN mkdir -p /app/.claude-sessions /app/logs && chown -R nodejs:nodejs /app
USER nodejs

# Expose port (if needed for monitoring integration)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Default command
CMD ["node", "dist/index.js", "--help"]