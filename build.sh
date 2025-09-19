#!/bin/bash

# LinkedIn Scraper Extension Build Script with Environment Variable Injection

echo "🔧 Building LinkedIn Scraper Extension..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "📋 Please copy .env.template to .env and configure your API key:"
    echo "   cp .env.template .env"
    echo "   # Then edit .env with your actual API key"
    exit 1
fi

# Load environment variables
echo "🔐 Loading environment variables..."
set -a
source .env
set +a

# Validate required variables
if [ -z "$API_KEY" ]; then
    echo "❌ Error: API_KEY not set in .env file"
    exit 1
fi

if [ -z "$API_BASE_URL" ]; then
    echo "❌ Error: API_BASE_URL not set in .env file"
    exit 1
fi

echo "✅ Environment variables loaded successfully"

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/*

# Environment config will be injected directly into source files

# Replace placeholders in apiClient.ts with actual values
echo "🔧 Injecting environment variables into apiClient..."
sed -i.bak "s|PLACEHOLDER_API_BASE_URL|${API_BASE_URL}|g" src/utils/apiClient.ts
sed -i.bak "s|PLACEHOLDER_API_KEY|${API_KEY}|g" src/utils/apiClient.ts

# Replace placeholders in background.ts with actual values
echo "🔧 Injecting environment variables into background.ts..."
sed -i.bak "s|PLACEHOLDER_API_BASE_URL|${API_BASE_URL}|g" src/background.ts
sed -i.bak "s|PLACEHOLDER_API_KEY|${API_KEY}|g" src/background.ts

# Replace placeholders in environment.ts with actual values
echo "🔧 Injecting environment variables into environment.ts..."
sed -i.bak "s|PLACEHOLDER_API_BASE_URL|${API_BASE_URL}|g" src/config/environment.ts
sed -i.bak "s|PLACEHOLDER_API_KEY|${API_KEY}|g" src/config/environment.ts

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
if [ -f "src/utils/apiClient.ts.bak" ]; then
    mv src/utils/apiClient.ts.bak src/utils/apiClient.ts
fi
if [ -f "src/background.ts.bak" ]; then
    mv src/background.ts.bak src/background.ts
fi
if [ -f "src/config/environment.ts.bak" ]; then
    mv src/config/environment.ts.bak src/config/environment.ts
fi

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📦 Extension ready in dist/ folder"
    echo ""
    echo "🔐 Security Note: API key has been injected into the build"
    echo "⚠️  Do not commit the dist/ folder to version control"
else
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "📚 Next steps:"
echo "1. Load the extension in Chrome from the dist/ folder"
echo "2. Test the extension functionality"
echo "3. For production, update .env with production API keys"
