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
