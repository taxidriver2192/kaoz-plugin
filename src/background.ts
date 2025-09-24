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
        const errorMessage = result?.message || result?.error || 'Unknown error';
        this.log('API request failed:', response.status, result);
        return {
          success: false,
          message: `API request failed: ${response.status} - ${errorMessage}`
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
        const errorMessage = result?.message || result?.error || JSON.stringify(result) || 'Unknown error';
        this.log('❌ API request failed - HTTP error:', {
          status: response.status,
          statusText: response.statusText,
          responseBody: result
        });
        return {
          success: false,
          message: `API request failed: ${response.status} ${response.statusText} - ${errorMessage}`
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

  async getJobsToCheck(): Promise<BgApiResponse<any[]>> {
    const endpoint = `${this.baseUrl}/jobs/check-for-closed`;
    
    this.log('Getting jobs to check from:', endpoint);
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
          result = [];
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

      this.log('Jobs to check retrieved successfully:', {
        success: true,
        data: result,
        jobCount: Array.isArray(result) ? result.length : 'unknown'
      });
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.log('Network error getting jobs to check:', {
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

  async markJobAsChecked(linkedinJobId: number): Promise<BgApiResponse> {
    const endpoint = `${this.baseUrl}/jobs/linkedin/${linkedinJobId}/checked`;
    
    this.log('Marking job as checked:', linkedinJobId, 'at endpoint:', endpoint);

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

      this.log('Job marked as checked successfully:', result);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.log('Error marking job as checked:', error);
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
      } else if (request.action === 'startScraping') {
        console.info(`[LINKEDIN_SCRAPER_BG] Start scraping requested for type: ${request.type}`);
        // For now, just use the existing scrapeCurrentTab functionality
        this.scrapeCurrentTab();
        sendResponse({ success: true });
      } else if (request.action === 'getStatus') {
        console.info(`[LINKEDIN_SCRAPER_BG] Status requested`);
        // Return current status (polling is disabled for now)
        sendResponse({ 
          success: true, 
          isPolling: false, 
          pollingInterval: 0 
        });
      } else if (request.action === 'stopPolling') {
        console.info(`[LINKEDIN_SCRAPER_BG] Stop polling requested`);
        // Polling is already disabled, just return success
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

  private async checkClosedJobs() {
    try {
      this.log('INFO: Starting closed jobs check...');
      this.log('INFO: API Client configuration:', {
        baseUrl: apiClient.baseUrl,
        apiKey: apiClient.apiKey ? `${apiClient.apiKey.substring(0, 8)}...` : 'NOT SET'
      });
      
      // Validate API configuration
      const configValidation = await validateConfig();
      if (!configValidation.isValid) {
        this.log('ERROR: Configuration validation failed:', configValidation.errors);
        return {
          success: false,
          error: 'Configuration invalid',
          message: `Configuration errors: ${configValidation.errors.join(', ')}`
        };
      }
      
      // Get jobs that need to be checked from the new endpoint
      this.log('INFO: Calling getJobsToCheck() API method...');
      const jobsToCheckResponse = await apiClient.getJobsToCheck();
      
      this.log('INFO: API Response received:', {
        success: jobsToCheckResponse.success,
        hasData: !!jobsToCheckResponse.data,
        dataType: Array.isArray(jobsToCheckResponse.data) ? 'array' : typeof jobsToCheckResponse.data,
        dataLength: Array.isArray(jobsToCheckResponse.data) ? jobsToCheckResponse.data.length : 'N/A',
        message: jobsToCheckResponse.message,
        fullResponse: jobsToCheckResponse
      });
      
      if (!jobsToCheckResponse.success) {
        this.log('ERROR: API call failed - success is false');
        this.log('ERROR: API error details:', {
          message: jobsToCheckResponse.message,
          fullResponse: jobsToCheckResponse
        });
        return {
          success: false,
          error: 'API call failed',
          message: jobsToCheckResponse.message || 'Unknown API error',
          details: jobsToCheckResponse
        };
      }
      
      if (!jobsToCheckResponse.data) {
        this.log('ERROR: API call succeeded but no data returned');
        this.log('ERROR: Response structure:', jobsToCheckResponse);
        return {
          success: false,
          error: 'No data returned from API',
          message: 'API call succeeded but returned no data',
          details: jobsToCheckResponse
        };
      }
      
      // Handle the Laravel API response structure: {success: true, count: X, jobs: [...]}
      let jobsToCheck: any[];
      if (Array.isArray(jobsToCheckResponse.data)) {
        // Direct array response (old format)
        jobsToCheck = jobsToCheckResponse.data;
      } else if (jobsToCheckResponse.data && typeof jobsToCheckResponse.data === 'object' && 'jobs' in jobsToCheckResponse.data && Array.isArray((jobsToCheckResponse.data as any).jobs)) {
        // Laravel API response format: {success: true, count: X, jobs: [...]}
        jobsToCheck = (jobsToCheckResponse.data as any).jobs;
        this.log(`INFO: Using Laravel API response format with ${(jobsToCheckResponse.data as any).count} jobs`);
      } else {
        this.log('ERROR: API data is not in expected format');
        this.log('ERROR: Data type:', typeof jobsToCheckResponse.data);
        this.log('ERROR: Full data object:', jobsToCheckResponse.data);
        return {
          success: false,
          error: 'Invalid data format',
          message: 'API returned data but it is not in expected format (array or {jobs: array})',
          details: jobsToCheckResponse.data
        };
      }
      this.log(`INFO: Successfully retrieved ${jobsToCheck.length} jobs that need checking`);
      this.log('INFO: Jobs to check:', jobsToCheck.map(job => ({
        id: job.linkedin_job_id || job.id,
        title: job.title,
        company: job.company_name || job.company,
        posted_date: job.posted_date,
        last_checked: job.updated_at
      })));

      if (jobsToCheck.length === 0) {
        this.log('INFO: No jobs need checking (all jobs are up to date)');
        return {
          success: true,
          message: 'No jobs need checking - all jobs are up to date',
          closedJobs: [],
          totalChecked: 0
        };
      }

      const closedJobs: number[] = [];
      let checkedCount = 0;

      this.log(`INFO: Starting to check ${jobsToCheck.length} jobs using hidden background tabs...`);

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

      // Check each job using the hidden tab
      for (const job of jobsToCheck) {
        try {
          const jobId = job.linkedin_job_id || job.id;
          const jobUrl = `${CONFIG.LINKEDIN.JOB_URL_PREFIX}${jobId}`;
          this.log(`INFO: Starting to process job ${jobId} (${checkedCount + 1}/${jobsToCheck.length}) - ${job.title} at ${job.company_name || job.company}`);
          
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
          
          // Mark the job as checked (regardless of whether it's closed or not)
          this.log(`INFO: Marking job ${jobId} as checked...`);
          const checkedResponse = await apiClient.markJobAsChecked(jobId);
          if (checkedResponse.success) {
            this.log(`INFO: Successfully marked job ${jobId} as checked`);
          } else {
            this.log(`WARNING: Failed to mark job ${jobId} as checked: ${checkedResponse.message}`);
          }
          
          checkedCount++;
          this.log(`INFO: Completed processing job ${jobId}. Moving to next job...`);
          
          // Add a small delay to avoid overwhelming LinkedIn
          await new Promise(resolve => setTimeout(resolve, 2000));
          this.log(`INFO: Delay completed for job ${jobId}. Continuing to next job...`);
          
        } catch (error) {
          this.log(`ERROR: Error checking job ${job.linkedin_job_id || job.id}:`, error);
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
          
          // Check for specific LinkedIn elements that indicate a closed job
          // Only check for very specific closed job indicators
          const closedJobElements = document.querySelectorAll(
            '[data-test-id="job-closed"], ' +
            '[data-test-id="job-expired"], ' +
            '.job-closed, ' +
            '.job-expired, ' +
            '[class*="job-closed"], ' +
            '[class*="job-expired"]'
          );
          
          if (closedJobElements.length > 0) {
            console.log('Found specific closed job elements:', closedJobElements.length);
            return true;
          }
          
          // Check for disabled apply button (more specific check)
          const applyButtons = document.querySelectorAll('button[data-test-id*="apply"], a[data-test-id*="apply"]');
          const disabledApplyButtons = document.querySelectorAll('button[data-test-id*="apply"][disabled], button[data-test-id*="apply"].disabled');
          
          if (applyButtons.length > 0 && disabledApplyButtons.length === applyButtons.length) {
            console.log('All apply buttons are disabled - job might be closed');
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
