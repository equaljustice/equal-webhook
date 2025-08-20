#!/bin/bash

echo "🚀 Setting up Equal Webhook Admin Dashboard..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env.local ]; then
    echo "🔧 Creating .env.local file..."
    cat > .env.local << EOF
# Admin Dashboard Environment Variables
NEXT_PUBLIC_API_URL=http://localhost:8080

# Optional: Customize the API URL for your deployment
# NEXT_PUBLIC_API_URL=https://your-api-domain.com
EOF
    echo "✅ Created .env.local file"
else
    echo "✅ .env.local file already exists"
fi

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Make sure your backend API is running on http://localhost:8080"
echo "2. Start the development server: npm run dev"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "🔧 Configuration:"
echo "- Edit .env.local to change the API URL"
echo "- The dashboard will auto-refresh every 30 seconds"
echo "- All endpoints require authentication"
echo ""
echo "📚 Documentation:"
echo "- Check README.md for detailed information"
echo "- API endpoints are documented in the README"
echo ""
echo "🚀 Happy monitoring!"
