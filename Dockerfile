# Use a lightweight Node.js base image
FROM node:20-slim

# Create and set working directory
WORKDIR /usr/src/app

# Copy package files first (for better layer caching)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy all source code
COPY . .

# Ensure Cloud Run can communicate on port 8080
EXPOSE 8080

# Start the app
CMD ["node", "index.js"]
