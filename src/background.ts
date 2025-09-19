// LinkedIn Scraper Background Service Worker
// Inline types and API client for Chrome extension compatibility

import { CONFIG, validateConfig } from './config/environment';

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
  job_post_closed_date?: string; // DEBUG: Optional close date for testing
}

interface BgApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

// Inline API client for background service
class InlineApiClient {
  public readonly baseUrl: string = CONFIG.API.BASE_URL;
  public readonly apiKey: string = CONFIG.API.API_KEY;

  private log(message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    console.info(`[${timestamp}] [LINKEDIN_SCRAPER_BG_API] ${message}`, ...args);
  }

  async sendProfileData(profileData: BgProfileData): Promise<BgApiResponse> {
    const endpoint = `${this.baseUrl}/profiles`;
    
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
    const endpoint = `${this.baseUrl}/jobs`;
    
    this.log('🚀 Starting job data transmission...');
    this.log('📋 Endpoint:', endpoint);
    this.log('🔑 API Key (masked):', this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NOT SET');
    
    // DEBUG: Randomly add close date for about 50% of jobs
    const shouldClose = Math.random() < 0.5; // 50% chance
    if (shouldClose) {
      // Add a random close date within the last 30 days
      const randomDaysAgo = Math.floor(Math.random() * 30) + 1;
      const closeDate = new Date();
      closeDate.setDate(closeDate.getDate() - randomDaysAgo);
      
      // Add the close date to the job data
      (jobData as any).job_post_closed_date = closeDate.toISOString();
      
      this.log(`🎲 DEBUG: Randomly closing job (${randomDaysAgo} days ago):`, jobData.title);
      this.log('📅 Close date added:', closeDate.toISOString());
    } else {
      this.log('✅ Job will remain open (no close date added)');
    }
    
    this.log('📤 Sending job data to:', endpoint);
    this.log('📋 Job data payload:', JSON.stringify(jobData, null, 2));

    try {
      this.log('🌐 Making HTTP POST request...');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'Accept': 'application/json'
        },
        body: JSON.stringify(jobData)
      });

