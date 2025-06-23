FROM node:18-alpine

WORKDIR /app

# Copy package.json for proper ES module support
COPY package.json ./

# Install dependencies
RUN npm install --only=production

# Copy the OAuth MCP server
COPY oauth-mcp-server.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Set ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3007/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 3007

# Start the application
CMD ["node", "oauth-mcp-server.js"]