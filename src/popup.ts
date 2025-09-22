interface LogEntry {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
}

class PopupController {
  private readonly statusLog: HTMLElement;
  private readonly statusIndicator: HTMLElement;
  private readonly pollingStatusText: HTMLElement;
  private readonly envToggleBtn: HTMLElement;
  private readonly envStatus: HTMLElement;
  private readonly envText: HTMLElement;
  private logs: LogEntry[] = [];

  constructor() {
    this.statusLog = document.getElementById('statusLog')!;
    this.statusIndicator = document.getElementById('statusIndicator')!;
    this.pollingStatusText = document.getElementById('pollingStatusText')!;
    this.envToggleBtn = document.getElementById('envToggleBtn')!;
    this.envStatus = document.getElementById('envStatus')!;
    this.envText = document.getElementById('envText')!;
    
    this.initializeEventListeners();
    // Initialize async operations after construction
    setTimeout(() => this.initialize(), 0);
  }

  private async initialize() {
    await this.loadSettings();
    await this.updateStatus();
    await this.loadLogs();
    await this.updateEnvironmentDisplay();
  }

  private initializeEventListeners() {
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

    // Environment toggle button
    document.getElementById('envToggleBtn')?.addEventListener('click', () => {
      this.toggleEnvironment();
    });
  }

  private async scrapeCurrentPage() {
    this.addLog('Scraping current page...', 'info');
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab?.url || !currentTab.id) {
        this.addLog('❌ No active tab found', 'error');
        return;
      }

