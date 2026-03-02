# Use a lightweight Node.js base image
FROM node:20-slim

# Set working directory inside the container
WORKDIR /usr/src/app

# Install Puppeteer dependencies for PDF generation
RUN apt-get update && apt-get install -y \
  libglib2.0-0 \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  libatspi2.0-0 \
  libxshmfence1 \
  libx11-xcb1 \
  libxcb1 \
  libxcb-dri3-0 \
  libxss1 \
  libgconf-2-4 \
  libxext6 \
  libxrender1 \
  libxtst6 \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libgtk-3-0 \
  xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Copy only package files first (for better layer caching)
COPY package*.json ./

# Align npm version with the lockfile generator
RUN npm install -g npm@11.6.2

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the rest of the app source code
COPY . .

# Expose port 8080 (Cloud Run requirement)
EXPOSE 8080

# Start the app
CMD ["node", "index.js"]
