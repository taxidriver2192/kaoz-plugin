import { apiClient, JobData } from '../utils/apiClient.js';

class JobScraper {
  private log(message: string, ...args: any[]) {
    console.log(`[LINKEDIN_SCRAPER_JOBS] ${message}`, ...args);
  }

  private showNotification(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    // Create a temporary notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 4px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease-out;
    `;

    const colors = {
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B'
    };

    notification.style.backgroundColor = colors[type];
    notification.textContent = message;

    // Add animation keyframes
    if (!document.querySelector('#linkedin-scraper-styles')) {
      const style = document.createElement('style');
      style.id = 'linkedin-scraper-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  private extractJobId(): string {
    // Extract job ID from URL
    const url = window.location.href;
    const regex = /jobs\/view\/(\d+)/;
    const match = regex.exec(url);
    return match ? match[1] : `job_${Date.now()}`;
  }

  private extractJobData(): JobData | null {
    try {
      const jobId = this.extractJobId();
      
      // Job title
      const titleElement = document.querySelector('.t-24.t-bold.inline, .jobs-unified-top-card__job-title');
      const title = titleElement?.textContent?.trim() || '';

      // Company name
      const companyElement = document.querySelector('.jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name');
      const company = companyElement?.textContent?.trim() || '';

      // Location
      const locationElement = document.querySelector('.jobs-unified-top-card__bullet, .jobs-unified-top-card__workplace-type');
      const location = locationElement?.textContent?.trim() || '';

      // Description
      const descriptionElement = document.querySelector('.jobs-description-content__text, .jobs-box__html-content');
      const description = descriptionElement?.textContent?.trim() || '';

      // Posted date
      const postedElement = document.querySelector('.jobs-unified-top-card__posted-date, .job-details-jobs-unified-top-card__posted-date');
      const postedDate = postedElement?.textContent?.trim() || '';

      // Salary (if available)
      const salaryElement = document.querySelector('.jobs-unified-top-card__job-insight, .job-details-preferences-and-skills__pill');
      const salary = salaryElement?.textContent?.includes('$') ? salaryElement?.textContent?.trim() : '';

      // Employment type
      const employmentTypeElement = document.querySelector('.jobs-unified-top-card__job-insight--highlight');
      const employmentType = employmentTypeElement?.textContent?.trim() || '';

      if (!title || !company) {
        this.log('Could not extract required job data (title or company missing)');
        return null;
      }

      const jobData: JobData = {
        jobId,
        title,
        company,
        location,
        description,
        postedDate,
        url: window.location.href,
        salary: salary || undefined,
        employmentType: employmentType || undefined,
      };

      this.log('Extracted job data:', jobData);
      return jobData;
    } catch (error) {
      this.log('Error extracting job data:', error);
      return null;
    }
  }

  async scrapeJob(): Promise<void> {
    try {
      this.log('Starting job scraping...');
      
      const jobData = this.extractJobData();
      if (!jobData) {
        this.showNotification('❌ Could not extract job data', 'error');
        return;
      }

      // Check if job already exists
      this.log('Checking if job already exists...');
      const exists = await apiClient.checkJobExists(jobData.jobId);
      
      if (exists) {
        this.log('Job already exists in database');
        this.showNotification('⚠️ Job already exists in database', 'warning');
        return;
      }

      // Send job data to API
      this.log('Sending job data to API...');
      const response = await apiClient.sendJobData(jobData);
      
      if (response.success) {
        this.log('Job data sent successfully');
        this.showNotification('✅ Job data sent successfully', 'success');
      } else {
        this.log('Failed to send job data:', response.message);
        this.showNotification(`❌ Failed to send data: ${response.message}`, 'error');
      }
    } catch (error) {
      this.log('Error during job scraping:', error);
      this.showNotification('❌ Error during scraping', 'error');
    }
  }
}

// Initialize scraper
const jobScraper = new JobScraper();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.action === 'scrapeJob') {
    jobScraper.scrapeJob().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
  return false;
});

// Auto-scrape when page loads (optional)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      // Auto-scrape after 2 seconds to ensure page is fully loaded
      jobScraper.scrapeJob();
    }, 2000);
  });
} else {
  setTimeout(() => {
    jobScraper.scrapeJob();
  }, 2000);
}
