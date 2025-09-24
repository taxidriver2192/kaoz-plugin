#!/bin/bash

# LinkedIn Scraper Extension Build Script with Environment Variable Injection

echo "🔧 Building LinkedIn Scraper Extension..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "📋 Please create a .env file with your API keys:"
    echo "   API_KEY=your_api_key"
    echo "   API_BASE_URL=your_api_url"
    exit 1
fi

# Load environment variables
echo "🔐 Loading environment variables..."
set -a
source .env
set +a

# Validate required variables
if [ -z "$API_KEY" ] || [ -z "$API_BASE_URL" ]; then
    echo "❌ Error: Missing required environment variables in .env file"
    echo "Required: API_KEY, API_BASE_URL"
    exit 1
fi

echo "✅ Environment variables loaded successfully"

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/*

# Inject environment variables into source files
echo "🔧 Injecting environment variables into source files..."

# Create backup files first
echo "🔧 Creating backup files..."
cp src/config/environment.ts src/config/environment.ts.bak
cp src/utils/apiClient.ts src/utils/apiClient.ts.bak

# Replace placeholders in environment.ts with actual values
echo "🔧 Injecting environment variables into environment.ts..."
sed -i "s|PLACEHOLDER_API_BASE_URL|${API_BASE_URL}|g" src/config/environment.ts
sed -i "s|PLACEHOLDER_API_KEY|${API_KEY}|g" src/config/environment.ts

# Replace placeholders in utils/apiClient.ts with actual values
echo "🔧 Injecting environment variables into utils/apiClient.ts..."
sed -i "s|PLACEHOLDER_API_BASE_URL|${API_BASE_URL}|g" src/utils/apiClient.ts
sed -i "s|PLACEHOLDER_API_KEY|${API_KEY}|g" src/utils/apiClient.ts

# Compile TypeScript and bundle with esbuild
echo "📦 Bundling with esbuild..."
npx esbuild src/content/scrapeProfile.ts --bundle --outfile=dist/scrapeProfile.js --format=iife --platform=browser --target=chrome88
npx esbuild src/content/scrapeJobs.ts --bundle --outfile=dist/scrapeJobs.js --format=iife --platform=browser --target=chrome88
npx esbuild src/background.ts --bundle --outfile=dist/background.js --format=iife --platform=browser --target=chrome88
npx esbuild src/popup.ts --bundle --outfile=dist/popup.js --format=iife --platform=browser --target=chrome88

# Copy static assets
echo "📋 Copying static assets..."
cp -r public/* dist/
cp manifest.json dist/

# Clean up temporary files
echo "🧹 Cleaning up temporary files..."

# Restore original files (remove environment variables)
echo "🔒 Restoring original files..."
if [ -f "src/config/environment.ts.bak" ]; then
    mv src/config/environment.ts.bak src/config/environment.ts
fi
if [ -f "src/utils/apiClient.ts.bak" ]; then
    mv src/utils/apiClient.ts.bak src/utils/apiClient.ts
fi

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📦 Extension ready in dist/ folder"
    echo ""
    echo "🔐 Security Note: API keys have been injected from .env file"
    echo "⚠️  Do not commit the dist/ folder or .env file to version control"
else
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "📚 Next steps:"
echo "1. Load the extension in Chrome from the dist/ folder"
echo "2. Test the extension functionality"
echo "3. Keep your .env file secure and never commit it to GitHub"