      this.log('📊 HTTP Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: (() => {
          const headersObj: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
          return headersObj;
        })()
      });

      let result;
      try {
        const responseText = await response.text();
        this.log('📄 Raw response text:', responseText);
        
        if (responseText) {
          result = JSON.parse(responseText);
          this.log('📋 Parsed response JSON:', result);
        } else {
          this.log('⚠️ WARNING: Empty response body');
          result = {};
        }
      } catch (parseError) {
        this.log('❌ ERROR: Failed to parse response as JSON:', parseError);
        return {
          success: false,
          message: `Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
        };
      }
      
      if (!response.ok) {
        this.log('❌ API request failed - HTTP error:', {
          status: response.status,
          statusText: response.statusText,
          responseBody: result
        });
        return {
          success: false,
          message: `API request failed: ${response.status} ${response.statusText} - ${result.message || JSON.stringify(result) || 'Unknown error'}`
        };
      }

      this.log('✅ Job data sent successfully:', result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.log('💥 Error sending job data:', {
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorType: typeof error,
        errorStack: error instanceof Error ? error.stack : 'No stack trace'
      });
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getRecentJobs(limit: number = 5): Promise<BgApiResponse<BgJobData[]>> {
    const endpoint = `${this.baseUrl}/jobs?limit=${limit}`;
    
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

  async getAllJobIds(): Promise<BgApiResponse<{ linkedin_job_ids: number[] }>> {
    const endpoint = `${this.baseUrl}/jobs/ids`;
    
    this.log('Getting all job IDs from:', endpoint);
    this.log('Request details:', {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NOT SET',
        'Accept': 'application/json'
      },
      fullUrl: endpoint
    });

    try {
      this.log('Making fetch request...');
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Accept': 'application/json'
        }
      });

      this.log('Fetch response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: (() => {
          const headersObj: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
          return headersObj;
        })()
      });

      let result;
      try {
        const responseText = await response.text();
        this.log('Raw response text:', responseText);
        
        if (responseText) {
          result = JSON.parse(responseText);
          this.log('Parsed response JSON:', result);
        } else {
          this.log('WARNING: Empty response body');
          result = {};
        }
      } catch (parseError) {
        this.log('ERROR: Failed to parse response as JSON:', parseError);
        return {
          success: false,
          message: `Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
        };
      }
      
      if (!response.ok) {
        this.log('API request failed - HTTP error:', {
          status: response.status,
          statusText: response.statusText,
          responseBody: result
        });
        return {
          success: false,
          message: `API request failed: ${response.status} ${response.statusText} - ${result.message || JSON.stringify(result) || 'Unknown error'}`
        };
      }

      this.log('Job IDs retrieved successfully:', {
        success: true,
        data: result,
        jobCount: result.linkedin_job_ids ? result.linkedin_job_ids.length : 'unknown'
      });
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.log('Network error getting job IDs:', {
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorType: typeof error,
        errorStack: error instanceof Error ? error.stack : 'No stack trace'
      });
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async closeJob(linkedinJobId: number): Promise<BgApiResponse> {
    const endpoint = `${this.baseUrl}/jobs/linkedin/${linkedinJobId}/close`;
    
    this.log('Closing job:', linkedinJobId, 'at endpoint:', endpoint);

    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
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

      this.log('Job closed successfully:', result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.log('Error closing job:', error);
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
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [LINKEDIN_SCRAPER_BG] ${message}`, ...args);
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
      } else if (request.action === 'checkClosedJobs') {
        console.info(`[LINKEDIN_SCRAPER_BG] Checking for closed jobs...`);
        this.checkClosedJobs().then(result => {
          sendResponse(result);
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true; // Keep message channel open for async response
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

  private async checkClosedJobs() {
    try {
      this.log('INFO: Starting closed jobs check...');
      this.log('INFO: API Client configuration:', {
        baseUrl: apiClient.baseUrl,
        apiKey: apiClient.apiKey ? `${apiClient.apiKey.substring(0, 8)}...` : 'NOT SET'
      });
      
      // Validate API configuration
      const configValidation = validateConfig();
      if (!configValidation.isValid) {
        this.log('ERROR: Configuration validation failed:', configValidation.errors);
        return {
          success: false,
          error: 'Configuration invalid',
          message: `Configuration errors: ${configValidation.errors.join(', ')}`
        };
      }
      
      // Get all job IDs from the database
      this.log('INFO: Calling getAllJobIds() API method...');
      const jobIdsResponse = await apiClient.getAllJobIds();
      
      this.log('INFO: API Response received:', {
        success: jobIdsResponse.success,
        hasData: !!jobIdsResponse.data,
        dataKeys: jobIdsResponse.data ? Object.keys(jobIdsResponse.data) : [],
        message: jobIdsResponse.message,
        fullResponse: jobIdsResponse
      });
      
      if (!jobIdsResponse.success) {
        this.log('ERROR: API call failed - success is false');
        this.log('ERROR: API error details:', {
          message: jobIdsResponse.message,
          fullResponse: jobIdsResponse
        });
        return {
          success: false,
          error: 'API call failed',
          message: jobIdsResponse.message || 'Unknown API error',
          details: jobIdsResponse
        };
      }
      
      if (!jobIdsResponse.data) {
        this.log('ERROR: API call succeeded but no data returned');
        this.log('ERROR: Response structure:', jobIdsResponse);
        return {
          success: false,
          error: 'No data returned from API',
          message: 'API call succeeded but returned no data',
          details: jobIdsResponse
        };
      }
      
      if (!jobIdsResponse.data.linkedin_job_ids) {
        this.log('ERROR: API data missing linkedin_job_ids field');
        this.log('ERROR: Available data fields:', Object.keys(jobIdsResponse.data));
        this.log('ERROR: Full data object:', jobIdsResponse.data);
        return {
          success: false,
          error: 'Missing linkedin_job_ids field',
          message: 'API returned data but missing linkedin_job_ids field',
          details: jobIdsResponse.data
        };
      }

      const jobIds = jobIdsResponse.data.linkedin_job_ids;
      this.log(`INFO: Successfully retrieved ${jobIds.length} job IDs from database`);
      this.log('INFO: Job IDs:', jobIds);

      if (jobIds.length === 0) {
        this.log('INFO: No jobs found in database (empty array returned)');
        return {
          success: true,
          message: 'No jobs found in database',
          closedJobs: [],
          totalChecked: 0
        };
      }

      const closedJobs: number[] = [];
      let checkedCount = 0;

      this.log(`INFO: Starting to check ${jobIds.length} jobs using hidden background tabs...`);

      // Create a hidden tab that will be reused for all job checks
      const hiddenTab = await chrome.tabs.create({
        url: 'about:blank',
        active: false
      });

      if (!hiddenTab.id) {
        this.log('ERROR: Failed to create hidden tab for job checking');
        return {
          success: false,
          error: 'Failed to create hidden tab for job checking'
        };
      }

      this.log(`INFO: Created hidden tab ${hiddenTab.id} for background job checking`);

      // Check each job URL using the hidden tab
      for (const jobId of jobIds) {
        try {
          const jobUrl = `${CONFIG.LINKEDIN.JOB_URL_PREFIX}${jobId}`;
          this.log(`INFO: Checking job ${jobId} (${checkedCount + 1}/${jobIds.length})`);
          
          // Navigate to the job URL in the hidden tab
          await chrome.tabs.update(hiddenTab.id, { url: jobUrl });
          
          // Wait for page to load
          this.log(`INFO: Waiting for job page ${jobId} to load...`);
          await this.waitForTabLoad(hiddenTab.id);
          this.log(`INFO: Job page ${jobId} loaded successfully`);
          
          // Check if the job is closed by looking for the specific text
          this.log(`INFO: Checking if job ${jobId} is closed...`);
          const isClosed = await this.checkIfJobIsClosed(hiddenTab.id);
          this.log(`INFO: Job ${jobId} closed status: ${isClosed}`);
          
          if (isClosed) {
            this.log(`INFO: Job ${jobId} is closed, marking as closed in database`);
            closedJobs.push(jobId);
            
            // Call the API to mark the job as closed
            const closeResponse = await apiClient.closeJob(jobId);
            if (closeResponse.success) {
              this.log(`INFO: Successfully marked job ${jobId} as closed`);
            } else {
              this.log(`WARNING: Failed to mark job ${jobId} as closed: ${closeResponse.message}`);
            }
          } else {
            this.log(`INFO: Job ${jobId} is still active`);
          }
          
          checkedCount++;
          
          // Add a small delay to avoid overwhelming LinkedIn
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          this.log(`ERROR: Error checking job ${jobId}:`, error);
          checkedCount++;
        }
      }

      // Close the hidden tab when done
      await chrome.tabs.remove(hiddenTab.id);
      this.log(`INFO: Closed hidden tab ${hiddenTab.id} after job checking completed`);

      this.log(`INFO: Closed jobs check completed. Found ${closedJobs.length} closed jobs out of ${checkedCount} checked`);
      
      return {
        success: true,
        message: `Checked ${checkedCount} jobs, found ${closedJobs.length} closed jobs`,
        closedJobs,
        totalChecked: checkedCount
      };

    } catch (error) {
      this.log('ERROR: Error during closed jobs check:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async waitForTabLoad(tabId: number, timeout: number = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkStatus = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (tab.status === 'complete') {
            resolve();
          } else if (Date.now() - startTime > timeout) {
            reject(new Error('Tab load timeout'));
          } else {
            setTimeout(checkStatus, 100);
          }
        });
      };
      
      checkStatus();
    });
  }

  private async checkIfJobIsClosed(tabId: number): Promise<boolean> {
    try {
      // Execute script to check for the closed job indicator
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Look for the specific text that indicates a job is closed
          const closedTexts = [
            'Modtager ikke længere ansøgninger', // Danish text for "No longer accepting applications"
            'No longer accepting applications', // English version
            'This job is no longer accepting applications',
            'Application deadline has passed',
            'Position has been filled',
            'Job posting has expired',
            'This position is no longer available',
            'Job has been closed',
            'Applications are no longer being accepted'
          ];
          
          // Get all text content from the page
          const pageText = document.body.innerText || document.body.textContent || '';
          
          // Check if any of the closed indicators are present
          for (const closedText of closedTexts) {
            if (pageText.toLowerCase().includes(closedText.toLowerCase())) {
              console.log(`Found closed job indicator: "${closedText}"`);
              return true;
            }
          }
          
          // Also check for specific LinkedIn elements that might indicate a closed job
          const closedElements = document.querySelectorAll('[data-test-id*="closed"], [class*="closed"], [class*="expired"]');
          if (closedElements.length > 0) {
            console.log('Found closed job elements:', closedElements.length);
            return true;
          }
          
          // Check for "Apply" button - if it's disabled or missing, job might be closed
          const applyButtons = document.querySelectorAll('button[data-test-id*="apply"], a[data-test-id*="apply"]');
          if (applyButtons.length === 0) {
            console.log('No apply buttons found - job might be closed');
            return true;
          }
          
          return false;
        }
      });

      const isClosed = results[0]?.result || false;
      this.log(`INFO: Job closed check result: ${isClosed}`);
      return isClosed;
    } catch (error) {
      this.log('ERROR: Error checking if job is closed:', error);
      return false;
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