      if (currentTab.url.includes('linkedin.com/jobs/')) {
        const response = await new Promise<any>((resolve) => {
          chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeJob' }, resolve);
        });
        if (response?.success) {
          this.addLog('✅ Job page scraped successfully', 'success');
        } else {
          this.addLog(`❌ Failed to scrape job: ${response?.error || 'Unknown error'}`, 'error');
        }
      } else if (currentTab.url.includes('linkedin.com/in/')) {
        const response = await new Promise<any>((resolve) => {
          chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeProfile' }, resolve);
        });
        if (response?.success) {
          this.addLog('✅ Profile page scraped successfully', 'success');
        } else {
          this.addLog(`❌ Failed to scrape profile: ${response?.error || 'Unknown error'}`, 'error');
        }
      } else {
        this.addLog('⚠️ Current page is not a LinkedIn job or profile page', 'warning');
      }
    } catch (error) {
      this.addLog(`❌ Error scraping current page: ${error}`, 'error');
    }
  }

  private async startScraping(type: 'jobs' | 'profiles') {
    this.addLog(`🚀 Starting ${type} scraping...`, 'info');
    
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'startScraping', 
          type: type 
        }, resolve);
      });
      
      if (response?.success) {
        this.addLog(`✅ ${type} scraping started`, 'success');
        this.updateStatus();
      } else {
        this.addLog(`❌ Failed to start ${type} scraping`, 'error');
      }
    } catch (error) {
      this.addLog(`❌ Error starting ${type} scraping: ${error}`, 'error');
    }
  }

  private async stopPolling() {
    this.addLog('⏹️ Stopping polling...', 'info');
    
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'stopPolling' }, resolve);
      });
      
      if (response?.success) {
        this.addLog('✅ Polling stopped', 'success');
        this.updateStatus();
      } else {
        this.addLog('❌ Failed to stop polling', 'error');
      }
    } catch (error) {
      this.addLog(`❌ Error stopping polling: ${error}`, 'error');
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

  private addLog(message: string, type: LogEntry['type'] = 'info') {
    const logEntry: LogEntry = {
      message,
      type,
      timestamp: new Date()
    };

    this.logs.unshift(logEntry); // Add to beginning
    
    // Keep only last 50 logs
    if (this.logs.length > 50) {
      this.logs = this.logs.slice(0, 50);
    }

    this.saveLogs();
    this.renderLogs();
  }

  private renderLogs() {
    if (this.logs.length === 0) {
      this.statusLog.innerHTML = '<div class="empty-log">No activity yet. Start scraping to see logs here.</div>';
      return;
    }

    const logsHtml = this.logs.map(log => {
      const timeStr = log.timestamp.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      
      return `
        <div class="log-entry log-${log.type}">
          <span style="color: #6b7280; font-size: 11px;">[${timeStr}]</span>
          ${log.message}
        </div>
      `;
    }).join('');

    this.statusLog.innerHTML = logsHtml;
    
    // Scroll to top to show latest log
    this.statusLog.scrollTop = 0;
  }

  private async loadLogs() {
    try {
      const result = await chrome.storage.local.get(['scrapingLogs']);
      if (result.scrapingLogs) {
        this.logs = result.scrapingLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
        this.renderLogs();
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  }

  private async saveLogs() {
    try {
      await chrome.storage.local.set({ scrapingLogs: this.logs });
    } catch (error) {
      console.error('Error saving logs:', error);
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
      this.addLog(`⚙️ Settings updated: ${Object.keys(settings).join(', ')}`, 'info');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.addLog('❌ Failed to save settings', 'error');
    }
  }

  private async bulkScrapeJobs() {
    this.addLog('🚀 Starting bulk job scraping...', 'info');
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab?.url || !currentTab.id) {
        this.addLog('❌ No active tab found', 'error');
        return;
      }

      // Check if we're on a LinkedIn jobs search page
      if (!currentTab.url.includes('linkedin.com/jobs/search')) {
        this.addLog('⚠️ Please navigate to a LinkedIn jobs search page first', 'warning');
        this.addLog('💡 Go to linkedin.com/jobs/search with your filters', 'info');
        return;
      }

      this.addLog('📋 Collecting job IDs from current page...', 'info');
      
      // First, just collect the job IDs to show progress
      const jobIdsResponse = await new Promise<any>((resolve) => {
        chrome.tabs.sendMessage(currentTab.id!, { action: 'scrapeJobIds' }, resolve);
      });
      
      if (jobIdsResponse?.success) {
        const jobCount = jobIdsResponse.jobIds?.length || 0;
        this.addLog(`✅ Found ${jobCount} jobs to process`, 'success');
        
        if (jobCount === 0) {
          this.addLog('❌ No jobs found on this page', 'error');
          return;
        }

        // Now start the bulk scraping process
        this.addLog('🔄 Starting bulk processing...', 'info');
        
        const bulkResponse = await new Promise<any>((resolve) => {
          chrome.tabs.sendMessage(currentTab.id!, { action: 'bulkScrapeJobs' }, resolve);
        });
        
        if (bulkResponse?.success) {
          this.addLog('✅ Bulk job scraping completed successfully', 'success');
        } else {
          this.addLog(`❌ Bulk scraping failed: ${bulkResponse?.error || 'Unknown error'}`, 'error');
        }
      } else {
        this.addLog(`❌ Failed to collect job IDs: ${jobIdsResponse?.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      this.addLog(`❌ Error during bulk scraping: ${error}`, 'error');
    }
  }

  private async checkClosedJobs() {
    this.addLog('🔍 Starting closed jobs check...', 'info');
    
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkClosedJobs' }, resolve);
      });
      
      if (response?.success) {
        const { closedJobs, totalChecked, message } = response;
        this.addLog(`✅ ${message}`, 'success');
        
        if (closedJobs && closedJobs.length > 0) {
          this.addLog(`📋 Found ${closedJobs.length} closed jobs:`, 'info');
          closedJobs.forEach((jobId: number, index: number) => {
            this.addLog(`   ${index + 1}. Job ID: ${jobId}`, 'info');
          });
        } else {
          this.addLog('📋 No closed jobs found', 'info');
        }
        
        this.addLog(`📊 Total jobs checked: ${totalChecked}`, 'info');
      } else {
        this.addLog(`❌ Failed to check closed jobs: ${response?.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      this.addLog(`❌ Error checking closed jobs: ${error}`, 'error');
    }
  }

  private async toggleEnvironment() {
    try {
      // Get current environment
      const result = await chrome.storage.local.get(['environment']);
      const currentEnv = result.environment || 'DEV';
      const newEnv = currentEnv === 'DEV' ? 'PROD' : 'DEV';
      
      // Save new environment
      await chrome.storage.local.set({ environment: newEnv });
      
      // Update display
      await this.updateEnvironmentDisplay();
      
      // Log the change
      this.addLog(`🔄 Environment switched to: ${newEnv}`, 'info');
      
      // Show environment details
      const envDetails = newEnv === 'DEV' 
        ? 'Local development (laravel-job-dashboard.test)'
        : 'Production (kaoz.dk)';
      this.addLog(`📍 ${envDetails}`, 'info');
      
    } catch (error) {
      this.addLog(`❌ Failed to toggle environment: ${error}`, 'error');
    }
  }

  private async updateEnvironmentDisplay() {
    try {
      const result = await chrome.storage.local.get(['environment']);
      const currentEnv = result.environment || 'DEV';
      
      // Update button text and styling
      this.envText.textContent = currentEnv === 'DEV' ? 'Development' : 'Production';
      this.envStatus.textContent = currentEnv === 'DEV' ? '🛠️' : '🚀';
      
      // Update button class for styling
      this.envToggleBtn.className = `btn btn-env ${currentEnv.toLowerCase()}`;
      
    } catch (error) {
      console.error('Error updating environment display:', error);
      this.envText.textContent = 'Error';
      this.envStatus.textContent = '❌';
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popupController = new PopupController();
  // Store reference to avoid unused variable warning
  console.log('Popup controller initialized:', popupController);
});

// Handle runtime messages (if any)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
    console.log('Popup received message:', request);
    // Handle any messages from background script if needed
    sendResponse({ received: true });
  });
}
