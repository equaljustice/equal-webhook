#!/bin/bash
# Script to install Puppeteer dependencies for PDF generation
# Run this script before starting the server in production

echo "Installing Puppeteer dependencies for PDF generation..."

# Update package list
apt-get update

# Install required libraries for Puppeteer/Chromium
apt-get install -y \
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
  libasound2 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libgtk-3-0 \
  libgbm1 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  xdg-utils

echo "Puppeteer dependencies installed successfully!"
echo "You can now use PDF generation feature."
