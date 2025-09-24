# LinkedIn Profile Scraper for Kaoz.dk

A Chrome extension that extracts LinkedIn profile data and sends it to my Laravel API at kaoz.dk.

## What is this?

This extension automatically scrapes LinkedIn profiles and sends the data to my personal Laravel API backend at **kaoz.dk** for tracking and analysis.

**This is a private project for personal use.**

## Setup

1. Create a `.env` file in the project root:
   ```bash
   touch .env
   ```

2. Add your API configuration to `.env`:
   ```env
   API_KEY=your-api-key-here
   API_BASE_URL=https://your-domain.com/api
   ```

   **Example for local development:**
   ```env
   API_KEY=055d589e-your-dev-key
   API_BASE_URL=https://laravel-job-dashboard.test/api
   ```

   **Example for production:**
   ```env
   API_KEY=055d589e-your-prod-key
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

## Environment Switching

The extension now uses a single API configuration from your `.env` file. To switch between environments:

1. **For Development**: Update your `.env` file with development API settings
2. **For Production**: Update your `.env` file with production API settings  
3. **Rebuild**: Run `npm run build` after changing the `.env` file
4. **Reload**: Reload the extension in Chrome

This simplified approach eliminates the need for environment toggle buttons and makes the extension more reliable.

## Usage

1. Visit any LinkedIn profile or job listing
2. Click the extension icon
3. Choose from available options:
   - **"Scrape Profile"** - Extract current profile data
   - **"Scrape Job"** - Extract current job listing data
   - **"Bulk Scrape Jobs"** - Scroll through job list and extract all jobs
4. Data is automatically sent to kaoz.dk API
5. Extension checks for duplicates before sending

## Smart Duplicate Detection

The extension intelligently avoids sending duplicate data:
- Fetches existing job IDs from your kaoz.dk database
- Compares scraped jobs against existing records
- Only sends new, unique job data
- Shows clear statistics: "New: X, Duplicates: Y, Errors: Z"

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
