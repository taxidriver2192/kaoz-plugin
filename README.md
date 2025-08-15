# LinkedIn Profile Scraper for Kaoz.dk

A Chrome extension that extracts LinkedIn profile data and sends it to my Laravel API at kaoz.dk.

## What is this?

This extension automatically scrapes LinkedIn profiles and sends the data to my personal Laravel API backend at **kaoz.dk** for tracking and analysis.

**This is a private project for personal use.**

## Setup

1. Copy environment file:
   ```bash
   cp .env.template .env
   ```

2. Add your API key to `.env`:
   ```env
   API_KEY=your-api-key-here
   API_BASE_URL=https://kaoz.dk/api
   ```

3. Build and install:
   ```bash
   npm install
   npm run build
   ```

4. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder

## Usage

1. Visit any LinkedIn profile
2. Click the extension icon
3. Click "Scrape Profile"
4. Data is automatically sent to kaoz.dk

## Privacy

This extension is for personal use only and connects exclusively to the kaoz.dk API.
   - Extract basic profile information
   - Navigate to detailed experience page
   - Navigate to detailed education page
   - Compile all data and send to your API
   - Show success/error notifications

### Data Structure
The extension extracts and sends this structured data:
```typescript
{
  linkedin_url: string;
  headline: string;
  summary?: string;
  location_city: string;
  avatar?: string;
  positions: PositionItem[];
  educations: EducationItem[];
  skill_frequencies: { [skill: string]: number };
}
```

## 🛠️ Development

### Adding New Features
The modular architecture makes it easy to extend:

```typescript
// Add new API endpoints
// src/config/apiClient.ts
async sendJobData(jobData: JobData): Promise<ApiResponse<JobData>> {
  return this.makeRequest('/jobs', {
    method: 'POST',
    body: JSON.stringify(jobData)
  });
}

// Add new UI utilities
// src/utils/uiUtils.ts
export function showProgressBar(percentage: number): void {
  // Implementation
}

// Use anywhere with imports
import { apiClient } from '../config/apiClient.js';
import { showProgressBar } from '../utils/uiUtils.js';
```

### Available Scripts
```bash
npm run build        # Secure build with environment injection
npm run build-unsafe # Build without API keys (for development)
npm run clean        # Clean build files
npm run dev          # Clean and build
npm run setup        # Initialize .env from template
```

### Testing
1. Make changes to source code
2. Run `npm run build`
3. Reload extension in Chrome (`chrome://extensions/`)
4. Test on LinkedIn profiles

## 📋 API Integration

The extension sends profile data to your backend API with:
- **Method**: PUT
- **Endpoint**: `/linkedin-profile/users/{username}`
- **Headers**: `X-API-Key: your-api-key`
- **Content-Type**: `application/json`

Example backend endpoint:
```python
@app.route('/linkedin-profile/users/<username>', methods=['PUT'])
def update_profile(username):
    data = request.get_json()
    # Process the LinkedIn profile data
    return {'success': True}
```

## 🔧 Configuration

### Environment Variables
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `API_KEY` | Your API authentication key | ✅ | - |
| `API_BASE_URL` | Base URL for your API | ✅ | - |
| `DEBUG_MODE` | Enable verbose logging | ❌ | `false` |
| `LOG_LEVEL` | Logging level | ❌ | `error` |

### Manifest V3 Permissions
- `tabs` - Access to tab information
- `storage` - Local data storage
- `activeTab` - Access to current tab
- `scripting` - Content script injection
- Host permissions for `*.linkedin.com` and your API domain

## 🚀 Deployment

### Production Build
1. Update `.env` with production API keys
2. Run `npm run build`
3. Package the `dist/` folder as a `.zip` file
4. Upload to Chrome Web Store or distribute internally

### Chrome Web Store
1. Create a Chrome Web Store developer account
2. Package the extension: zip the `dist/` folder contents
3. Upload through Chrome Web Store Developer Dashboard
4. Complete store listing and submit for review

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes following the established patterns
4. Test thoroughly with `npm run build` and Chrome testing
5. Submit a pull request

## � License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/taxidriver2192/kaoz-plugin/issues)
- **Documentation**: See `ES_MODULES_ARCHITECTURE.md` for technical details
- **Security Setup**: See `SECURITY_SETUP.md` for environment configuration

---

⭐ **Made with TypeScript, Chrome Extensions API, and secure coding practices**

### Prerequisites
- Node.js (v18 or later)
- npm
- Google Chrome browser

### Installation Steps

1. **Clone and navigate to the project:**
   ```bash
   cd /home/schmidt/Desktop/scrapJob/linkdin-scraper
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the extension:**
   ```bash
   npm run build
   # or
   ./build.sh
   ```

4. **Load extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` directory from this project

## 🎯 Usage

### Basic Operation

1. **Access the Extension:**
   - Click the extension icon in Chrome toolbar
   - The popup interface will open

2. **Scraping Options:**
   - **Scrape Current Page**: Extract data from the currently active LinkedIn page
   - **Jobs**: Start automated job scraping workflow
   - **Profiles**: Start automated profile scraping workflow

3. **Monitor Activity:**
   - View real-time logs in the Activity Log section
   - Check polling status indicator
   - Configure auto-scrape settings

### LinkedIn Page Support

