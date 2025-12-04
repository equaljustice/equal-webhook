# Use a lightweight Node.js base image
FROM node:20-slim

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy only package files first (for better layer caching)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the rest of the app source code
COPY . .

# Expose port 8080 (Cloud Run requirement)
EXPOSE 8080

# Start the app
CMD ["node", "index.js"]
