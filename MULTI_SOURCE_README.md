# Multi-Source Job Scraper Chrome Extension

## Overview

This Chrome extension has been enhanced to support multiple job platforms with automatic platform detection. It can now scrape jobs from both LinkedIn and Jobindex.dk using a single, unified interface.

## Features

### ✅ Supported Platforms
- **LinkedIn** - Job postings and profiles
- **Jobindex.dk** - Job postings
- **Extensible** - Easy to add more platforms

### 🎯 Key Features
- **Automatic Platform Detection** - Detects which platform you're on
- **Unified Interface** - Same button works on all platforms
- **Multi-Source API** - Backend supports multiple job sources
- **Smart Payload Generation** - Automatically formats data for each platform
- **Robust Error Handling** - Comprehensive logging and error management

## Architecture

### New Files Added
```
src/
├── utils/
│   ├── platformDetector.ts      # Platform detection logic
│   └── multiSourceApiClient.ts  # Multi-source API client
├── content/
│   ├── scrapeJobindex.ts        # Jobindex.dk scraper
│   └── multiSourceScraper.ts    # Unified scraper coordinator
└── ...
```

### Updated Files
- `manifest.json` - Added Jobindex.dk permissions and content scripts
- `background.ts` - Added Jobindex.dk support
- `popup.html` - Updated UI for multi-source support
- `popup.ts` - Added platform status detection
- `scrapeJobs.ts` - Updated to use multi-source API
- `build.sh` - Added new files to build process

## How It Works

### 1. Platform Detection
The `PlatformDetector` class automatically detects which platform you're on:
- Analyzes the current URL
- Extracts platform-specific job IDs
- Determines page type (job, company, search)

### 2. Dynamic Scraping
The `MultiSourceScraper` coordinates between platform-specific scrapers:
- Detects current platform
- Loads appropriate scraper (LinkedIn or Jobindex)
- Executes platform-specific scraping logic

### 3. Unified API Communication
The `MultiSourceApiClient` handles API communication:
- Formats data according to platform
- Sends to Laravel backend with correct source information
- Handles company creation and job posting

## Backend Integration

### Database Structure
Your Laravel backend already supports multi-source jobs:
- `job_sources` table with platform configurations
- `job_postings` table with `source_id`, `source_job_id`, `source_url`
- Auto-detection based on `apply_url` domain

### API Endpoints
- `POST /api/jobs` - Accepts multi-source job data
- `POST /api/companies/exists` - Check company existence
- `POST /api/companies` - Create new companies

## Usage

### For Users
1. Navigate to any supported job page:
   - LinkedIn: `https://www.linkedin.com/jobs/view/123456`
   - Jobindex: `https://www.jobindex.dk/jobsoegning/stilling/12345`
2. Click the extension icon
3. Click "Scrape Current Page"
4. The extension automatically detects the platform and scrapes accordingly

### For Developers

#### Adding a New Platform

1. **Add Platform Configuration**
```typescript
// In platformDetector.ts
{
  id: 3,
  name: 'newplatform',
  displayName: 'New Platform',
  baseUrl: 'https://newplatform.com',
  jobUrlPattern: 'https://newplatform.com/jobs/{id}',
  rateLimit: 30
}
```

2. **Create Platform Scraper**
```typescript
// Create src/content/scrapeNewPlatform.ts
class NewPlatformScraper {
  async scrapeJob(): Promise<void> {
    // Platform-specific scraping logic
  }
}
```

3. **Update Manifest**
```json
{
  "content_scripts": [
    {
      "matches": ["https://*.newplatform.com/jobs/*"],
      "js": ["scrapeNewPlatform.js"]
    }
  ]
}
```

4. **Update Build Script**
```bash
# Add to build.sh
npx esbuild src/content/scrapeNewPlatform.ts --bundle --outfile=dist/scrapeNewPlatform.js
```

## Configuration

### Environment Variables
The extension uses the same environment configuration:
```bash
# .env file
API_KEY=your_api_key
API_BASE_URL=https://your-api-url.com
```

### Platform-Specific Settings
Each platform can have custom settings in the `job_sources` table:
```json
{
  "rate_limit": 50,
  "job_url_pattern": "https://www.jobindex.dk/jobsoegning/stilling/{id}",
  "company_url_pattern": "https://www.jobindex.dk/virksomhed/{id}"
}
```

## Error Handling

### Comprehensive Logging
- Platform detection logs
- Scraping progress logs
- API communication logs
- Error details with stack traces

### User Notifications
- Success/failure notifications
- Platform detection status
- Scraping progress updates

## Testing

### Manual Testing
1. Build the extension: `./build.sh`
2. Load in Chrome from `dist/` folder
3. Test on both LinkedIn and Jobindex.dk job pages
4. Verify data is correctly sent to your Laravel API

### Debug Mode
Enable debug logging in `environment.ts`:
```typescript
DEBUG: {
  ENABLE_VERBOSE_LOGGING: true,
  LOG_API_REQUESTS: true,
  LOG_SCRAPING_ACTIONS: true
}
```

## Troubleshooting

### Common Issues

1. **Platform Not Detected**
   - Check URL patterns in `platformDetector.ts`
   - Verify content script matches in `manifest.json`

2. **Scraping Fails**
   - Check browser console for errors
   - Verify CSS selectors in platform-specific scrapers
   - Test API connectivity

3. **API Errors**
   - Verify environment variables in `.env`
   - Check Laravel API logs
   - Ensure `job_sources` table is populated

### Debug Steps
1. Open Chrome DevTools
2. Check Console tab for extension logs
3. Check Network tab for API requests
4. Verify content scripts are loaded

## Future Enhancements

### Planned Features
- **Bulk Scraping** for Jobindex.dk
- **More Platforms** (The Hub, Indeed, etc.)
- **Advanced Filtering** by platform
- **Export Options** for scraped data

### Extensibility
The architecture is designed for easy extension:
- Modular scraper classes
- Configurable platform detection
- Unified API interface
- Plugin-like architecture

## Support

For issues or questions:
1. Check the browser console for error logs
2. Verify your Laravel API is running and accessible
3. Ensure all environment variables are correctly set
4. Test on both supported platforms

## Changelog

### v2.0.0 - Multi-Source Support
- ✅ Added Jobindex.dk support
- ✅ Implemented automatic platform detection
- ✅ Created unified multi-source API client
- ✅ Updated UI for multi-platform support
- ✅ Enhanced error handling and logging
- ✅ Maintained backward compatibility with LinkedIn
