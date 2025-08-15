// LinkedIn Scraper Background Service Worker
// Inline types and API client for Chrome extension compatibility

interface BgProfileData {
  firstName: string;
  lastName: string;
  headline: string | null;
  location: string | null;
  about: string | null;
  experience: string | null;
  education: string | null;
  skills: string | null;
  contactInfo: string | null;
  profileUrl: string;
  imageUrl: string | null;
  connectionCount: string | null;
  followerCount: string | null;
}

interface BgJobData {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedDate: string;
  salary?: string;
  jobType?: string;
  experienceLevel?: string;
}

interface BgApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

// Inline API client for background service
class InlineApiClient {
  private readonly baseUrl: string = 'https://kaoz.dk';
  private readonly apiKey: string = '0612a6d7-68f4-49f2-8e49-084705ab0d86';

  private log(message: string, ...args: any[]) {
    console.info(`[LINKEDIN_SCRAPER_BG_API] ${message}`, ...args);
  }

  async sendProfileData(profileData: BgProfileData): Promise<BgApiResponse> {
    const endpoint = `${this.baseUrl}/api/profiles`;
    
    this.log('Sending profile data to:', endpoint);
    this.log('Profile data:', profileData);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'Accept': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      const result = await response.json();
      
      if (!response.ok) {
        this.log('API request failed:', response.status, result);
        return {
          success: false,
          message: `API request failed: ${response.status} - ${result.message || 'Unknown error'}`
        };
      }

      this.log('Profile data sent successfully:', result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.log('Error sending profile data:', error);
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async sendJobData(jobData: BgJobData): Promise<BgApiResponse> {
    const endpoint = `${this.baseUrl}/api/jobs`;
    
    this.log('Sending job data to:', endpoint);
    this.log('Job data:', jobData);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'Accept': 'application/json'
        },
        body: JSON.stringify(jobData)
      });

      const result = await response.json();
      
      if (!response.ok) {
        this.log('API request failed:', response.status, result);
        return {
          success: false,
          message: `API request failed: ${response.status} - ${result.message || 'Unknown error'}`
        };
      }

      this.log('Job data sent successfully:', result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.log('Error sending job data:', error);
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getRecentJobs(limit: number = 5): Promise<BgApiResponse<BgJobData[]>> {
    const endpoint = `${this.baseUrl}/api/jobs?limit=${limit}`;
    
    this.log('Getting recent jobs from:', endpoint);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Accept': 'application/json'
        }
      });

      const result = await response.json();
      
      if (!response.ok) {
        this.log('API request failed:', response.status, result);
        return {
          success: false,
          message: `API request failed: ${response.status} - ${result.message || 'Unknown error'}`
        };
      }

      this.log('Recent jobs retrieved successfully:', result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.log('Error getting recent jobs:', error);
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

const apiClient = new InlineApiClient();

class BackgroundService {

  private log(message: string, ...args: any[]) {
    console.log(`[LINKEDIN_SCRAPER_BG] ${message}`, ...args);
  }

  constructor() {
    this.setupMessageListeners();
    this.setupTabUpdateListener();
  }

  private setupMessageListeners() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
      console.info(`[LINKEDIN_SCRAPER_BG] Received message:`, request);

      if (request.action === 'scrapeCurrentTab') {
        console.info(`[LINKEDIN_SCRAPER_BG] Scraping current tab...`);
        this.scrapeCurrentTab();
        sendResponse({ success: true });
      } else {
        console.info(`[LINKEDIN_SCRAPER_BG] Unknown action: ${request.action}`);
        sendResponse({ success: false, error: 'Unknown action' });
      }

      return true; // Keep message channel open
    });
  }

  private setupTabUpdateListener() {
    // Listen for tab updates - keeping this for potential future use
    // but removing auto-scraping functionality
    chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: any, tab: any) => {
      if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('linkedin.com/jobs/') || tab.url.includes('linkedin.com/in/')) {
          console.info(`[LINKEDIN_SCRAPER_BG] LinkedIn page detected: ${tab.url}`);
          // Auto-scraping removed - manual scraping only
        }
      }
    });
  }

  private async scrapeCurrentTab() {
    try {
      this.log('INFO: Getting current active tab...');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab?.url || !currentTab?.id) {
        this.log('ERROR: No active tab found or tab ID missing');
        return;
      }

      this.log('INFO: Current tab URL:', currentTab.url);
      this.log('INFO: Current tab ID:', currentTab.id);

      if (currentTab.url.includes('linkedin.com/jobs/')) {
        this.log('INFO: Detected LinkedIn job page, sending scrape job message...');
        chrome.tabs.sendMessage(currentTab.id, { action: 'scrapeJob' });
      } else if (currentTab.url.includes('linkedin.com/in/')) {
        this.log('INFO: Detected LinkedIn profile page, sending scrape profile message...');
        chrome.tabs.sendMessage(currentTab.id, { action: 'scrapeProfile' });
      } else {
        this.log('WARNING: Current tab is not a LinkedIn job or profile page');
        this.log('INFO: URL does not match LinkedIn patterns:', currentTab.url);
      }
    } catch (error) {
      this.log('ERROR: Error scraping current tab:', error);
    }
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details: any) => {
  console.log('[LINKEDIN_SCRAPER_BG] Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      autoScrape: false, // Disabled by default - manual only
    });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('[LINKEDIN_SCRAPER_BG] Extension started');
});
