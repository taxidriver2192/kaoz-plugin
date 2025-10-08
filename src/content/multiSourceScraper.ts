/**
 * Multi-Source Job Scraper
 * Automatically detects platform and uses appropriate scraper
 */

import { PlatformDetector } from '../utils/platformDetector.js';
import { showNotification, NotificationType } from '../utils/uiUtils.js';

class MultiSourceScraper {
  private log(message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MULTI_SOURCE_SCRAPER] ${message}`, ...args);
  }

  private showNotification(message: string, type: NotificationType = 'success') {
    showNotification(message, type);
  }

  /**
   * Detect current platform and show appropriate notification
   */
  private detectAndNotifyPlatform(): { platform: any; jobId: string | null; isSearchPage: boolean } | null {
    const detected = PlatformDetector.detectCurrentPlatform();
    
    if (!detected) {
      this.log('❌ No supported platform detected');
      this.showNotification('❌ Unsupported platform - only LinkedIn and Jobindex.dk are supported', 'error');
      return null;
    }

    if (!detected.isJobPage && !detected.isSearchPage) {
      this.log(`❌ Not on a job page or search page for ${detected.platform.displayName}`);
      this.showNotification(`❌ Please navigate to a job page or search page on ${detected.platform.displayName}`, 'error');
      return null;
    }

    if (detected.isJobPage && !detected.jobId) {
      this.log(`❌ Could not extract job ID from ${detected.platform.displayName} page`);
      this.showNotification(`❌ Could not extract job ID from ${detected.platform.displayName} page`, 'error');
      return null;
    }

    if (detected.isJobPage) {
      this.log(`✅ Detected ${detected.platform.displayName} job page with ID: ${detected.jobId}`);
      this.showNotification(`🔍 Detected ${detected.platform.displayName} job - starting scrape...`, 'success');
    } else if (detected.isSearchPage) {
      this.log(`✅ Detected ${detected.platform.displayName} search page`);
      this.showNotification(`🔍 Detected ${detected.platform.displayName} search page - ready for bulk scraping`, 'success');
    }
    
    return {
      platform: detected.platform,
      jobId: detected.jobId,
      isSearchPage: detected.isSearchPage
    };
  }

  /**
   * Scrape job using platform-specific scraper
   */
  async scrapeJob(): Promise<void> {
    try {
      this.log('🚀 Starting multi-source job scraping...');
      
      const detected = this.detectAndNotifyPlatform();
      if (!detected) {
        return;
      }

      const { platform, jobId, isSearchPage } = detected;

      // Handle search pages (bulk scraping)
      if (isSearchPage) {
        await this.handleBulkScraping(platform);
        return;
      }

      // Handle individual job pages
      if (!jobId) {
        this.log(`❌ No job ID found for ${platform.displayName} page`);
        this.showNotification(`❌ No job ID found for ${platform.displayName} page`, 'error');
        return;
      }

      // Show platform-specific notification
      this.showNotification(`🔧 Scraping ${platform.displayName} job: ${jobId}`, 'success');

      // Import and use platform-specific scraper
      let scraper: any = null;

      switch (platform.name) {
        case 'linkedin':
          this.log('📱 Using LinkedIn scraper...');
          // Dynamic import of LinkedIn scraper
          const linkedinModule = await import('./scrapeJobs.js');
          scraper = new linkedinModule.JobScraper();
          break;

        case 'jobindex':
          this.log('📱 Using Jobindex scraper...');
          // Dynamic import of Jobindex scraper
          const jobindexModule = await import('./scrapeJobindex.js');
          scraper = new jobindexModule.JobindexJobScraper();
          break;

        default:
          this.log(`❌ No scraper available for platform: ${platform.name}`);
          this.showNotification(`❌ No scraper available for ${platform.displayName}`, 'error');
          return;
      }

      if (scraper && typeof scraper.scrapeJob === 'function') {
        this.log(`🎯 Executing ${platform.displayName} scraper...`);
        await scraper.scrapeJob();
      } else {
        this.log(`❌ Scraper for ${platform.displayName} does not have scrapeJob method`);
        this.showNotification(`❌ Scraper error for ${platform.displayName}`, 'error');
      }

    } catch (error) {
      this.log('💥 Error during multi-source scraping:', error);
      this.showNotification('❌ Error during scraping', 'error');
    }
  }

  /**
   * Handle bulk scraping for search pages
   */
  private async handleBulkScraping(platform: any): Promise<void> {
    try {
      this.log(`🚀 Starting bulk scraping for ${platform.displayName}...`);

      switch (platform.name) {
        case 'jobindex':
          this.log('📱 Using Jobindex bulk scraper...');
          
          // Ask user if they want to scrape all pages or just current page
          const scrapeAllJobindexPages = confirm('Do you want to scrape all pages? (This may take a while)\n\nOK = Scrape all pages (opens new tabs)\nCancel = Scrape current page only');
          
          if (scrapeAllJobindexPages) {
            // Use background script to scrape all pages (opens new tabs)
            this.log('🚀 Starting background bulk scraping for all pages...');
            this.showNotification('🚀 Starting bulk scraping - opening new tabs for each page...', 'success');
            
            chrome.runtime.sendMessage({
              action: 'startJobindexBulkScraping',
              baseUrl: window.location.href,
              maxPages: 10
            }, (response) => {
              if (response?.success) {
                this.log('✅ Background bulk scraping started successfully');
                this.showNotification('✅ Bulk scraping started! Check console for progress.', 'success');
              } else {
                this.log('❌ Failed to start background bulk scraping:', response?.error);
                this.showNotification('❌ Failed to start bulk scraping', 'error');
              }
            });
          } else {
            // Scrape current page only
            this.log('📄 Scraping current page only...');
            const jobindexBulkModule = await import('./jobindexBulkScraper.js');
            const bulkScraper = new jobindexBulkModule.JobindexBulkScraper();
            await bulkScraper.scrapeCurrentPage();
          }
          break;

        case 'linkedin':
          this.log('📱 Using LinkedIn bulk scraper...');
          // Dynamic import of LinkedIn bulk scraper
          const linkedinBulkModule = await import('./scrapeJobs.js');
          const linkedinBulkScraper = new linkedinBulkModule.JobScraper();
          
          // Ask user if they want to scrape all pages or just current page
          const scrapeAllLinkedinPages = confirm('Do you want to scrape all pages? (This may take a while)');
          
          if (scrapeAllLinkedinPages) {
            await linkedinBulkScraper.bulkScrapeJobs();
          } else {
            // For LinkedIn, we can scrape the current search page
            await linkedinBulkScraper.scrapeLinkedInJobIds();
            this.showNotification('✅ LinkedIn job IDs collected from current page', 'success');
          }
          break;

        default:
          this.log(`❌ No bulk scraper available for platform: ${platform.name}`);
          this.showNotification(`❌ No bulk scraper available for ${platform.displayName}`, 'error');
          break;
      }
    } catch (error) {
      this.log('💥 Error during bulk scraping:', error);
      this.showNotification('❌ Error during bulk scraping', 'error');
    }
  }

  /**
   * Get current platform information
   */
  getCurrentPlatformInfo(): { platform: any; jobId: string | null; canScrape: boolean } | null {
    const detected = PlatformDetector.detectCurrentPlatform();
    
    if (!detected) {
      return null;
    }

    return {
      platform: detected.platform,
      jobId: detected.jobId,
      canScrape: detected.isJobPage && !!detected.jobId
    };
  }

  /**
   * Show current platform status
   */
  showPlatformStatus(): void {
    const info = this.getCurrentPlatformInfo();
    
    if (!info) {
      this.showNotification('❌ Unsupported platform', 'error');
      return;
    }

    const { platform, jobId, canScrape } = info;
    
    if (canScrape) {
      this.showNotification(`✅ ${platform.displayName} job detected (ID: ${jobId})`, 'success');
    } else {
      this.showNotification(`⚠️ ${platform.displayName} detected but not on job page`, 'warning');
    }
  }

  /**
   * Scrape description from current page only (no navigation)
   */
  async scrapeCurrentPageDescription(expectedUrl?: string): Promise<{ success: boolean; description?: string; platform?: string; error?: string }> {
    this.log(`🔍 Starting description scrape for current page`);
    this.log(`🔗 Current URL: ${window.location.href}`);
    this.log(`📄 Page title: ${document.title}`);
    this.log(`📊 Document ready state: ${document.readyState}`);
    
    if (expectedUrl && window.location.href !== expectedUrl) {
      this.log(`⚠️ URL mismatch - expected: ${expectedUrl}, actual: ${window.location.href}`);
    }
    
    try {
      // Use the global detectPlatformFromUrl function injected by background script
      const detectFunc = (window as any).detectPlatformFromUrl;
      
      if (!detectFunc) {
        this.log(`❌ detectPlatformFromUrl function not found in window - config not injected?`);
        return { 
          success: false, 
          error: 'Platform configuration not available' 
        };
      }
      
      // Detect platform from current URL using injected function
      const platform = detectFunc(window.location.href);
      
      if (!platform) {
        this.log(`❌ No enabled platform detected for URL: ${window.location.href}`);
        return { 
          success: false, 
          error: 'Unsupported or disabled platform' 
        };
      }
      
      this.log(`📱 Detected platform: ${platform.displayName || platform.name}`);
      
      // Validate platform has selectors
      if (!platform.descriptionSelectors || !Array.isArray(platform.descriptionSelectors)) {
        this.log(`❌ Platform ${platform.name} has no valid selectors`);
        this.log(`📊 Platform object:`, platform);
        return {
          success: false,
          platform: platform.name,
          error: 'Platform has no description selectors configured'
        };
      }

      if (platform.descriptionSelectors.length === 0) {
        this.log(`❌ Platform ${platform.name} has empty selectors array`);
        return {
          success: false,
          platform: platform.name,
          error: 'Platform has empty selectors array'
        };
      }

      this.log(`🔍 Will try ${platform.descriptionSelectors.length} selectors:`, platform.descriptionSelectors);
      
      // DEBUG: Log page structure
      this.log(`🏗️ Page structure analysis:`);
      this.log(`  - Body classes: ${document.body?.className || 'none'}`);
      this.log(`  - Body child count: ${document.body?.children.length || 0}`);
      
      // Find all elements with common job description classes/ids
      const commonSelectors = ['.read-more', '.description', '.content', '.job-description', '[id*="description"]', '[class*="description"]'];
      this.log(`🔎 Scanning for common job description elements...`);
      commonSelectors.forEach(sel => {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          this.log(`  ✓ Found ${found.length} element(s) matching: ${sel}`);
          found.forEach((el, idx) => {
            const text = (el as HTMLElement).innerText?.trim();
            this.log(`    [${idx}] Text length: ${text?.length || 0} chars, visible: ${(el as HTMLElement).offsetParent !== null}`);
          });
        }
      });
      
      // Try each selector manually with detailed logging
      for (let i = 0; i < platform.descriptionSelectors.length; i++) {
        const selector = platform.descriptionSelectors[i];
        this.log(`\n🔍 [${i + 1}/${platform.descriptionSelectors.length}] Trying selector: "${selector}"`);
        
        try {
          const elements = document.querySelectorAll<HTMLElement>(selector);
          this.log(`  📊 Found ${elements.length} element(s) matching this selector`);
          
          if (elements.length === 0) {
            this.log(`  ❌ No elements found for selector: ${selector}`);
            continue;
          }
          
          // Try each matching element
          for (let j = 0; j < elements.length; j++) {
            const element = elements[j];
            this.log(`  🔎 Checking element [${j}]:`);
            this.log(`    - Tag: ${element.tagName}`);
            this.log(`    - Classes: ${element.className || 'none'}`);
            this.log(`    - ID: ${element.id || 'none'}`);
            this.log(`    - Visible: ${element.offsetParent !== null}`);
            this.log(`    - Display: ${window.getComputedStyle(element).display}`);
            this.log(`    - Visibility: ${window.getComputedStyle(element).visibility}`);
            
            const text = element.innerText?.trim();
            const textContent = element.textContent?.trim();
            
            this.log(`    - innerText length: ${text?.length || 0}`);
            this.log(`    - textContent length: ${textContent?.length || 0}`);
            
            if (text && text.length > 50) {
              this.log(`  ✅ Found valid description with selector "${selector}" element [${j}] (${text.length} chars)`);
              this.log(`  📝 First 200 chars: ${text.substring(0, 200)}...`);
              return {
                success: true,
                description: text,
                platform: platform.name
              };
            } else if (text) {
              this.log(`  ⚠️ Element has text but too short (${text.length} chars): "${text.substring(0, 100)}"`);
            } else {
              this.log(`  ⚠️ Element found but no text content`);
              this.log(`    - HTML preview: ${element.innerHTML?.substring(0, 200) || 'empty'}`);
            }
          }
        } catch (selectorError) {
          this.log(`  ❌ Error with selector ${selector}:`, selectorError);
        }
      }

      this.log(`\n❌ No valid content found with any of the ${platform.descriptionSelectors.length} selectors`);
      this.log(`\n💡 Suggestion: Open DevTools and inspect the page to find the correct selector`);
      this.log(`💡 Look for elements containing the job description text`);
      
      return {
        success: false,
        platform: platform.name,
        error: 'No description found with any selector'
      };
      
    } catch (error) {
      this.log(`❌ Error scraping current page description:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Initialize multi-source scraper
const multiSourceScraper = new MultiSourceScraper();

// Debug function for testing platform detection from console
function testPlatformDetection() {
  const url = window.location.href;
  console.log('🔍 Testing platform detection for:', url);
  
  // Use the global detectPlatformFromUrl function
  const detectFunc = (window as any).detectPlatformFromUrl;
  
  if (!detectFunc) {
    console.log('❌ detectPlatformFromUrl function not available - config not injected');
    console.log('💡 Available on window:', Object.keys(window).filter(k => k.includes('PLATFORM') || k.includes('detect')));
    return;
  }
  
  const platform = detectFunc(url);
  
  if (!platform) {
    console.log('❌ No enabled platform detected');
    
    // Show what platforms are available
    const allPlatforms = (window as any).JOB_DESCRIPTION_PLATFORMS;
    if (allPlatforms) {
      console.log('📊 Available platforms:', Object.keys(allPlatforms));
      console.log('✅ Enabled platforms:', Object.entries(allPlatforms)
        .filter(([_, config]: [string, any]) => config.enabled)
        .map(([key, _]) => key));
    }
    return;
  }
  
  console.log('✅ Platform detected:', platform.name);
  console.log('📋 Display name:', platform.displayName);
  console.log('🔧 Selectors:', platform.descriptionSelectors);
  console.log('📊 Selector count:', platform.descriptionSelectors?.length);
  
  // Try each selector
  if (platform.descriptionSelectors) {
    platform.descriptionSelectors.forEach((selector: string, index: number) => {
      const element = document.querySelector(selector);
      console.log(`🔍 Selector ${index + 1}: ${selector}`);
      console.log(`  ✓ Found: ${!!element}`);
      if (element) {
        const text = element.textContent?.trim();
        console.log(`  📏 Text length: ${text?.length || 0}`);
        if (text && text.length > 0) {
          console.log(`  📝 Preview: ${text.substring(0, 100)}...`);
        }
      }
    });
  }
}

// Make available globally for testing
(window as any).testPlatformDetection = testPlatformDetection;

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.action === 'ping') {
    // Simple ping to check if content script is available
    sendResponse({ success: true, message: 'Content script is available' });
    return true;
  } else if (request.action === 'testPlatformDetection') {
    // Test platform detection and return detailed results
    const detected = PlatformDetector.detectCurrentPlatform();
    sendResponse({ 
      success: true, 
      result: {
        detected: detected,
        url: window.location.href,
        hostname: window.location.hostname,
        canScrape: detected ? (detected.isJobPage || detected.isSearchPage) : false
      }
    });
    return true;
  } else if (request.action === 'scrapeJob') {
    multiSourceScraper.scrapeJob().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ success: false, error: errorMessage });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'getPlatformStatus') {
    multiSourceScraper.showPlatformStatus();
    sendResponse({ success: true });
  } else if (request.action === 'analyzeJobindexHosts') {
    (async () => {
      try {
        const jobindexBulkModule = await import('./jobindexBulkScraper.js');
        const bulkScraper = new jobindexBulkModule.JobindexBulkScraper();
        const result = await bulkScraper.analyzeCollectedJobsHosts();
        sendResponse({ success: true, result });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        sendResponse({ success: false, error: msg });
      }
    })();
    return true;
  } else if (request.action === 'scrapeJobDescriptions') {
    (async () => {
      try {
        const jobDescriptionModule = await import('./jobDescriptionScraper.js');
        const descriptionScraper = new jobDescriptionModule.JobDescriptionScraper();
        await descriptionScraper.processAllJobsFromStorage();
        sendResponse({ success: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        sendResponse({ success: false, error: msg });
      }
    })();
    return true;
  } else if (request.action === 'scrapeCurrentPageDescription') {
    (async () => {
      try {
        const result = await multiSourceScraper.scrapeCurrentPageDescription(request.url);
        sendResponse(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        sendResponse({ success: false, error: msg });
      }
    })();
    return true;
  } else if (request.action === 'scrapeJobindexCurrentPage') {
    // Scrape Jobindex jobs from current page (for bulk pagination)
    (async () => {
      try {
        const jobindexBulkModule = await import('./jobindexBulkScraper.js');
        const bulkScraper = new jobindexBulkModule.JobindexBulkScraper();
        const result = await bulkScraper.scrapeCurrentPage();
        sendResponse({ 
          success: result.success, 
          jobs: result.jobs,
          error: result.errors.length > 0 ? result.errors[0] : undefined
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        sendResponse({ success: false, error: msg, jobs: [] });
      }
    })();
    return true;
  }
  return false;
});

// Export for use in other modules
export { MultiSourceScraper };
