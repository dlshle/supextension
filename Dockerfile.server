FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy puppet files
COPY puppet/ ./puppet/

# Copy tsconfig.json if needed for builds (though puppet is JS)
COPY tsconfig.json ./

# Create dist directory for build artifacts if needed
RUN mkdir -p dist

# Expose ports
EXPOSE 9222 9223

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:9223/health || exit 1

# Run the puppet server
CMD ["npm", "run", "puppet:start"]