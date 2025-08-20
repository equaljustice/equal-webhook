#!/bin/bash

echo "🔨 Building Admin Dashboard..."

# Navigate to admin dashboard directory
cd admin-dashboard

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the dashboard
echo "🏗️ Building static files..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Admin Dashboard built successfully!"
    echo "📁 Static files are in: admin-dashboard/out/"
    echo "🌐 Access at: http://localhost:8080/admin"
else
    echo "❌ Build failed!"
    exit 1
fi
