/**
 * Job Description Batch Scraper - Background Script Orchestrator
 * Manages the entire scraping process by opening tabs, coordinating scraping, and tracking progress
 */

import { JOB_DESCRIPTION_PLATFORMS, detectPlatformFromUrl, PlatformConfig } from '../config/jobDescriptionConfig.js';
import { multiSourceApiClient, MultiSourceJobDetails } from '../utils/multiSourceApiClient.js';

export interface ScrapingProgress {
  current: number;
  total: number;
  currentJob: string;
  success: number;
  errors: number;
  platformStats: Record<string, { success: number; error: number }>;
}

export interface ScrapingResult {
  processed: number;
  success: number;
  errors: number;
  platformStats: Record<string, { success: number; error: number }>;
  error?: string;
}

export class JobDescriptionBatchScraper {
  private isRunning = false;
  private shouldStop = false;
  private currentTabId: number | null = null;
  private debugMode = false; // Enable debug mode - keeps tabs open and only processes first job

  private log(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [BATCH_SCRAPER] ${message}`, ...args);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start the batch scraping process
   */
  async startScraping(): Promise<void> {
    if (this.isRunning) {
      this.log('⚠️ Scraping already running');
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.log('🚀 Starting batch job description scraping...');

    try {
      // Get jobs from storage
      const jobs: any[] = await this.getJobsFromStorage();
      this.log(`📊 Found ${jobs.length} jobs in storage`);

      if (jobs.length === 0) {
        this.log('❌ No jobs found in storage');
        await this.setCompletion({
          processed: 0,
          success: 0,
          errors: 0,
          platformStats: {},
          error: 'No jobs found in storage'
        });
        return;
      }

      // Filter jobs that need description scraping
      const jobsToProcess = jobs.filter(job => {
        const hasFinalUrl = !!job.finalUrl;
        const hasNoDescription = !job.description;
        const platformSupported = detectPlatformFromUrl(job.finalUrl);
        
        this.log(`🔍 Job ${job.id}: hasFinalUrl=${hasFinalUrl}, hasNoDescription=${hasNoDescription}, platformSupported=${!!platformSupported}`);
        
        return hasFinalUrl && hasNoDescription && platformSupported;
      });

      this.log(`📋 Found ${jobsToProcess.length} jobs to process`);

      if (jobsToProcess.length === 0) {
        this.log('ℹ️ No jobs need description scraping');
        await this.setCompletion({
          processed: 0,
          success: 0,
          errors: 0,
          platformStats: {}
        });
        return;
      }

      // Initialize progress
      const progress: ScrapingProgress = {
        current: 0,
        total: jobsToProcess.length,
        currentJob: '',
        success: 0,
        errors: 0,
        platformStats: {}
      };

      await this.updateProgress(progress);

      // Process each job
      const maxJobsToProcess = this.debugMode ? 1 : jobsToProcess.length;
      if (this.debugMode) {
        this.log(`🐛 DEBUG MODE: Only processing first job, keeping tab open for inspection`);
      }
      
      for (let i = 0; i < maxJobsToProcess; i++) {
        if (this.shouldStop) {
          this.log('🛑 Scraping stopped by user');
          break;
        }

        const job = jobsToProcess[i];
        progress.current = i + 1;
        progress.currentJob = `${job.title} at ${job.company}`;

        this.log(`🔄 Processing job ${progress.current}/${maxJobsToProcess}: ${progress.currentJob}`);
        await this.updateProgress(progress);

        try {
          const result = await this.scrapeJobInNewTab(job);
          
          if (result.success) {
            progress.success++;
            const platformName = result.platform || 'unknown';
            if (!progress.platformStats[platformName]) {
              progress.platformStats[platformName] = { success: 0, error: 0 };
            }
            progress.platformStats[platformName].success++;
            
            this.log(`✅ Successfully scraped: ${job.title}`);
          } else {
            progress.errors++;
            const platformName = result.platform || 'unknown';
            if (!progress.platformStats[platformName]) {
              progress.platformStats[platformName] = { success: 0, error: 0 };
            }
            progress.platformStats[platformName].error++;
            
            this.log(`❌ Failed to scrape: ${job.title} - ${result.error}`);
          }

          await this.updateProgress(progress);

        } catch (error) {
          progress.errors++;
          this.log(`❌ Error processing job ${job.title}:`, error);
          await this.updateProgress(progress);
        }

        // Small delay between jobs (reduced for better performance)
        await this.sleep(300);
      }

      // Set completion
      await this.setCompletion({
        processed: progress.current,
        success: progress.success,
        errors: progress.errors,
        platformStats: progress.platformStats
      });

      this.log(`🏁 Batch scraping completed! Processed: ${progress.current}, Success: ${progress.success}, Errors: ${progress.errors}`);

    } catch (error) {
      this.log('❌ Error during batch scraping:', error);
      await this.setCompletion({
        processed: 0,
        success: 0,
        errors: 1,
        platformStats: {},
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.isRunning = false;
      this.shouldStop = false;
    }
  }

  /**
   * Scrape a single job by opening a new tab
   */
  private async scrapeJobInNewTab(job: any): Promise<{ success: boolean; description?: string; platform?: string; error?: string }> {
    this.log(`🔗 Opening tab for: ${job.finalUrl}`);
    
    try {
      // Open new tab in BACKGROUND (non-intrusive scraping)
      const tab = await chrome.tabs.create({
        url: job.finalUrl,
        active: false
      });

      this.currentTabId = tab.id!;
      this.log(`✅ Opened tab ${tab.id} for ${job.finalUrl} (background)`);

      // Wait for tab to load completely
      await this.waitForTabLoad(tab.id!);

      // Check if tab was redirected to archive (job is closed/deleted)
      const loadedTab = await chrome.tabs.get(tab.id!);
      const currentUrl = loadedTab.url || '';
      
      if (currentUrl.includes('jobindexarkiv.dk')) {
        this.log(`🗑️ Job redirected to archive - job is closed/deleted: ${currentUrl}`);
        this.log(`⏭️ Skipping this job and removing from storage...`);
        
        // Remove job from storage
        await this.removeJobFromStorage(job.id);
        
        return { 
          success: false, 
          error: 'Job is closed/deleted (redirected to archive)',
          platform: 'jobindex'
        };
      }

      // Detect platform and get reduced wait time (background tabs load faster)
      const platform = detectPlatformFromUrl(currentUrl);
      const waitTime = platform?.waitTime || 500;
      
      // Wait for page to stabilize
      this.log(`⏳ Waiting ${waitTime}ms for page to stabilize...`);
      await this.sleep(waitTime);

      // STEP 1: Inject platform configuration as global variable FIRST
      this.log(`📦 Injecting platform configuration into tab ${tab.id}...`);
      try {
        // Get platform config from imported module
        const platformConfigData = JOB_DESCRIPTION_PLATFORMS;
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: (configData: any) => {
            // Inject the platform config as a global variable
            (window as any).JOB_DESCRIPTION_PLATFORMS = configData;
            
            // Also inject the detection function
            (window as any).detectPlatformFromUrl = function(url: string) {
              const platforms = (window as any).JOB_DESCRIPTION_PLATFORMS;
              if (!platforms) {
                console.error('[PLATFORM_DETECT] No platforms config available');
                return null;
              }
              
              for (const [key, config] of Object.entries(platforms)) {
                const platformConfig = config as any;
                // Only check enabled platforms
                if (!platformConfig.enabled) {
                  continue;
                }
                
                for (const pattern of platformConfig.urlPatterns) {
                  if (url.includes(pattern)) {
                    console.log(`[PLATFORM_DETECT] ✅ Matched platform: ${platformConfig.name} for pattern: ${pattern}`);
                    return platformConfig;
                  }
                }
              }
              console.log('[PLATFORM_DETECT] ❌ No enabled platform matched for URL:', url);
              return null;
            };

            console.log('[BACKGROUND] ✅ Platform config injected successfully');
            console.log('[BACKGROUND] 📊 Total platforms:', Object.keys(configData).length);
            const enabledPlatforms = Object.entries(configData)
              .filter(([_, cfg]: [string, any]) => cfg.enabled)
              .map(([key, cfg]: [string, any]) => `${cfg.name} (${cfg.descriptionSelectors.length} selectors)`);
            console.log('[BACKGROUND] ✅ Enabled platforms:', enabledPlatforms);
          },
          args: [platformConfigData]
        });
        this.log(`✅ Platform configuration injected successfully`);
        this.log(`📊 Injected ${Object.keys(platformConfigData).length} platform configs from jobDescriptionConfig.ts`);
      } catch (error) {
        this.log(`❌ Failed to inject platform configuration:`, error);
        throw new Error(`Platform config injection failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      // STEP 2: Now inject content script (REMOVED OLD HARDCODED CONFIG - NOW USING IMPORTED DATA)
      this.log(`📦 Injecting content script into tab ${tab.id}...`);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ['multiSourceScraper.js']
        });
        this.log(`✅ Content script injected successfully`);
        
        // Wait for content script to initialize (reduced for background tabs)
        this.log(`⏳ Waiting 500ms for content script to initialize...`);
        await this.sleep(500);
      } catch (error) {
        this.log(`❌ Failed to inject content script:`, error);
        throw new Error(`Content script injection failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Verify content script is responding
      this.log(`🏓 Verifying content script is responding in tab ${tab.id}...`);
      const isPresent = await this.pingContentScript(tab.id!);

      if (!isPresent) {
        this.log(`❌ Content script not responding after injection`);
        this.log(`⚠️ Waiting additional 1 second and retrying...`);
        await this.sleep(1000);
        
        const isPresent2 = await this.pingContentScript(tab.id!);
        if (!isPresent2) {
          throw new Error('Content script not responding after injection and retry');
        }
        this.log(`✅ Content script responding after retry`);
      } else {
        this.log(`✅ Content script is active and ready`);
      }

      // Send scrape message to content script
      this.log(`📡 Sending scrape message to content script...`);
      const result = await this.sendMessageToTab(tab.id!, {
        action: 'scrapeCurrentPageDescription',
        url: job.finalUrl
      });

      // Log raw response for debugging
      this.log(`📦 Received response:`, JSON.stringify(result).substring(0, 300));

      // Validate response structure
      if (!result) {
        this.log(`❌ No response received from content script`);
        return {
          success: false,
          error: 'No response from content script'
        };
      }

      if (result.success && result.description) {
        this.log(`✅ Description found (${result.description.length} chars)`);
        
        // Update job with description
        await this.updateJobWithDescription(job, result.description);
        
        // Send to API
        await this.sendJobToApi(job, result.description);
        
        this.log(`✅ Successfully scraped and sent to API: ${job.title}`);
        return { success: true, description: result.description, platform: result.platform };
      } else {
        this.log(`❌ Scraping failed: ${result.error || 'Unknown reason'}`);
        this.log(`📊 Response details - success: ${result.success}, platform: ${result.platform}, error: ${result.error}`);
        return { 
          success: false, 
          error: result.error || 'No description found',
          platform: result.platform
        };
      }

    } catch (error) {
      this.log(`❌ Error scraping job in new tab:`, error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      // Close the tab (ONLY if not in debug mode)
      if (this.currentTabId) {
        if (this.debugMode) {
          this.log(`🐛 DEBUG MODE: Keeping tab ${this.currentTabId} open for inspection`);
          this.log(`🐛 Open DevTools (F12) on the new tab to see console logs and inspect the page`);
          this.log(`🐛 The tab will remain open - you can manually close it when done`);
          // Switch to the debug tab so user can inspect it
          try {
            await chrome.tabs.update(this.currentTabId, { active: true });
            this.log(`🐛 Switched to debug tab ${this.currentTabId}`);
          } catch (error) {
            this.log(`⚠️ Could not switch to debug tab:`, error);
          }
          this.currentTabId = null; // Clear reference but don't close
        } else {
          // Production mode - close the tab
          try {
            await chrome.tabs.remove(this.currentTabId);
            this.log(`🗑️ Closed tab ${this.currentTabId}`);
          } catch (error) {
            this.log(`⚠️ Error closing tab:`, error);
          }
          this.currentTabId = null;
        }
      }
    }
  }

  /**
   * Wait for a tab to finish loading
   */
  private async waitForTabLoad(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, 10000); // 10 second timeout (reduced for better performance)

      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          this.log(`✅ Tab ${tabId} loaded successfully`);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Test if content script is responding in a tab
   */
  private async pingContentScript(tabId: number): Promise<boolean> {
    try {
      const response = await this.sendMessageToTab(tabId, { action: 'ping' });
      return response?.success === true;
    } catch {
      return false;
    }
  }

  /**
   * Send message to a specific tab
   */
  private async sendMessageToTab(tabId: number, message: any): Promise<any> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          this.log(`❌ Message to tab ${tabId} failed:`, chrome.runtime.lastError.message);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Update job with scraped description
   */
  private async updateJobWithDescription(job: any, description: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['jobindexBulkJobs'], (data) => {
        const jobs = (data.jobindexBulkJobs as any[]) || [];
        const jobIndex = jobs.findIndex(j => j.id === job.id);
        
        if (jobIndex !== -1) {
          jobs[jobIndex].description = description;
          chrome.storage.local.set({ jobindexBulkJobs: jobs }, () => {
            this.log(`💾 Updated job ${job.id} with description`);
            resolve();
          });
        } else {
          this.log(`⚠️ Job ${job.id} not found in storage`);
          resolve();
        }
      });
    });
  }

  /**
   * Ensure company exists in backend and get company ID
   */
  private async ensureCompanyExists(companyName: string): Promise<number | null> {
    try {
      this.log(`🏢 Checking if company exists: ${companyName}`);
      
      // Check if company exists
      const existsResp = await multiSourceApiClient.checkCompanyExists(companyName);
      
      if (existsResp.success && existsResp.data?.exists) {
        const companyId = existsResp.data.company?.company_id ?? null;
        this.log(`✅ Company exists: ${companyName} (company_id=${companyId})`);
        return companyId;
      }

      // Create company if it doesn't exist
      this.log(`🆕 Company doesn't exist, creating: ${companyName}`);
      const createResp = await multiSourceApiClient.createCompany({ 
        name: companyName 
      });
      
      if (createResp.success && createResp.data?.company?.company_id) {
        const companyId = createResp.data.company.company_id;
        this.log(`✅ Company created: ${companyName} (company_id=${companyId})`);
        return companyId;
      }

      this.log(`❌ Failed to create company: ${createResp.message}`);
      return null;
    } catch (error) {
      this.log(`❌ Error ensuring company exists:`, error);
      return null;
    }
  }

  /**
   * Send job with description to API
   */
  private async sendJobToApi(job: any, description: string): Promise<void> {
    try {
      const platform = detectPlatformFromUrl(job.finalUrl);
      
      this.log(`📋 Preparing job data for API...`);
      this.log(`  - Job ID: ${job.id}`);
      this.log(`  - Title: ${job.title}`);
      this.log(`  - Company: ${job.company}`);
      this.log(`  - Platform: ${platform?.name || 'unknown'}`);
      this.log(`  - Description length: ${description?.length || 0} chars`);
      
      // Get source_id directly from platform config (now includes sourceId property)
      const sourceId = platform?.sourceId || 0;
      
      this.log(`  - Source ID: ${sourceId} (from platform.sourceId)`);
      
      // Validate we have required source information
      if (sourceId === 0) {
        this.log(`❌ Platform "${platform?.name}" has no valid sourceId configured`);
        this.log(`⚠️ Skipping API send - no valid source_id`);
        return;
      }
      
      if (!job.id || !job.finalUrl) {
        this.log(`❌ Missing required job information: id=${job.id}, finalUrl=${job.finalUrl}`);
        this.log(`⚠️ Skipping API send - missing required fields`);
        return;
      }
      
      // Ensure company exists and get company_id
      if (!job.company) {
        this.log(`❌ No company name provided`);
        this.log(`⚠️ Skipping API send - company name is required`);
        return;
      }
      
      const companyId = await this.ensureCompanyExists(job.company);
      
      if (!companyId) {
        this.log(`❌ Could not get/create company_id for: ${job.company}`);
        this.log(`⚠️ Skipping API send - company_id is required`);
        return;
      }
      
      this.log(`  - Company ID: ${companyId}`);
      
      const jobDetails: MultiSourceJobDetails = {
        // Core job data
        title: job.title || '',
        location: job.location || '',
        description: description || '',
        apply_url: job.finalUrl || '',
        posted_date: job.publishedDate || new Date().toISOString().slice(0, 16).replace('T', ' '),
        skills: job.skills || [],
        company: job.company || '',
        company_id: companyId, // Retrieved from API
        
        // Platform-specific data
        source_id: sourceId,
        source_job_id: String(job.id),
        source_url: job.finalUrl || '',
        applicants: job.applicants || null
      };

      this.log(`📤 Sending job to API...`);
      const result = await multiSourceApiClient.sendJobData(jobDetails);
      
      if (result.success) {
        this.log(`✅ Successfully sent job ${job.id} to API`);
        if (result.data) {
          this.log(`📊 API Response Data:`, result.data);
        }
      } else {
        this.log(`❌ API returned failure: ${result.message}`);
      }
    } catch (error) {
      this.log(`❌ Error sending job to API:`, error);
      // Don't throw - we still want to continue with other jobs
    }
  }

  /**
   * Get jobs from storage
   */
  private async getJobsFromStorage(): Promise<any[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['jobindexBulkJobs'], (data) => {
        resolve((data.jobindexBulkJobs as any[]) || []);
      });
    });
  }

  /**
   * Remove job from storage (for closed/deleted jobs)
   */
  private async removeJobFromStorage(jobId: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['jobindexBulkJobs'], (data) => {
        const jobs = (data.jobindexBulkJobs as any[]) || [];
        const filteredJobs = jobs.filter(j => j.id !== jobId);
        
        this.log(`🗑️ Removing job ${jobId} from storage (${jobs.length} -> ${filteredJobs.length} jobs)`);
        
        chrome.storage.local.set({ jobindexBulkJobs: filteredJobs }, () => {
          this.log(`✅ Job ${jobId} removed from storage`);
          resolve();
        });
      });
    });
  }

  /**
   * Update progress in storage
   */
  private async updateProgress(progress: ScrapingProgress): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        'scrapingProgress': {
          timestamp: Date.now(),
          progress: progress
        }
      }, () => {
        resolve();
      });
    });
  }

  /**
   * Set completion result in storage
   */
  private async setCompletion(result: ScrapingResult): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        'scrapingCompleted': {
          timestamp: Date.now(),
          result: result
        }
      }, () => {
        this.log(`✅ Completion result stored`);
        resolve();
      });
    });
  }

  /**
   * Stop the scraping process
   */
  stopScraping(): void {
    this.log('🛑 Stop signal received');
    this.shouldStop = true;
  }

  /**
   * Check if scraping is running
   */
  isScrapingRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const batchScraper = new JobDescriptionBatchScraper();
