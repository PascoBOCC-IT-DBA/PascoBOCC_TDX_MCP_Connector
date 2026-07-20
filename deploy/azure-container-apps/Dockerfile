# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Runtime stage
FROM node:24-alpine

WORKDIR /app

# Copy package files from builder
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --production

# Copy compiled dist from builder
COPY --from=builder /app/dist ./dist

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000 \
    WEBSITES_PORT=3000 \
    NODE_ENV=production

# Start application
CMD ["node", "dist/http-wrapper.js"]
