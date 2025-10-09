/**
 * Jobindex Bulk Batch Scraper - Background Script Orchestrator
 * Opens tabs for each page and scrapes job listings from Jobindex search results
 */

import { JobindexJobListing } from '../content/jobindexBulkScraper.js';

export interface BulkScrapingProgress {
  currentPage: number;
  totalPages: number;  // -1 means unknown, will continue until no jobs found
  jobsCollected: number;
  currentUrl: string;
}

export interface BulkScrapingResult {
  processed: number;
  jobsCollected: number;
  errors: number;
  errorMessages: string[];
}

export class JobindexBulkBatchScraper {
  private isRunning = false;
  private shouldStop = false;
  private currentTabId: number | null = null;

  private log(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [JOBINDEX_BULK_BATCH] ${message}`, ...args);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start bulk scraping of Jobindex search results across multiple pages
   * Will continue until no more jobs are found
   */
  async startBulkScraping(baseUrl: string): Promise<void> {
    if (this.isRunning) {
      this.log('⚠️ Bulk scraping already running');
      return;
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.log(`🚀 Starting Jobindex bulk scraping from ${baseUrl} (will continue until no more jobs found)...`);

    try {
      const allJobs: JobindexJobListing[] = [];
      const errors: string[] = [];
      let pageNum = 1;
      let hasMoreJobs = true;

      // Initialize progress
      await this.updateProgress({
        currentPage: 0,
        totalPages: -1,  // Unknown total, will scrape until empty
        jobsCollected: 0,
        currentUrl: baseUrl
      });

      // Scrape pages until no more jobs found
      while (hasMoreJobs && !this.shouldStop) {
        this.log(`\n${'='.repeat(60)}`);
        this.log(`📄 PROCESSING PAGE ${pageNum}`);
        this.log(`${'='.repeat(60)}`);

        try {
          // Build page URL
          const pageUrl = new URL(baseUrl);
          pageUrl.searchParams.set('page', pageNum.toString());
          const urlToScrape = pageUrl.toString();

          this.log(`🔗 Page URL: ${urlToScrape}`);

          // Update progress
          await this.updateProgress({
            currentPage: pageNum,
            totalPages: -1,  // Unknown
            jobsCollected: allJobs.length,
            currentUrl: urlToScrape
          });

          // Scrape this page
          const pageJobs = await this.scrapePageInNewTab(urlToScrape, pageNum);

          if (pageJobs.length === 0) {
            this.log(`✅ No jobs found on page ${pageNum} - reached the end`);
            hasMoreJobs = false;
            break;
          }

          // Add to collection
          allJobs.push(...pageJobs);
          this.log(`✅ Page ${pageNum} complete: ${pageJobs.length} jobs found`);
          this.log(`📊 Total jobs collected: ${allJobs.length}`);

          // Save progress after each page
          await this.saveJobsToStorage(allJobs);
          this.log(`💾 Saved ${allJobs.length} jobs to storage`);

          // Move to next page
          pageNum++;

          // Minimal delay between pages (reduced from 2s to 300ms)
          await this.sleep(300);

        } catch (error) {
          const errorMsg = `Page ${pageNum} failed: ${error instanceof Error ? error.message : String(error)}`;
          this.log(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          
          // Stop on error to avoid infinite loop
          hasMoreJobs = false;
        }
      }

      if (this.shouldStop) {
        this.log('🛑 Bulk scraping stopped by user');
      }

      // Set completion
      this.log(`\n${'='.repeat(60)}`);
      this.log(`✅ BULK SCRAPING COMPLETE`);
      this.log(`📊 Total pages scraped: ${pageNum - 1}`);
      this.log(`📊 Total jobs collected: ${allJobs.length}`);
      this.log(`❌ Errors: ${errors.length}`);
      this.log(`${'='.repeat(60)}\n`);

      await this.setCompletion({
        processed: pageNum - 1,
        jobsCollected: allJobs.length,
        errors: errors.length,
        errorMessages: errors
      });

    } catch (error) {
      this.log('❌ Error during bulk scraping:', error);
      await this.setCompletion({
        processed: 0,
        jobsCollected: 0,
        errors: 1,
        errorMessages: [error instanceof Error ? error.message : String(error)]
      });
    } finally {
      this.isRunning = false;
      this.shouldStop = false;
    }
  }

  /**
   * Scrape a single page by opening it in a new tab
   */
  private async scrapePageInNewTab(url: string, pageNum: number): Promise<JobindexJobListing[]> {
    this.log(`🔗 Opening tab for page ${pageNum}: ${url}`);

    try {
      // Open new tab in BACKGROUND (faster, no tab switching needed)
      const tab = await chrome.tabs.create({
        url: url,
        active: false  // Open in background to avoid visual tab switching
      });

      this.currentTabId = tab.id!;
      this.log(`✅ Opened background tab ${tab.id} for page ${pageNum}`);

      // Wait for tab to load (with shorter timeout)
      await this.waitForTabLoad(tab.id!);
      this.log(`✅ Tab ${tab.id} loaded successfully`);

      // Minimal stabilization delay (reduced from 3s to 500ms)
      await this.sleep(500);

      // Send message to content script to scrape current page
      this.log(`📡 Requesting content script to scrape page ${pageNum}...`);
      const result = await this.sendMessageToTab(tab.id!, {
        action: 'scrapeJobindexCurrentPage'
      });

      this.log(`📦 Received response from page ${pageNum}:`, JSON.stringify(result).substring(0, 200));

      // Validate response
      if (!result || !result.success) {
        this.log(`❌ Failed to scrape page ${pageNum}: ${result?.error || 'Unknown error'}`);
        return [];
      }

      const jobs = result.jobs || [];
      this.log(`✅ Successfully scraped ${jobs.length} jobs from page ${pageNum}`);

      return jobs;

    } catch (error) {
      this.log(`❌ Error scraping page ${pageNum}:`, error);
      return [];
    } finally {
      // Close the tab immediately after scraping
      if (this.currentTabId) {
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

  /**
   * Wait for a tab to finish loading
   */
  private async waitForTabLoad(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, 10000);  // Reduced from 30s to 10s

      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Send message to a specific tab with retry logic
   */
  private async sendMessageToTab(tabId: number, message: any, retries: number = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
        return response;
      } catch (error) {
        if (i === retries - 1) {
          this.log(`❌ Message to tab ${tabId} failed after ${retries} attempts`);
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
        // Wait a bit before retry
        await this.sleep(200);
      }
    }
  }

  /**
   * Save jobs to storage
   */
  private async saveJobsToStorage(jobs: JobindexJobListing[]): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ jobindexBulkJobs: jobs }, () => {
        resolve();
      });
    });
  }

  /**
   * Update progress in storage
   */
  private async updateProgress(progress: BulkScrapingProgress): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        'bulkScrapingProgress': {
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
  private async setCompletion(result: BulkScrapingResult): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        'bulkScrapingCompleted': {
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
export const jobindexBulkBatchScraper = new JobindexBulkBatchScraper();
