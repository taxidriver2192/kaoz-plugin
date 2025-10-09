/**
 * Jobindex.dk Job Scraper
 * Handles scraping of job details from Jobindex.dk
 */

import { apiClient, JobDetails } from '../utils/apiClient.js';
import { multiSourceApiClient, MultiSourceJobDetails } from '../utils/multiSourceApiClient.js';
import { PlatformDetector } from '../utils/platformDetector.js';
import { showNotification, NotificationType } from '../utils/uiUtils.js';

class JobindexJobScraper {
  private log(message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [JOBINDEX_SCRAPER] ${message}`, ...args);
  }

  private showNotification(message: string, type: NotificationType = 'success') {
    showNotification(message, type);
  }

  /**
   * A utility function to create a delay.
   * @param ms - The number of milliseconds to wait.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract job ID from Jobindex URL
   */
  private extractJobId(): string {
    const url = window.location.href;
    const match = url.match(/\/jobsoegning\/stilling\/(\d+)/);
    return match ? match[1] : `jobindex_${Date.now()}`;
  }

  /**
   * Parse Danish date format to YYYY-MM-DD HH:MM
   */
  private parseJobindexDate(dateString: string): string | null {
    if (!dateString) return null;

    const now = new Date();
    
    // Handle relative dates in Danish
    const relativeDateRegex = /(\d+)\s+(minut|minutter|time|timer|dag|dage|uge|uger|måned|måneder)\s+(siden)/i;
    const match = relativeDateRegex.exec(dateString);

    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      if (unit.startsWith('minut')) {
        now.setMinutes(now.getMinutes() - value);
      } else if (unit.startsWith('time')) {
        now.setHours(now.getHours() - value);
      } else if (unit.startsWith('dag')) {
        now.setDate(now.getDate() - value);
      } else if (unit.startsWith('uge')) {
        now.setDate(now.getDate() - value * 7);
      } else if (unit.startsWith('måned')) {
        now.setMonth(now.getMonth() - value);
      }
    } else if (dateString.toLowerCase().includes('i går')) {
      now.setDate(now.getDate() - 1);
    } else if (dateString.toLowerCase().includes('i dag')) {
      // Keep current date
    } else {
      this.log(`Could not parse Jobindex date: "${dateString}" - using current date`);
    }

    // Format to YYYY-MM-DD HH:MM
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  /**
   * Extract company logo URL from Jobindex page
   */
  private extractCompanyLogoUrl(): string | null {
    const selectors = [
      '.company-logo img',
      '.employer-logo img',
      '.job-header img',
      '.company-info img',
      'img[alt*="logo"]',
      'img[alt*="Logo"]'
    ];

    for (const selector of selectors) {
      const img = document.querySelector<HTMLImageElement>(selector);
      const src = img?.getAttribute('src') || img?.getAttribute('data-src');
      if (src?.startsWith('http')) {
        return src;
      }
    }
    return null;
  }

  /**
   * Ensure company exists in backend and get company ID
   */
  private async ensureCompanyExists(name: string, logoUrl: string | null): Promise<number | null> {
    try {
      // Check if company exists
      const existsResp = await apiClient.checkCompanyExists(name);
      if (existsResp.success && existsResp.data?.exists) {
        const id = existsResp.data.company?.company_id ?? null;
        this.log(`Company exists: ${name} (id=${id})`);
        return id;
      }

      // Create company if it doesn't exist
      const payload = { name, image_url: logoUrl ?? '' };
      this.log('Creating company with payload:', payload);
      const created = await apiClient.createCompany(payload);
      if (created.success && created.data?.company?.company_id) {
        const id = created.data.company.company_id;
        this.log(`Company created: ${name} (id=${id})`);
        return id;
      }

      this.log('Failed to create company:', created.message ?? created);
      return null;
    } catch (err) {
      this.log('Error during ensureCompanyExists:', err);
      return null;
    }
  }

  /**
   * Extract job details from Jobindex page
   */
  private async extractJobDetails(): Promise<JobDetails> {
    this.log("Starting Jobindex job details extraction...");

    const jobIdFromUrl = this.extractJobId();
    const jobIdString = jobIdFromUrl || '';

    const jobDetails: JobDetails = {
      source_id: 2, // Jobindex source ID
      source_job_id: jobIdString,
      title: null,
      location: null,
      description: null,
      apply_url: null,
      posted_date: null,
      applicants: null,
      skills: [],
      company: null,
      company_id: null,
    };

    try {
      // Extract job ID and URL
      const jobId = this.extractJobId();
      jobDetails.apply_url = window.location.href;
      this.log(`Extracted job ID: ${jobId}`);

      // Title - try multiple selectors
      const titleSelectors = [
        'h1.job-title',
        'h1',
        '.job-header h1',
        '.job-details h1',
        '[data-test="job-title"]'
      ];

      for (const selector of titleSelectors) {
        const titleEl = document.querySelector<HTMLElement>(selector);
        if (titleEl?.innerText?.trim()) {
          jobDetails.title = titleEl.innerText.trim();
          this.log(`Found title using selector: ${selector}`);
          break;
        }
      }

      // Company name - try multiple selectors
      const companySelectors = [
        '.company-name',
        '.employer-name',
        '.job-header .company',
        '.job-details .company',
        '[data-test="company-name"]',
        '.company-info h2',
        '.company-info h3'
      ];

      for (const selector of companySelectors) {
        const companyEl = document.querySelector<HTMLElement>(selector);
        if (companyEl?.innerText?.trim()) {
          jobDetails.company = companyEl.innerText.trim();
          this.log(`Found company using selector: ${selector}`);
          break;
        }
      }

      // Location - try multiple selectors
      const locationSelectors = [
        '.job-location',
        '.location',
        '.job-header .location',
        '.job-details .location',
        '[data-test="location"]',
        '.job-info .location'
      ];

      for (const selector of locationSelectors) {
        const locationEl = document.querySelector<HTMLElement>(selector);
        if (locationEl?.innerText?.trim()) {
          jobDetails.location = locationEl.innerText.trim();
          this.log(`Found location using selector: ${selector}`);
          break;
        }
      }

      // Posted date - try multiple selectors
      const dateSelectors = [
        '.job-date',
        '.posted-date',
        '.job-header .date',
        '.job-details .date',
        '[data-test="posted-date"]',
        '.job-info .date'
      ];

      for (const selector of dateSelectors) {
        const dateEl = document.querySelector<HTMLElement>(selector);
        if (dateEl?.innerText?.trim()) {
          const dateText = dateEl.innerText.trim();
          jobDetails.posted_date = this.parseJobindexDate(dateText);
          this.log(`Found posted date using selector: ${selector} - "${dateText}"`);
          break;
        }
      }

      // Description - try multiple selectors
      const descriptionSelectors = [
        '.job-description',
        '.job-content',
        '.job-details .description',
        '.job-body',
        '[data-test="job-description"]',
        '.job-text'
      ];

      for (const selector of descriptionSelectors) {
        const descEl = document.querySelector<HTMLElement>(selector);
        if (descEl?.innerText?.trim()) {
          jobDetails.description = descEl.innerText.trim();
          this.log(`Found description using selector: ${selector}`);
          break;
        }
      }

      // Skills - try to extract from description or dedicated skills section
      const skillsSelectors = [
        '.job-skills',
        '.skills',
        '.requirements',
        '.qualifications',
        '[data-test="skills"]'
      ];

      for (const selector of skillsSelectors) {
        const skillsEl = document.querySelector<HTMLElement>(selector);
        if (skillsEl?.innerText?.trim()) {
          const skillsText = skillsEl.innerText.trim();
          // Simple skill extraction - split by common delimiters
          const skills = skillsText
            .split(/[,;•\n]/)
            .map(skill => skill.trim())
            .filter(skill => skill.length > 0 && skill.length < 50);
          
          if (skills.length > 0) {
            jobDetails.skills = skills;
            this.log(`Found skills using selector: ${selector} - ${skills.length} skills`);
            break;
          }
        }
      }

      // If no dedicated skills section, try to extract from description
      if (jobDetails.skills.length === 0 && jobDetails.description) {
        const commonSkills = [
          'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js',
          'PHP', 'Laravel', 'Python', 'Django', 'Java', 'Spring',
          'C#', '.NET', 'SQL', 'MySQL', 'PostgreSQL', 'MongoDB',
          'Docker', 'Kubernetes', 'AWS', 'Azure', 'Git', 'Linux'
        ];

        const foundSkills: string[] = [];
        for (const skill of commonSkills) {
          if (jobDetails.description.toLowerCase().includes(skill.toLowerCase())) {
            foundSkills.push(skill);
          }
        }

        if (foundSkills.length > 0) {
          jobDetails.skills = foundSkills;
          this.log(`Extracted skills from description: ${foundSkills.length} skills`);
        }
      }

      // Ensure company exists and get company ID
      if (jobDetails.company) {
        const logoUrl = this.extractCompanyLogoUrl();
        jobDetails.company_id = await this.ensureCompanyExists(jobDetails.company, logoUrl);
      }

    } catch (error) {
      this.log("An error occurred during Jobindex scraping:", error);
    }

    this.log("✅ Jobindex job details extraction completed!");
    this.log("Extracted details:", jobDetails);
    return jobDetails;
  }

  /**
   * Internal method to scrape and send job data
   */
  private async scrapeJobInternal(checkDuplicate: boolean = true): Promise<{ success: boolean; message?: string; skillsCount?: number }> {
    try {
      this.log('🚀 Starting Jobindex job scraping process...');
      
      // Get the job ID from URL
      const jobId = this.extractJobId();
      this.log(`📋 Extracted job ID from URL: ${jobId}`);
      
      if (!jobId || jobId === `jobindex_${Date.now()}`) {
        this.log('❌ Could not extract valid job ID from URL');
        return { success: false, message: 'Could not extract job ID from URL' };
      }
      
      // Check if job already exists (if requested)
      if (checkDuplicate) {
        this.log('🔍 Checking if job already exists in database...');
        const existingJobIds = await apiClient.getExistingJobIds();
        this.log(`📊 Found ${existingJobIds.size} existing jobs in database`);
        
        if (existingJobIds.has(jobId)) {
          this.log(`⚠️ Job ${jobId} already exists in database - skipping`);
          return { success: false, message: 'Job already exists in database' };
        }
        this.log(`✅ Job ${jobId} is new - proceeding with extraction`);
      }
      
      this.log('🔧 Starting Jobindex job data extraction...');
      
      // Extract job details
      const jobDetails = await this.extractJobDetails();
      const skillsCount = jobDetails.skills?.length || 0;
      
      this.log('📝 Job extraction completed:', {
        title: jobDetails.title,
        company: jobDetails.company,
        location: jobDetails.location,
        hasDescription: !!jobDetails.description,
        skillsCount: skillsCount,
        company_id: jobDetails.company_id
      });
      
      // Log skills if found
      if (skillsCount > 0) {
        this.log(`🎯 Skills fundet (${skillsCount}): ${jobDetails.skills?.join(', ')}`);
      }
      
      if (!jobDetails.title || !jobDetails.company) {
        this.log('❌ Missing required job data:', {
          hasTitle: !!jobDetails.title,
          hasCompany: !!jobDetails.company
        });
        return { success: false, message: 'Could not extract complete job data' };
      }

      // Convert to multi-source format and send to API
      this.log(`📤 Sending job data to API for job ${jobId}...`);
      
      // Create multi-source job details
      const multiSourceJobDetails = await multiSourceApiClient.createJobDetailsFromCurrentPage(jobDetails);
      if (!multiSourceJobDetails) {
        this.log('❌ Could not create multi-source job details');
        return { success: false, message: 'Could not create multi-source job details' };
      }
      
      this.log('📋 Multi-source job data payload:', JSON.stringify(multiSourceJobDetails, null, 2));
      
      const apiResponse = await multiSourceApiClient.sendJobData(multiSourceJobDetails);
      
      if (apiResponse.success) {
        this.log(`✅ Job ${jobId} successfully sent to API`);
        this.log('📊 API response:', apiResponse.data);
        return { success: true, message: 'Job data sent successfully', skillsCount: skillsCount };
      } else {
        const errorMessage = apiResponse.message || 'Unknown API error';
        this.log(`❌ Failed to send job ${jobId} to API:`, errorMessage);
        this.log('📊 API error details:', apiResponse);
        return { success: false, message: `API error: ${errorMessage}` };
      }
      
    } catch (error) {
      this.log('💥 Error during Jobindex job scraping:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('📊 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return { success: false, message: `Scraping error: ${errorMessage}` };
    }
  }

  /**
   * Public method to scrape current job
   */
  async scrapeJob(): Promise<void> {
    try {
      this.log('Starting Jobindex job scraping...');
      
      const result = await this.scrapeJobInternal(true);
      
      if (result.success) {
        this.showNotification('✅ Jobindex job data sent successfully', 'success');
      } else if (result.message?.includes('already exists')) {
        this.showNotification('⚠️ Job already exists in database', 'warning');
      } else {
        this.showNotification(`❌ ${result.message}`, 'error');
      }
      
    } catch (error) {
      this.log('Error during Jobindex job scraping:', error);
      this.showNotification('❌ Error during scraping', 'error');
    }
  }
}

// Initialize scraper
const jobindexScraper = new JobindexJobScraper();

// Export the class for use in other modules
export { JobindexJobScraper };

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.action === 'scrapeJob') {
    jobindexScraper.scrapeJob().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ success: false, error: errorMessage });
    });
    return true; // Keep message channel open for async response
  }
  return false;
});
