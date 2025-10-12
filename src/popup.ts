class PopupController {
  private readonly statusIndicator: HTMLElement;
  private readonly pollingStatusText: HTMLElement;
  private readonly platformStatusText: HTMLElement;

  private log(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [POPUP_CONTROLLER] ${message}`, ...args);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  constructor() {
    this.log('🚀 PopupController constructor called');
    this.statusIndicator = document.getElementById('statusIndicator')!;
    this.pollingStatusText = document.getElementById('pollingStatusText')!;
    this.platformStatusText = document.getElementById('platformStatusText')!;
    
    this.log('🎯 DOM elements found:', {
      statusIndicator: !!this.statusIndicator,
      pollingStatusText: !!this.pollingStatusText,
      platformStatusText: !!this.platformStatusText
    });
    
    this.initializeEventListeners();
    // Initialize async operations after construction
    setTimeout(() => this.initialize(), 0);
  }

  private async initialize() {
    await this.loadSettings();
    await this.updateStatus();
    await this.updatePlatformStatus();
  }

  private initializeEventListeners() {
    this.log('🎧 Initializing event listeners...');
    
    // Scrape current page button
    document.getElementById('scrapeCurrentBtn')?.addEventListener('click', () => {
      this.scrapeCurrentPage();
    });

    // Scrape jobs button
    document.getElementById('scrapeJobsBtn')?.addEventListener('click', () => {
      this.startScraping('jobs');
    });

    // Scrape profiles button
    document.getElementById('scrapeProfilesBtn')?.addEventListener('click', () => {
      this.startScraping('profiles');
    });

    // Bulk scrape jobs button
    document.getElementById('bulkScrapeJobsBtn')?.addEventListener('click', () => {
      this.bulkScrapeJobs();
    });

    // Analyze Jobindex hosts button (optional UI trigger if present)
    document.getElementById('analyzeJobindexHostsBtn')?.addEventListener('click', () => {
      this.analyzeJobindexHosts();
    });

    document.getElementById('resolveFinalUrlsBtn')?.addEventListener('click', () => {
      this.resolveFinalUrls();
    });

    // Scrape job descriptions button
    document.getElementById('scrapeDescriptionsBtn')?.addEventListener('click', () => {
      this.scrapeJobDescriptions();
    });

    // Check closed jobs button
    document.getElementById('checkClosedJobsBtn')?.addEventListener('click', () => {
      this.checkClosedJobs();
    });

    // Stop polling button
    document.getElementById('stopPollingBtn')?.addEventListener('click', () => {
      this.stopPolling();
    });

    // Auto-scrape checkbox
    document.getElementById('autoScrapeCheckbox')?.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      this.saveSettings({ autoScrape: target.checked });
    });

    
    this.log('✅ Event listeners initialized');
  }

  private async scrapeCurrentPage() {
    console.log('🎯 Scraping current page...');
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab?.url || !currentTab.id) {
        console.error('❌ No active tab found');
        return;
      }

      // Use smart multi-source scraping for all supported platforms
      if (currentTab.url.includes('linkedin.com/') || currentTab.url.includes('jobindex.dk/')) {
        try {
          // Try to send message, if it fails, inject the content script first
          let response = await new Promise<any>((resolve) => {
            chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeJob' }, (response) => {
              if (chrome.runtime.lastError) {
                console.log('⚠️ Content script not found, attempting to inject...');
                resolve(null);
              } else {
                resolve(response);
              }
            });
          });
          
          // If content script wasn't available, inject it and try again
          if (response === null) {
            try {
              console.log('💉 Injecting content script...');
              await chrome.scripting.executeScript({
                target: { tabId: currentTab.id! },
                files: ['multiSourceScraper.js']
              });
              
              // Wait a moment for the script to initialize
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Try sending the message again
              response = await new Promise<any>((resolve) => {
                chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeJob' }, (response) => {
                  if (chrome.runtime.lastError) {
                    resolve({ success: false, error: 'Content script injection failed' });
                  } else {
                    resolve(response);
                  }
                });
              });
            } catch (injectionError) {
              console.error('❌ Failed to inject content script:', injectionError);
              response = { success: false, error: `Injection failed: ${injectionError}` };
            }
          }
          
          if (response?.success) {
            console.log('✅ Page scraped successfully');
          } else {
            const errorMsg = response?.error || response?.message || 'Unknown error';
            console.error(`❌ Scraping failed: ${errorMsg}`);
          }
        } catch (error) {
          console.error('❌ Error during scraping:', error);
        }
      } else if (currentTab.url.includes('linkedin.com/in/')) {
        try {
          // Try to send message, if it fails, inject the content script first
          let response = await new Promise<any>((resolve) => {
            chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeProfile' }, (response) => {
              if (chrome.runtime.lastError) {
                console.log('⚠️ Content script not found, attempting to inject...');
                resolve(null);
              } else {
                resolve(response);
              }
            });
          });
          
          // If content script wasn't available, inject it and try again
          if (response === null) {
            try {
              console.log('💉 Injecting profile scraper...');
              await chrome.scripting.executeScript({
                target: { tabId: currentTab.id! },
                files: ['scrapeProfile.js']
              });
              
              // Wait a moment for the script to initialize
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Try sending the message again
              response = await new Promise<any>((resolve) => {
                chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeProfile' }, (response) => {
                  if (chrome.runtime.lastError) {
                    resolve({ success: false, error: 'Content script injection failed' });
                  } else {
                    resolve(response);
                  }
                });
              });
            } catch (injectionError) {
              console.error('❌ Failed to inject content script:', injectionError);
              response = { success: false, error: `Injection failed: ${injectionError}` };
            }
          }
          
          if (response?.success) {
            console.log('✅ Profile page scraped successfully');
          } else {
            const errorMsg = response?.error || response?.message || 'Unknown error';
            console.error(`❌ Failed to scrape profile: ${errorMsg}`);
          }
        } catch (error) {
          console.error('❌ Error during profile scraping:', error);
        }
      } else {
        console.warn('⚠️ Current page is not a supported job or profile page');
        console.log('💡 Supported platforms: LinkedIn jobs/profiles, Jobindex.dk jobs');
      }
    } catch (error) {
      console.error(`❌ Error scraping current page: ${error}`);
    }
  }

  private async startScraping(type: 'jobs' | 'profiles') {
    console.log(`🚀 Starting ${type} scraping...`);
    
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'startScraping', 
          type: type 
        }, resolve);
      });
      
      if (response?.success) {
        console.log(`✅ ${type} scraping started`);
        this.updateStatus();
      } else {
        console.error(`❌ Failed to start ${type} scraping`);
      }
    } catch (error) {
      console.error(`❌ Error starting ${type} scraping: ${error}`);
    }
  }

  private async stopPolling() {
    console.log('⏹️ Stopping polling...');
    
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'stopPolling' }, resolve);
      });
      
      if (response?.success) {
        console.log('✅ Polling stopped');
        this.updateStatus();
      } else {
        console.error('❌ Failed to stop polling');
      }
    } catch (error) {
      console.error(`❌ Error stopping polling: ${error}`);
    }
  }

  private async updateStatus() {
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'getStatus' }, resolve);
      });
      
      if (response) {
        const isPolling = response.isPolling;
        const pollingInterval = response.pollingInterval;
        
        // Update status indicator
        this.statusIndicator.className = `status-indicator ${isPolling ? 'status-active' : 'status-inactive'}`;
        
        // Update status text
        if (isPolling) {
          const intervalMinutes = Math.round(pollingInterval / 60000);
          this.pollingStatusText.textContent = `Polling active (every ${intervalMinutes}m)`;
        } else {
          this.pollingStatusText.textContent = 'Polling inactive';
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  private async updatePlatformStatus() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab?.url) {
        this.platformStatusText.textContent = '❌ No active tab';
        return;
      }

      const url = currentTab.url;
      
      if (url.includes('linkedin.com/jobs/view/') || url.includes('currentJobId=')) {
        this.platformStatusText.textContent = '✅ LinkedIn Job Page';
      } else if (url.includes('linkedin.com/jobs/search/') || (url.includes('linkedin.com/jobs/') && !url.includes('/jobs/view/'))) {
        this.platformStatusText.textContent = '✅ LinkedIn Job Search Page (Bulk Scraping Available)';
      } else if (url.includes('linkedin.com/in/')) {
        this.platformStatusText.textContent = '✅ LinkedIn Profile Page';
      } else if (url.includes('jobindex.dk/jobsoegning/stilling/')) {
        this.platformStatusText.textContent = '✅ Jobindex.dk Job Page';
      } else if (url.includes('jobindex.dk/jobsoegning') && !url.includes('/stilling/')) {
        this.platformStatusText.textContent = '✅ Jobindex.dk Job Search Page (Bulk Scraping Available)';
      } else if (url.includes('linkedin.com/') || url.includes('jobindex.dk/')) {
        this.platformStatusText.textContent = '⚠️ Supported platform but not on job/profile/search page';
      } else {
        this.platformStatusText.textContent = '❌ Unsupported platform';
      }
    } catch (error) {
      console.error('Error updating platform status:', error);
      this.platformStatusText.textContent = '❌ Error detecting platform';
    }
  }


  private async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['autoScrape']);
      const autoScrapeCheckbox = document.getElementById('autoScrapeCheckbox') as HTMLInputElement;
      
      if (autoScrapeCheckbox && typeof result.autoScrape === 'boolean') {
        autoScrapeCheckbox.checked = result.autoScrape;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  private async saveSettings(settings: { autoScrape?: boolean }) {
    try {
      await chrome.storage.local.set(settings);
      console.log(`⚙️ Settings updated: ${Object.keys(settings).join(', ')}`);
    } catch (error) {
      console.error('Error saving settings:', error);
      console.error('❌ Failed to save settings');
    }
  }

  private async bulkScrapeJobs() {
    console.log('🚀 Starting bulk job scraping...');
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab?.url || !currentTab.id) {
        console.error('❌ No active tab found');
        return;
      }

      // Check if we're on a supported search page
      const isLinkedInSearch = currentTab.url.includes('linkedin.com/jobs/search');
      const isJobindexSearch = currentTab.url.includes('jobindex.dk/jobsoegning') && !currentTab.url.includes('/stilling/');
      
      if (!isLinkedInSearch && !isJobindexSearch) {
        console.warn('⚠️ Please navigate to a supported job search page first');
        console.log('💡 Supported pages:');
        console.log('   - LinkedIn: linkedin.com/jobs/search with your filters');
        console.log('   - Jobindex: jobindex.dk/jobsoegning with your filters');
        return;
      }

      // Use the smart multi-source scraper for both platforms
      console.log('🔄 Starting smart bulk scraping...');
      
      // Try to send message, if it fails, inject the content script first
      let bulkResponse = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeJob' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('⚠️ Content script not found, attempting to inject...');
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });
      
      // If content script wasn't available, inject it and try again
      if (bulkResponse === null) {
        try {
          console.log('💉 Injecting content script...');
          await chrome.scripting.executeScript({
            target: { tabId: currentTab.id! },
            files: ['multiSourceScraper.js']
          });
          
          // Wait a moment for the script to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try sending the message again
          bulkResponse = await new Promise<any>((resolve) => {
            chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeJob' }, (response) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false, error: 'Content script injection failed' });
              } else {
                resolve(response);
              }
            });
          });
        } catch (injectionError) {
          console.error('❌ Failed to inject content script:', injectionError);
          bulkResponse = { success: false, error: `Injection failed: ${injectionError}` };
        }
      }
      
      if (bulkResponse?.success) {
        console.log('✅ Bulk job scraping completed successfully');
      } else {
        const errorMsg = bulkResponse?.error || bulkResponse?.message || 'Unknown error';
        console.error(`❌ Bulk scraping failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`❌ Error during bulk scraping: ${error}`);
    }
  }

  private async analyzeJobindexHosts() {
    console.log('📊 Analyzing Jobindex collected jobs by host...');
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      if (!currentTab?.id) return;

      const response = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(currentTab.id!, { action: 'analyzeJobindexHosts' }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: 'Content script not available on this page' });
          } else {
            resolve(resp);
          }
        });
      });

      if (response?.success) {
        console.log('✅ Host analysis:', response.result);
      } else {
        console.error('❌ Host analysis failed:', response?.error || 'Unknown error');
      }
    } catch (e) {
      console.error('❌ Error during host analysis:', e);
    }
  }

  private async resolveFinalUrls() {
    console.log('🔗 Resolving final URLs with database check...');
    try {
      const result = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'resolveJobindexFinalUrls' }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(resp);
          }
        });
      });

      if (result?.success && result?.platformStats) {
        const stats = result.platformStats;
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ FINAL URL RESOLUTION COMPLETE`);
        console.log(`${'='.repeat(60)}`);
        console.log(`📊 URLs resolved: ${result.updated}`);
        console.log(`⏭️ Jobs skipped (no redirect): ${result.skipped || 0}`);
        console.log(`🗑️ Jobs removed (already in DB): ${result.removed || 0}`);
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`📈 PLATFORM COVERAGE ANALYSIS`);
        console.log(`${'─'.repeat(60)}`);
        console.log(`📦 Total jobs: ${stats.totalJobs}`);
        console.log(`✅ Jobs that can be scraped: ${stats.scrapableJobs} (${stats.scrapablePercentage}%)`);
        console.log(`❌ Missing: ${stats.missingJobs} (${stats.missingPercentage}%)`);
        
        if (stats.enabledPlatforms.length > 0) {
          console.log(`\n🟢 Enabled Platforms (Biggest platforms):`);
          stats.enabledPlatforms.forEach((platform: any, index: number) => {
            console.log(`   ${index + 1}. ${platform.name}: ${platform.count} jobs (${platform.percentage}%)`);
          });
        }
        
        if (stats.disabledPlatforms.length > 0) {
          console.log(`\n🔴 Missing or Disabled Platforms:`);
          stats.disabledPlatforms.forEach((platform: any, index: number) => {
            const reason = platform.reason === 'disabled' ? '(disabled)' : '(unknown)';
            console.log(`   ${index + 1}. ${platform.name}: ${platform.count} jobs (${platform.percentage}%) ${reason}`);
          });
        }
        
        console.log(`${'='.repeat(60)}\n`);
      } else if (result?.success) {
        // Fallback for old format without platformStats
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ FINAL URL RESOLUTION COMPLETE`);
        console.log(`📊 URLs resolved: ${result.updated}`);
        console.log(`⏭️ Jobs skipped (no redirect): ${result.skipped || 0}`);
        console.log(`🗑️ Jobs removed (already in DB): ${result.removed || 0}`);
        console.log(`📦 Check storage for updated jobs`);
        console.log(`${'='.repeat(60)}\n`);
      } else {
        console.error('❌ Failed to resolve final URLs:', result?.error || 'Unknown error');
      }
    } catch (e) {
      console.error('❌ Error resolving final URLs:', e);
    }
  }

  private async scrapeJobDescriptions() {
    this.log('🚀 Starting job description scraping...');
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab?.id) {
        this.log('❌ No active tab found');
        return;
      }

      this.log(`🔍 Current tab URL: ${currentTab.url}`);
      this.log(`🔍 Current tab ID: ${currentTab.id}`);

      // First, try to ping the content script to see if it's available
      this.log('📡 Pinging content script...');
      const pingResponse = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(currentTab.id!, { action: 'ping' }, (response) => {
          if (chrome.runtime.lastError) {
            this.log(`❌ Content script ping failed: ${chrome.runtime.lastError.message}`);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            this.log('✅ Content script ping successful');
            resolve(response);
          }
        });
      });

      if (!pingResponse?.success) {
        this.log('❌ Content script is not available on this page');
        this.log('💡 Opening a new tab to avoid cache issues...');
        
        // Open a new tab with the same URL to avoid cache issues
        const newTab = await chrome.tabs.create({
          url: currentTab.url,
          active: true
        });
        
        this.log(`✅ Opened new tab with ID: ${newTab.id}`);
        this.log('⏳ Waiting 3 seconds for content script to load in new tab...');
        await this.sleep(3000);
        
        // Try again with the new tab
        this.log('🔄 Retrying with new tab...');
        const newPingResponse = await new Promise<any>((resolve) => {
          chrome.tabs.sendMessage(newTab.id!, { action: 'ping' }, (response) => {
            if (chrome.runtime.lastError) {
              this.log(`❌ New tab ping failed: ${chrome.runtime.lastError.message}`);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              this.log('✅ New tab ping successful');
              resolve(response);
            }
          });
        });
        
        if (!newPingResponse?.success) {
          this.log('❌ Content script still not available in new tab');
          this.log('💡 Try reloading the extension');
          return;
        }
        
        // Update currentTab to the new tab
        currentTab.id = newTab.id;
      }

      // Test platform detection
      this.log('🔍 Testing platform detection...');
      const platformTestResponse = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(currentTab.id!, { action: 'testPlatformDetection' }, (response) => {
          if (chrome.runtime.lastError) {
            this.log(`❌ Platform test failed: ${chrome.runtime.lastError.message}`);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            this.log('✅ Platform test response received');
            resolve(response);
          }
        });
      });

      if (platformTestResponse?.success) {
        this.log('📊 Platform detection result:', platformTestResponse.result);
      } else {
        this.log('❌ Platform detection test failed:', platformTestResponse?.error);
      }

        this.log('📡 Starting batch job description scraping via background script...');
        
        // Set up listener for progress and completion via storage
        const progressPromise = new Promise<any>((resolve) => {
          let lastProgress: any = null;
          
          const checkStorage = () => {
            chrome.storage.local.get(['scrapingProgress', 'scrapingCompleted'], (data) => {
              // Check for completion first
              if (data.scrapingCompleted) {
                const now = Date.now();
                const resultTime = data.scrapingCompleted.timestamp;
                if (now - resultTime < 10000) {
                  // Clear the result and resolve
                  chrome.storage.local.remove(['scrapingCompleted', 'scrapingProgress']);
                  resolve({ completed: true, result: data.scrapingCompleted.result });
                  return;
                }
              }
              
              // Check for progress updates
              if (data.scrapingProgress) {
                const now = Date.now();
                const progressTime = data.scrapingProgress.timestamp;
                if (now - progressTime < 10000) {
                  const progress = data.scrapingProgress.progress;
                  
                  // Only log if progress changed
                  if (!lastProgress || 
                      lastProgress.current !== progress.current || 
                      lastProgress.success !== progress.success || 
                      lastProgress.errors !== progress.errors) {
                    
                    this.log(`📊 Progress: ${progress.current}/${progress.total} - ${progress.currentJob}`);
                    this.log(`✅ Success: ${progress.success}, ❌ Errors: ${progress.errors}`);
                    
                    lastProgress = progress;
                  }
                }
              }
              
              // Check again in 2 seconds
              setTimeout(checkStorage, 2000);
            });
          };
          
          // Start checking
          checkStorage();
          
          // Timeout after 10 minutes
          setTimeout(() => {
            resolve({ error: 'Timeout - scraping took too long' });
          }, 10 * 60 * 1000);
        });
        
        // Send start command to background script
        chrome.runtime.sendMessage({ action: 'startBatchScraping' }, (response) => {
          if (chrome.runtime.lastError) {
            this.log(`❌ Failed to start batch scraping: ${chrome.runtime.lastError.message}`);
          } else if (response?.success) {
            this.log('✅ Batch scraping started successfully');
            this.log('⏳ Waiting for scraping to complete...');
          } else {
            this.log(`❌ Failed to start batch scraping: ${response?.error || 'Unknown error'}`);
          }
        });
        
        // Wait for completion
        const result = await progressPromise;
        
        if (result.error) {
          this.log(`❌ Description scraping failed: ${result.error}`);
        } else if (result.completed) {
          this.log(`✅ Job description scraping completed successfully!`);
          this.log(`📊 Processed: ${result.result.processed}, Success: ${result.result.success}, Errors: ${result.result.errors}`);
          if (result.result.platformStats && Object.keys(result.result.platformStats).length > 0) {
            this.log(`📊 Platform statistics:`, result.result.platformStats);
          }
        }
    } catch (error) {
      this.log(`❌ Error during description scraping: ${error}`);
    }
  }

  private async checkClosedJobs() {
    console.log('🔍 Starting closed jobs check...');
    
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkClosedJobs' }, resolve);
      });
      
      if (response?.success) {
        const { closedJobs, totalChecked, message } = response;
        console.log(`✅ ${message}`);
        
        if (closedJobs && closedJobs.length > 0) {
          console.log(`📋 Found ${closedJobs.length} closed jobs:`);
          closedJobs.forEach((jobId: number, index: number) => {
            console.log(`   ${index + 1}. Job ID: ${jobId}`);
          });
        } else {
          console.log('📋 No closed jobs found');
        }
        
        console.log(`📊 Total jobs checked: ${totalChecked}`);
        } else {
          const errorMsg = response?.error || response?.message || 'Unknown error';
          console.error(`❌ Failed to check closed jobs: ${errorMsg}`);
        }
    } catch (error) {
      console.error(`❌ Error checking closed jobs: ${error}`);
    }
  }

}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM Content Loaded - Initializing popup...');
  const popupController = new PopupController();
  // Store reference to avoid unused variable warning
  console.log('✅ Popup controller initialized:', popupController);
});

// Also try immediate initialization as fallback
console.log('🔧 Script loaded, checking if DOM is ready...');
if (document.readyState === 'loading') {
  console.log('⏳ DOM still loading, waiting for DOMContentLoaded...');
} else {
  console.log('✅ DOM already ready, initializing immediately...');
  const popupController = new PopupController();
  console.log('✅ Popup controller initialized (immediate):', popupController);
}

// Handle runtime messages (if any)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
    console.log('Popup received message:', request);
    // Handle any messages from background script if needed
    sendResponse({ received: true });
  });
}
