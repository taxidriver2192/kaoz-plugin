/**
 * Job Description Scraper
 * Scrapes job descriptions from various platforms and sends to API
 */

import { JOB_DESCRIPTION_PLATFORMS, detectPlatformFromUrl, PlatformConfig, getEnabledPlatforms, getDisabledPlatforms } from '../config/jobDescriptionConfig.js';
import { multiSourceApiClient, MultiSourceJobDetails } from '../utils/multiSourceApiClient.js';
import { showNotification, NotificationType } from '../utils/uiUtils.js';

export interface JobDescriptionScrapeResult {
  success: boolean;
  description: string | null;
  platform?: string;
  error?: string;
}

export class JobDescriptionScraper {
  private log(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [JOB_DESCRIPTION_SCRAPER] ${message}`, ...args);
  }

  private showNotification(message: string, type: NotificationType = 'success') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [JOB_DESCRIPTION_SCRAPER] [NOTIFICATION] ${message}`);
    showNotification(message, type);
  }

  /**
   * Scrape job description and send to API
   */
  async scrapeJobDescriptionAndSend(job: any): Promise<JobDescriptionScrapeResult> {
    this.log(`🔍 Starting description scrape for: ${job.title} at ${job.company}`);
    this.log(`🔗 URL: ${job.finalUrl}`);
    
    try {
      // Detect platform from URL
      const platform = detectPlatformFromUrl(job.finalUrl);
      
      if (!platform) {
        this.log(`❌ Unsupported or disabled platform for URL: ${job.finalUrl}`);
        return { 
          success: false, 
          description: null, 
          error: 'Unsupported or disabled platform' 
        };
      }
      
      this.log(`📱 Detected platform: ${platform.displayName}`);
      
      // Navigate to the job page
      this.log(`🔄 Navigating to: ${job.finalUrl}`);
      window.location.href = job.finalUrl;
      
      // Wait for page to load - use a more robust waiting mechanism
      const waitTime = platform.waitTime || 3000;
      this.log(`⏳ Waiting ${waitTime}ms for page to load...`);
      
      // Wait for DOM to be ready and then additional time
      await this.waitForPageLoad(waitTime);
      
      // Log current page info
      this.log(`📍 Current page URL: ${window.location.href}`);
      this.log(`📍 Current page title: ${document.title}`);
      
      // Try to find description using platform-specific selectors
      this.log(`🔍 Trying ${platform.descriptionSelectors.length} selectors:`, platform.descriptionSelectors);
      const description = await this.findElementBySelectors(platform.descriptionSelectors);
      
      if (description) {
        this.log(`✅ Found description using ${platform.displayName} selectors`);
        this.log(`📝 Description length: ${description.length} characters`);
        
        // Update job object with description
        job.description = description;
        
        // Send to API
        const apiResult = await this.sendJobToApi(job);
        
        if (apiResult.success) {
          this.log(`✅ Successfully sent job to API: ${job.title}`);
          return { 
            success: true, 
            description, 
            platform: platform.name 
          };
        } else {
          this.log(`❌ Failed to send job to API: ${apiResult.error}`);
          return { 
            success: false, 
            description, 
            platform: platform.name,
            error: `API error: ${apiResult.error}`
          };
        }
      } else {
        this.log(`❌ No description found on ${platform.displayName} page`);
        return { 
          success: false, 
          description: null, 
          platform: platform.name,
          error: 'No description found' 
        };
      }
      
    } catch (error) {
      this.log(`❌ Error scraping description:`, error);
      return { 
        success: false, 
        description: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send job data to API
   */
  private async sendJobToApi(job: any): Promise<{ success: boolean; error?: string }> {
    try {
      // Convert job data to API format
      const jobDetails: MultiSourceJobDetails = {
        source: 'jobindex',
        source_job_id: job.id,
        source_url: job.finalUrl,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        posted_date: job.publishedDate,
        apply_url: job.finalUrl
      };
      
      this.log(`📤 Sending job to API:`, jobDetails);
      
      const response = await multiSourceApiClient.sendJobData(jobDetails);
      
      if (response.success) {
        this.log(`✅ Job sent to API successfully`);
        return { success: true };
      } else {
        this.log(`❌ API error: ${response.message}`);
        return { success: false, error: response.message };
      }
      
    } catch (error) {
      this.log(`❌ Error sending to API:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown API error' 
      };
    }
  }

  /**
   * Try multiple selectors to find an element
   */
  private async findElementBySelectors(selectors: string[]): Promise<string | null> {
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      try {
        this.log(`🔍 Trying selector ${i + 1}/${selectors.length}: ${selector}`);
        const element = document.querySelector<HTMLElement>(selector);
        
        if (element) {
          this.log(`✅ Found element with selector: ${selector}`);
          const text = element.innerText?.trim();
          
          if (text) {
            this.log(`📝 Element text length: ${text.length} characters`);
            // Basic validation - description should be reasonably long
            if (text.length > 50) {
              this.log(`✅ Found valid content using selector: ${selector} (${text.length} chars)`);
              return text;
            } else {
              this.log(`⚠️ Text too short (${text.length} chars), trying next selector`);
            }
          } else {
            this.log(`⚠️ Element found but no text content`);
          }
        } else {
          this.log(`❌ No element found with selector: ${selector}`);
        }
      } catch (error) {
        this.log(`❌ Error with selector ${selector}:`, error);
        // Continue to next selector if this one fails
        continue;
      }
    }
    
    this.log(`❌ No valid content found with any of the ${selectors.length} selectors`);
    return null;
  }

  /**
   * Process all jobs from storage, scrape descriptions and send to API
   */
  async processAllJobsFromStorage(): Promise<void> {
    this.log('🚀 Starting bulk description scraping and API sending...');
    
    // Log platform status
    const enabledPlatforms = getEnabledPlatforms();
    const disabledPlatforms = getDisabledPlatforms();
    
    this.log(`✅ Enabled platforms: ${enabledPlatforms.map(p => p.displayName).join(', ')}`);
    this.log(`❌ Disabled platforms: ${disabledPlatforms.map(p => p.displayName).join(', ')}`);
    
    try {
      // Get jobs from storage
      const jobs: any[] = await new Promise((resolve) => {
        chrome.storage?.local?.get(['jobindexBulkJobs'], (data) => {
          resolve((data?.jobindexBulkJobs as any[]) || []);
        });
      });
      
      this.log(`📊 Found ${jobs.length} jobs in storage`);
      
      if (jobs.length === 0) {
        this.showNotification('❌ No jobs found in storage', 'error');
        return;
      }
      
      // Log sample of jobs for debugging
      this.log(`📋 Sample jobs from storage:`, jobs.slice(0, 3).map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        finalUrl: job.finalUrl,
        hasDescription: !!job.description
      })));
      
      // Filter jobs that have finalUrl and no description yet
      const jobsToProcess = jobs.filter(job => {
        const hasFinalUrl = !!job.finalUrl;
        const hasNoDescription = !job.description;
        const platformSupported = detectPlatformFromUrl(job.finalUrl);
        
        this.log(`🔍 Job ${job.id}: hasFinalUrl=${hasFinalUrl}, hasNoDescription=${hasNoDescription}, platformSupported=${!!platformSupported}`);
        
        return hasFinalUrl && hasNoDescription && platformSupported;
      });
      
      this.log(`📋 Found ${jobsToProcess.length} jobs to process (with finalUrl and no description)`);
      
      if (jobsToProcess.length === 0) {
        this.showNotification('ℹ️ No jobs need description scraping', 'warning');
        return;
      }
      
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;
      const platformStats: Record<string, { success: number; error: number }> = {};
      
      for (const job of jobsToProcess) {
        try {
          processedCount++;
          const platform = detectPlatformFromUrl(job.finalUrl);
          const platformName = platform?.name || 'unknown';
          
          this.log(`🔄 Processing job ${processedCount}/${jobsToProcess.length}: ${job.title} at ${job.company}`);
          
          // Initialize platform stats
          if (!platformStats[platformName]) {
            platformStats[platformName] = { success: 0, error: 0 };
          }
          
          // Scrape description and send to API
          const result = await this.scrapeJobDescriptionAndSend(job);
          
          if (result.success) {
            successCount++;
            platformStats[platformName].success++;
            this.log(`✅ Successfully processed: ${job.title}`);
          } else {
            errorCount++;
            platformStats[platformName].error++;
            this.log(`❌ Failed to process: ${job.title} - ${result.error}`);
          }
          
          // Small delay between jobs
          await this.sleep(2000);
          
        } catch (error) {
          errorCount++;
          this.log(`❌ Error processing job ${job.title}:`, error);
        }
      }
      
      this.log(`🏁 Description scraping and API sending completed!`);
      this.log(`📊 Processed: ${processedCount}, Success: ${successCount}, Errors: ${errorCount}`);
      this.log(`📊 Platform statistics:`, platformStats);
      
      this.showNotification(
        `✅ Processing completed! Success: ${successCount}, Errors: ${errorCount}`,
        successCount > 0 ? 'success' : 'error'
      );
      
      // Send completion message via storage (more reliable than tabs.sendMessage)
      this.log(`📡 Storing completion result...`);
      try {
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({
            'scrapingCompleted': {
              timestamp: Date.now(),
              result: {
                processed: processedCount,
                success: successCount,
                errors: errorCount,
                platformStats: platformStats
              }
            }
          }, () => {
            this.log(`✅ Completion result stored`);
            resolve();
          });
        });
      } catch (error) {
        this.log(`❌ Failed to store completion result:`, error);
      }
      
    } catch (error) {
      this.log('❌ Error during bulk processing:', error);
      this.showNotification('❌ Error during processing', 'error');
      
      // Send error message via storage
      this.log(`📡 Storing error result...`);
      try {
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({
            'scrapingCompleted': {
              timestamp: Date.now(),
              result: {
                processed: 0,
                success: 0,
                errors: 1,
                platformStats: {},
                error: error instanceof Error ? error.message : String(error)
              }
            }
          }, () => {
            this.log(`✅ Error result stored`);
            resolve();
          });
        });
      } catch (sendError) {
        this.log(`❌ Failed to store error result:`, sendError);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for page to load with more robust checking
   */
  private async waitForPageLoad(additionalWaitTime: number): Promise<void> {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      this.log(`⏳ DOM still loading, waiting for DOMContentLoaded...`);
      await new Promise<void>((resolve) => {
        const onReady = () => {
          document.removeEventListener('DOMContentLoaded', onReady);
          resolve();
        };
        document.addEventListener('DOMContentLoaded', onReady);
      });
    }
    
    this.log(`✅ DOM is ready, waiting additional ${additionalWaitTime}ms...`);
    
    // Wait for any additional time specified
    await this.sleep(additionalWaitTime);
    
    // Check if page is fully loaded
    if (document.readyState === 'complete') {
      this.log(`✅ Page fully loaded`);
    } else {
      this.log(`⚠️ Page not fully loaded yet (readyState: ${document.readyState})`);
    }
  }
}
