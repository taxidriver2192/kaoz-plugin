class PopupController {
  private readonly statusIndicator: HTMLElement;
  private readonly pollingStatusText: HTMLElement;

  constructor() {
    console.log('🚀 PopupController constructor called');
    this.statusIndicator = document.getElementById('statusIndicator')!;
    this.pollingStatusText = document.getElementById('pollingStatusText')!;
    
    console.log('🎯 DOM elements found:', {
      statusIndicator: !!this.statusIndicator,
      pollingStatusText: !!this.pollingStatusText
    });
    
    this.initializeEventListeners();
    // Initialize async operations after construction
    setTimeout(() => this.initialize(), 0);
  }

  private async initialize() {
    await this.loadSettings();
    await this.updateStatus();
  }

  private initializeEventListeners() {
    console.log('🎧 Initializing event listeners...');
    
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

    
    console.log('✅ Event listeners initialized');
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

      if (currentTab.url.includes('linkedin.com/jobs/')) {
        try {
          const response = await new Promise<any>((resolve) => {
            chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeJob' }, (response) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false, error: 'Content script not available on this page' });
              } else {
                resolve(response);
              }
            });
          });
          if (response?.success) {
            console.log('✅ Job page scraped successfully');
          } else {
            const errorMsg = response?.error || response?.message || 'Unknown error';
            console.error(`❌ Failed to scrape job: ${errorMsg}`);
          }
        } catch (error) {
          console.error('❌ Content script not available on this page');
        }
      } else if (currentTab.url.includes('linkedin.com/in/')) {
        try {
          const response = await new Promise<any>((resolve) => {
            chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeProfile' }, (response) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false, error: 'Content script not available on this page' });
              } else {
                resolve(response);
              }
            });
          });
          if (response?.success) {
            console.log('✅ Profile page scraped successfully');
          } else {
            const errorMsg = response?.error || response?.message || 'Unknown error';
            console.error(`❌ Failed to scrape profile: ${errorMsg}`);
          }
        } catch (error) {
          console.error('❌ Content script not available on this page');
        }
      } else {
        console.warn('⚠️ Current page is not a LinkedIn job or profile page');
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

      // Check if we're on a LinkedIn jobs search page
      if (!currentTab.url.includes('linkedin.com/jobs/search')) {
        console.warn('⚠️ Please navigate to a LinkedIn jobs search page first');
        console.log('💡 Go to linkedin.com/jobs/search with your filters');
        return;
      }

      console.log('📋 Collecting job IDs from current page...');
      
      // First, just collect the job IDs to show progress
      const jobIdsResponse = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeJobIds' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: 'Content script not available on this page' });
          } else {
            resolve(response);
          }
        });
      });
      
      if (jobIdsResponse?.success) {
        const jobCount = jobIdsResponse.jobIds?.length || 0;
        console.log(`✅ Found ${jobCount} jobs to process`);
        
        if (jobCount === 0) {
          console.error('❌ No jobs found on this page');
          return;
        }

        // Now start the bulk scraping process
        console.log('🔄 Starting bulk processing...');
        
        const bulkResponse = await new Promise<any>((resolve) => {
          chrome.tabs.sendMessage(currentTab.id!, { action: 'bulkScrapeJobs' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: 'Content script not available on this page' });
            } else {
              resolve(response);
            }
          });
        });
        
        if (bulkResponse?.success) {
          console.log('✅ Bulk job scraping completed successfully');
        } else {
          const errorMsg = bulkResponse?.error || bulkResponse?.message || 'Unknown error';
          console.error(`❌ Bulk scraping failed: ${errorMsg}`);
        }
        } else {
          const errorMsg = jobIdsResponse?.error || jobIdsResponse?.message || 'Unknown error';
          console.error(`❌ Failed to collect job IDs: ${errorMsg}`);
        }
    } catch (error) {
      console.error(`❌ Error during bulk scraping: ${error}`);
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
