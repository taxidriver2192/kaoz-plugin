// LinkedIn Scraper Background Service Worker
// Inline types and API client for Chrome extension compatibility

import { CONFIG, validateConfig } from './config/environment';
import { batchScraper } from './background/jobDescriptionBatchScraper';
import { jobindexBulkBatchScraper } from './background/jobindexBulkBatchScraper';

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

  private logApiCall(endpoint: string, method: string, success: boolean, message?: string) {
    // API call logging disabled to reduce noise
    // Only log errors if needed
    if (!success) {
      const status = '❌';
      this.log(`${status} ${method} ${endpoint}${message ? ` - ${message}` : ''}`);
    }
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

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Accept': 'application/json'
        }
      });

      let result;
      try {
        const responseText = await response.text();
        
        if (responseText) {
          result = JSON.parse(responseText);
        } else {
          result = [];
        }
      } catch (parseError) {
        this.logApiCall(endpoint, 'GET', false, 'Failed to parse JSON response');
        return {
          success: false,
          message: `Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
        };
      }
      
      if (!response.ok) {
        this.logApiCall(endpoint, 'GET', false, `${response.status} - ${result.message || 'Unknown error'}`);
        return {
          success: false,
          message: `API request failed: ${response.status} ${response.statusText} - ${result.message || JSON.stringify(result) || 'Unknown error'}`
        };
      }

      const jobCount = Array.isArray(result) ? result.length : (result?.jobs ? result.jobs.length : 0);
      this.logApiCall(endpoint, 'GET', true, `${jobCount} jobs retrieved`);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logApiCall(endpoint, 'GET', false, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async markJobAsChecked(linkedinJobId: number): Promise<BgApiResponse> {
    const endpoint = `${this.baseUrl}/jobs/linkedin/${linkedinJobId}/checked`;

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
        this.logApiCall(endpoint, 'PUT', false, `${response.status} - ${result.message || 'Unknown error'}`);
        return {
          success: false,
          message: `API request failed: ${response.status} - ${result.message || 'Unknown error'}`
        };
      }

      this.logApiCall(endpoint, 'PUT', true);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logApiCall(endpoint, 'PUT', false, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async closeJob(linkedinJobId: number): Promise<BgApiResponse> {
    const endpoint = `${this.baseUrl}/jobs/linkedin/${linkedinJobId}/close`;

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
        this.logApiCall(endpoint, 'PUT', false, `${response.status} - ${result.message || 'Unknown error'}`);
        return {
          success: false,
          message: `API request failed: ${response.status} - ${result.message || 'Unknown error'}`
        };
      }

      this.logApiCall(endpoint, 'PUT', true);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logApiCall(endpoint, 'PUT', false, error instanceof Error ? error.message : 'Unknown error');
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

  private logJobSummary(job: any, index: number, total: number, lastChecked?: string) {
    const jobId = job.linkedin_job_id || job.id;
    const jobUrl = `${CONFIG.LINKEDIN.JOB_URL_PREFIX}${jobId}`;
    const lastCheckedInfo = lastChecked ? ` | Sidst tjekket: ${new Date(lastChecked).toLocaleString('da-DK')}` : '';
    
    this.log(`📋 Job ${index + 1}/${total}: ${job.title} at ${job.company_name || job.company}${lastCheckedInfo}`);
    this.log(`🔗 LinkedIn link: ${jobUrl}`);
  }

  private logJobResult(jobId: number, isClosed: boolean, success: boolean) {
    const status = isClosed ? '❌ LUKKET' : '✅ AKTIV';
    const result = success ? 'OK' : 'FEJL';
    this.log(`📊 Job ${jobId}: ${status} | Status: ${result}`);
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
      } else if (request.action === 'resolveJobindexFinalUrls') {
        console.info(`[LINKEDIN_SCRAPER_BG] Resolving Jobindex final URLs...`);
        this.resolveJobindexFinalUrls()
          .then(result => sendResponse({ success: true, updated: result.updated }))
          .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
        return true;
      } else if (request.action === 'startBatchScraping') {
        console.info(`[LINKEDIN_SCRAPER_BG] Starting batch job description scraping...`);
        console.info(`[LINKEDIN_SCRAPER_BG] batchScraper object:`, batchScraper);
        console.info(`[LINKEDIN_SCRAPER_BG] batchScraper.startScraping:`, typeof batchScraper.startScraping);
        
        try {
          batchScraper.startScraping()
            .then(() => {
              console.info(`[LINKEDIN_SCRAPER_BG] ✅ Batch scraping completed successfully`);
              sendResponse({ success: true });
            })
            .catch(error => {
              console.error(`[LINKEDIN_SCRAPER_BG] ❌ Batch scraping error:`, error);
              sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            });
        } catch (error) {
          console.error(`[LINKEDIN_SCRAPER_BG] ❌ Error calling startScraping:`, error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
        return true;
      } else if (request.action === 'stopBatchScraping') {
        console.info(`[LINKEDIN_SCRAPER_BG] Stopping batch job description scraping...`);
        batchScraper.stopScraping();
        sendResponse({ success: true });
      } else if (request.action === 'getBatchScrapingStatus') {
        console.info(`[LINKEDIN_SCRAPER_BG] Getting batch scraping status...`);
        sendResponse({ 
          success: true, 
          isRunning: batchScraper.isScrapingRunning() 
        });
      } else if (request.action === 'startJobindexBulkScraping') {
        console.info(`[LINKEDIN_SCRAPER_BG] Starting Jobindex bulk scraping...`);
        console.info(`[LINKEDIN_SCRAPER_BG] Base URL: ${request.baseUrl}, Max pages: ${request.maxPages}`);
        
        try {
          jobindexBulkBatchScraper.startBulkScraping(request.baseUrl, request.maxPages || 10)
            .then(() => {
              console.info(`[LINKEDIN_SCRAPER_BG] ✅ Jobindex bulk scraping completed successfully`);
              sendResponse({ success: true });
            })
            .catch(error => {
              console.error(`[LINKEDIN_SCRAPER_BG] ❌ Jobindex bulk scraping error:`, error);
              sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
            });
        } catch (error) {
          console.error(`[LINKEDIN_SCRAPER_BG] ❌ Error calling startBulkScraping:`, error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
        return true;
      } else if (request.action === 'stopJobindexBulkScraping') {
        console.info(`[LINKEDIN_SCRAPER_BG] Stopping Jobindex bulk scraping...`);
        jobindexBulkBatchScraper.stopScraping();
        sendResponse({ success: true });
      } else if (request.action === 'getJobindexBulkScrapingStatus') {
        console.info(`[LINKEDIN_SCRAPER_BG] Getting Jobindex bulk scraping status...`);
        sendResponse({ 
          success: true, 
          isRunning: jobindexBulkBatchScraper.isScrapingRunning() 
        });
      } else {
        console.info(`[LINKEDIN_SCRAPER_BG] Unknown action: ${request.action}`);
        sendResponse({ success: false, error: 'Unknown action' });
      }

      return true; // Keep message channel open
    });
  }

  private setupTabUpdateListener() {
    // Listen for tab updates - keeping this for potential future use
    // but removing auto-scraping functionality and logging
    chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: any, tab: any) => {
      if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('linkedin.com/jobs/') || 
            tab.url.includes('linkedin.com/in/') || 
            tab.url.includes('jobindex.dk/jobsoegning/stilling/')) {
          // Auto-scraping removed - manual scraping only
          // Logging removed to reduce noise
        }
      }
    });
  }

  private async resolveJobindexFinalUrls(): Promise<{ updated: number }> {
    const jobs: any[] = await new Promise((resolve) => {
      chrome.storage.local.get(['jobindexBulkJobs'], (data) => {
        resolve((data?.jobindexBulkJobs as any[]) || []);
      });
    });

    let updated = 0;
    for (const job of jobs) {
      if (!job?.redirectUrl) { continue; }

      const tab = await chrome.tabs.create({ url: job.redirectUrl, active: false });

      const finalUrl: string = await new Promise((resolve) => {
        let settled = false;
        const timeout = setTimeout(async () => {
          if (settled) return;
          settled = true;
          try {
            const info = await chrome.tabs.get(tab.id!);
            resolve(info.url || job.redirectUrl);
          } catch {
            resolve(job.redirectUrl);
          }
        }, 8000);

        const listener = async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tabInfo: chrome.tabs.Tab) => {
          if (tabId === tab.id && changeInfo.status === 'complete' && !settled) {
            settled = true;
            clearTimeout(timeout);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve(tabInfo.url || job.redirectUrl);
          }
        };

        chrome.tabs.onUpdated.addListener(listener);
      });

      try { if (tab.id) { await chrome.tabs.remove(tab.id); } } catch {}

      job.finalUrl = finalUrl;
      updated++;
      await new Promise(r => setTimeout(r, 300));
    }

    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ jobindexBulkJobs: jobs }, () => resolve());
    });

    return { updated };
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
      } else if (currentTab.url.includes('jobindex.dk/jobsoegning/stilling/')) {
        this.log('INFO: Detected Jobindex job page, sending scrape job message...');
        chrome.tabs.sendMessage(currentTab.id, { action: 'scrapeJob' });
      } else {
        this.log('WARNING: Current tab is not a supported job or profile page');
        this.log('INFO: URL does not match supported patterns:', currentTab.url);
        this.log('INFO: Supported platforms: LinkedIn jobs/profiles, Jobindex jobs');
      }
    } catch (error) {
      this.log('ERROR: Error scraping current tab:', error);
    }
  }

  private async checkClosedJobs() {
    try {
      this.log('🔍 Starter tjek af lukkede jobs...');
      
      // Validate API configuration
      const configValidation = await validateConfig();
      if (!configValidation.isValid) {
        this.log('❌ Konfiguration ugyldig:', configValidation.errors);
        return {
          success: false,
          error: 'Configuration invalid',
          message: `Configuration errors: ${configValidation.errors.join(', ')}`
        };
      }
      
      // Get jobs that need to be checked from the new endpoint
      const jobsToCheckResponse = await apiClient.getJobsToCheck();
      
      if (!jobsToCheckResponse.success) {
        this.log('❌ API kald fejlede:', jobsToCheckResponse.message);
        return {
          success: false,
          error: 'API call failed',
          message: jobsToCheckResponse.message || 'Unknown API error',
          details: jobsToCheckResponse
        };
      }
      
      if (!jobsToCheckResponse.data) {
        this.log('❌ Ingen data modtaget fra API');
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
      } else {
        this.log('❌ API data er ikke i forventet format');
        return {
          success: false,
          error: 'Invalid data format',
          message: 'API returned data but it is not in expected format (array or {jobs: array})',
          details: jobsToCheckResponse.data
        };
      }
      this.log(`📊 Fandt ${jobsToCheck.length} jobs der skal tjekkes`);

      if (jobsToCheck.length === 0) {
        this.log('✅ Alle jobs er opdateret - ingen tjek nødvendig');
        return {
          success: true,
          message: 'No jobs need checking - all jobs are up to date',
          closedJobs: [],
          totalChecked: 0
        };
      }

      const closedJobs: number[] = [];
      let checkedCount = 0;
      const startTime = Date.now();

      this.log(`🚀 Starter tjek af ${jobsToCheck.length} jobs...`);

      // Create a hidden tab that will be reused for all job checks
      const hiddenTab = await chrome.tabs.create({
        url: 'about:blank',
        active: false
      });

      if (!hiddenTab.id) {
        this.log('❌ Kunne ikke oprette skjult tab til job tjek');
        return {
          success: false,
          error: 'Failed to create hidden tab for job checking'
        };
      }

      // Check each job using the hidden tab
      for (const job of jobsToCheck) {
        try {
          const jobId = job.linkedin_job_id || job.id;
          const jobUrl = `${CONFIG.LINKEDIN.JOB_URL_PREFIX}${jobId}`;
          
          // Log job summary with LinkedIn link
          this.logJobSummary(job, checkedCount, jobsToCheck.length, job.updated_at);
          
          // Check if the hidden tab still exists, if not stop processing
          try {
            await chrome.tabs.get(hiddenTab.id);
          } catch (tabError) {
            const currentTime = Date.now();
            const elapsedTime = Math.round((currentTime - startTime) / 1000);
            const averageTimePerJob = checkedCount > 0 ? Math.round((currentTime - startTime) / checkedCount / 1000) : 0;
            const remainingJobs = jobsToCheck.length - checkedCount;
            const estimatedTimeForRemaining = remainingJobs * averageTimePerJob;
            const estimatedMinutes = Math.floor(estimatedTimeForRemaining / 60);
            const estimatedSeconds = estimatedTimeForRemaining % 60;
            
            this.log('ℹ️ Tab blev lukket - stopper job tjek');
            this.log(`⏱️ Køretid: ${elapsedTime}s | Gennemsnit: ${averageTimePerJob}s per job`);
            if (remainingJobs > 0) {
              this.log(`📊 Estimeret tid for resterende ${remainingJobs} jobs: ${estimatedMinutes}m ${estimatedSeconds}s`);
            }
            break;
          }
          
          // Navigate to the job URL in the hidden tab
          await chrome.tabs.update(hiddenTab.id, { url: jobUrl });
          
          // Wait for page to load
          await this.waitForTabLoad(hiddenTab.id);
          
          // Check if the job is closed by looking for the specific text
          const isClosed = await this.checkIfJobIsClosed(hiddenTab.id);
          
          if (isClosed) {
            closedJobs.push(jobId);
            
            // Call the API to mark the job as closed
            const closeResponse = await apiClient.closeJob(jobId);
            this.logJobResult(jobId, true, closeResponse.success);
          } else {
            this.logJobResult(jobId, false, true);
          }
          
          // Mark the job as checked (regardless of whether it's closed or not)
          const checkedResponse = await apiClient.markJobAsChecked(jobId);
          if (!checkedResponse.success) {
            this.log(`⚠️ Kunne ikke markere job ${jobId} som tjekket: ${checkedResponse.message}`);
          }
          
          checkedCount++;
          
          // Add a small delay to avoid overwhelming LinkedIn
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          // Only log error if it's not a tab closure error
          if (!error.message?.includes('No tab with id')) {
            this.log(`❌ Fejl ved tjek af job ${job.linkedin_job_id || job.id}:`, error);
          }
          checkedCount++;
        }
      }

      // Close the hidden tab when done (if it still exists)
      try {
        await chrome.tabs.remove(hiddenTab.id);
      } catch (tabError) {
        this.log('ℹ️ Skjult tab var allerede lukket');
      }

      const endTime = Date.now();
      const totalTimeMs = endTime - startTime;
      const totalTimeSeconds = Math.round(totalTimeMs / 1000);
      const averageTimePerJob = checkedCount > 0 ? Math.round(totalTimeMs / checkedCount) : 0;
      const averageTimePerJobSeconds = Math.round(averageTimePerJob / 1000);
      
      // Calculate estimated time for remaining jobs
      const remainingJobs = jobsToCheck.length - checkedCount;
      const estimatedTimeForRemaining = remainingJobs * averageTimePerJob;
      const estimatedMinutes = Math.floor(estimatedTimeForRemaining / 60000);
      const estimatedSeconds = Math.round((estimatedTimeForRemaining % 60000) / 1000);
      
      this.log(`🏁 Tjek afsluttet: ${checkedCount} jobs tjekket, ${closedJobs.length} lukket`);
      this.log(`⏱️ Køretid: ${totalTimeSeconds}s | Gennemsnit: ${averageTimePerJobSeconds}s per job`);
      
      if (remainingJobs > 0) {
        this.log(`📊 Estimeret tid for resterende ${remainingJobs} jobs: ${estimatedMinutes}m ${estimatedSeconds}s`);
      }
      
      return {
        success: true,
        message: `Checked ${checkedCount} jobs, found ${closedJobs.length} closed jobs`,
        closedJobs,
        totalChecked: checkedCount
      };

    } catch (error) {
      this.log('❌ Fejl under job tjek:', error);
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
      return isClosed;
    } catch (error) {
      this.log('❌ Fejl ved tjek om job er lukket:', error);
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