#### Job Pages
- Supports URLs like: `https://www.linkedin.com/jobs/view/12345`
- Extracts: Job title, company, location, description, posted date, salary, employment type

#### Profile Pages  
- Supports URLs like: `https://www.linkedin.com/in/username`
- Extracts: Name, headline, location, experience, education, skills, connections

## 🔧 Configuration

### API Endpoint Configuration

The extension communicates with a backend API. Update the API base URL in `src/utils/apiClient.ts`:

```typescript
const API_BASE_URL = 'https://your-api-endpoint.com/api';
```

### Expected API Endpoints

The backend should implement these endpoints:

#### Job Endpoints
- `GET /jobs/seen/{jobId}` - Check if job exists
- `POST /jobs` - Save new job data
- `GET /jobs/recent?limit=10` - Get recent jobs

#### Profile Endpoints
- `GET /profiles/seen/{profileId}` - Check if profile exists  
- `POST /profiles` - Save new profile data
- `GET /profiles/recent?limit=10` - Get recent profiles

### Data Structures

#### Job Data
```typescript
interface JobData {
  jobId: string;
  title: string;
  company: string;
  location: string;
  description?: string;
  postedDate?: string;
  url: string;
  salary?: string;
  employmentType?: string;
}
```

#### Profile Data
```typescript
interface ProfileData {
  profileId: string;
  name: string;
  headline: string;
  location: string;
  experience: ExperienceItem[];
  skills: string[];
  education: EducationItem[];
  url: string;
  connections?: string;
}
```

## 🔍 Development

### Build Commands
```bash
# Development build
npm run build

# Watch mode (rebuild on changes)
npm run watch

# Clean build directory
npm run clean

# Full development workflow
npm run dev
```

### Debugging

1. **Console Logs**: All logs are prefixed with `[LINKEDIN_SCRAPER_*]` for easy filtering
2. **Chrome DevTools**: Open DevTools and filter console by "LINKEDIN_SCRAPER"
3. **Extension DevTools**: Right-click extension popup → "Inspect" for popup debugging
4. **Background Script**: Go to `chrome://extensions/` → Click "service worker" link

### Common Debug Patterns

```javascript
// Filter logs in Chrome DevTools console
[LINKEDIN_SCRAPER_JOBS]
[LINKEDIN_SCRAPER_PROFILE]  
[LINKEDIN_SCRAPER_BG]
[LINKEDIN_SCRAPER_API]
```

## 🔐 Security & Environment Setup

**Important: This extension now uses secure environment variable management to protect API keys.**

👉 **[See SECURITY_SETUP.md for complete setup instructions](./SECURITY_SETUP.md)**

### Quick Start
```bash
# 1. Copy environment template
cp .env.template .env

# 2. Edit .env with your API key
nano .env

# 3. Build with secure environment injection
npm run build
```

## 🚨 Permissions

The extension requires these permissions:

- `tabs` - Access to tab information
- `storage` - Local data storage
- `activeTab` - Access to currently active tab
- `scripting` - Inject content scripts
- `https://*.linkedin.com/*` - Access LinkedIn pages
- `https://kaoz.dk/*` - Access to your API endpoint

## ⚠️ Important Notes

### LinkedIn Compliance
- **Respect Rate Limits**: Don't scrape too aggressively
- **Terms of Service**: Ensure compliance with LinkedIn's ToS
- **User Consent**: Only scrape with explicit user permission
- **Data Privacy**: Handle scraped data responsibly

### Technical Limitations
- **DOM Changes**: LinkedIn frequently updates their DOM structure
- **Rate Limiting**: API calls should be throttled appropriately  
- **Error Handling**: Robust error handling for network issues
- **Cross-Origin**: Ensure your API supports CORS if needed

## 🔄 Extension Lifecycle

1. **Installation**: Extension sets up default settings
2. **Page Detection**: Automatically detects LinkedIn job/profile pages
3. **Auto-Scraping**: Optionally scrapes pages automatically (if enabled)
4. **API Communication**: Checks for duplicates before sending data
5. **Background Polling**: Periodically checks for new content
6. **User Interface**: Provides real-time feedback and controls

## 🐛 Troubleshooting

### Common Issues

1. **Extension Not Loading**
   - Ensure all files are in `dist/` directory
   - Check for TypeScript compilation errors
   - Verify manifest.json syntax

2. **Content Scripts Not Working**
   - Check if you're on a supported LinkedIn page
   - Verify content script permissions
   - Look for JavaScript errors in DevTools

3. **API Communication Failing**
   - Verify API endpoint URL and availability
   - Check CORS configuration
   - Ensure proper network connectivity

4. **Data Not Being Extracted**
   - LinkedIn may have changed their DOM structure
   - Update selectors in content scripts
   - Check browser console for errors

## 📈 Future Enhancements

- [ ] Support for LinkedIn company pages
- [ ] Export data to CSV/Excel
- [ ] Advanced filtering and search
- [ ] Bulk operations
- [ ] Integration with CRM systems
- [ ] Machine learning for data enhancement
- [ ] Multi-language support

## 📄 License

This project is for educational and personal use. Please ensure compliance with LinkedIn's Terms of Service and applicable laws regarding data scraping.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review Chrome extension documentation
3. Test with minimal data first
4. Ensure API backend is working correctly

---

**Built with ❤️ for data extraction and automation**
