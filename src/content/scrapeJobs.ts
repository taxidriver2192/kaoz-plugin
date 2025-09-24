// =============================================================================
// IMPORTS - Clean modular approach with ES modules
// =============================================================================
import { apiClient, JobDetails } from '../utils/apiClient.js';
import { showNotification, NotificationType } from '../utils/uiUtils.js';

// =============================================================================
// JOB SCRAPER CLASS
// =============================================================================

class JobScraper {
  private log(message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [LINKEDIN_SCRAPER_JOBS] ${message}`, ...args);
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
   * Normalizes work type text from LinkedIn to standardized values.
   * @param workTypeText - The raw work type text from LinkedIn
   * @returns 'remote' | 'hybrid' | 'onsite' | null
   */
  private normalizeWorkType(workTypeText: string): 'remote' | 'hybrid' | 'onsite' | null {
    if (!workTypeText) return null;
    
    const text = workTypeText.toLowerCase().trim();
    
    // Remote work indicators (Danish and English)
    if (text.includes('fjernarbejde') || 
        text.includes('remote') || 
        text.includes('hjemmefra') ||
        text.includes('arbejde hjemmefra') ||
        text.includes('work from home') ||
        text.includes('telecommute')) {
      return 'remote';
    }
    
    // Hybrid work indicators (Danish and English)
    if (text.includes('hybrid') || 
        text.includes('hybridarbejde') ||
        text.includes('blandet') ||
        text.includes('flexibel') ||
        text.includes('kombineret') ||
        text.includes('mixed') ||
        text.includes('flexible')) {
      return 'hybrid';
    }
    
    // Onsite work indicators (Danish and English)
    if (text.includes('fysisk tilstedeværelse') ||
        text.includes('på stedet') ||
        text.includes('on-site') ||
        text.includes('onsite') ||
        text.includes('in-office') ||
        text.includes('kontorarbejde') ||
        text.includes('physical presence')) {
      return 'onsite';
    }
    
    // Employment type indicators that typically default to onsite
    // Danish: Fuldtid, Deltid, Kontrakt, Praktik, etc.
    // English: Full-time, Part-time, Contract, Internship, etc.
    if (text.includes('fuldtid') || 
        text.includes('deltid') || 
        text.includes('kontrakt') ||
        text.includes('praktik') ||
        text.includes('full-time') || 
        text.includes('part-time') ||
        text.includes('contract') ||
        text.includes('internship') ||
        text.includes('freelance') ||
        text.includes('consultant') ||
        text.includes('vikar') ||
        text.includes('temp')) {
      return 'onsite';
    }
    
    // Default to onsite for unknown work types
    return 'onsite';
  }

  /**
   * Parses a relative date string from Danish/English (e.g., "30 minutter siden", "19 timer siden", "1 dag siden") 
   * into a YYYY-MM-DD HH:MM format with precise time calculation.
   * @param dateString - The relative date string.
   */
  private parseRelativeDate(dateString: string): string | null {
    if (!dateString) return null;

    const now = new Date();
    
    // Enhanced regex to capture minutes, hours, days, weeks, and months
    // Supports both Danish and English formats
    const regex = /(\d+)\s+(minut|minutter|minute|minutes|time|timer|hour|hours|dag|dage|day|days|uge|uger|week|weeks|måned|måneder|month|months)/i;
    const match = regex.exec(dateString);

    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      // Handle minutes
      if (unit.startsWith('minut')) {
        now.setMinutes(now.getMinutes() - value);
      }
      // Handle hours
      else if (unit.startsWith('time') || unit.startsWith('hour')) {
        now.setHours(now.getHours() - value);
      }
      // Handle days
      else if (unit.startsWith('dag') || unit.startsWith('day')) {
        now.setDate(now.getDate() - value);
      }
      // Handle weeks
      else if (unit.startsWith('uge') || unit.startsWith('week')) {
        now.setDate(now.getDate() - value * 7);
      }
      // Handle months
      else if (unit.startsWith('måned') || unit.startsWith('month')) {
        now.setMonth(now.getMonth() - value);
      }
    } 
    // Handle "i går" / "yesterday"
    else if (dateString.toLowerCase().includes('i går') || dateString.toLowerCase().includes('yesterday')) {
      now.setDate(now.getDate() - 1);
    }
    // Handle "i dag" / "today" - no change needed
    else if (dateString.toLowerCase().includes('i dag') || dateString.toLowerCase().includes('today')) {
      // Keep current date
    }
    // If no match found, return current date
    else {
      this.log(`Could not parse relative date: "${dateString}" - using current date`);
    }
    
    // Format to YYYY-MM-DD HH:MM
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const result = `${year}-${month}-${day} ${hours}:${minutes}`;
    this.log(`Parsed relative date "${dateString}" to: ${result}`);
    return result;
  }

  private extractJobId(): string {
    // Extract job ID from URL - prioritize currentJobId parameter
    const url = window.location.href;
    const urlObj = new URL(url);
    
    // First try to get from currentJobId parameter
    const currentJobId = urlObj.searchParams.get('currentJobId');
    if (currentJobId) {
      return currentJobId;
    }
    
    // Fallback to URL path
    const regex = /jobs\/view\/(\d+)/;
    const match = regex.exec(url);
    return match ? match[1] : `job_${Date.now()}`;
  }

  // ---------------------------------------------------------------------------
  // COMPANY HELPERS
  // ---------------------------------------------------------------------------
  private extractCompanyLogoUrl(root?: HTMLElement | null): string | null {
    // Try targeted selectors first
    const scopes: (ParentNode | null)[] = [root ?? null, document];
    const selectors = [
      'a[aria-label*="Logo"] img',
      'img[alt*="Logo"]',
      'img.EntityPhoto-square-1',
      '.jobs-unified-top-card img',
      '.job-details-jobs-unified-top-card img',
    ];

    for (const scope of scopes) {
      if (!scope) continue;
      for (const sel of selectors) {
        const img = scope.querySelector<HTMLImageElement>(sel);
        const src = img?.getAttribute('src') || img?.getAttribute('data-delayed-url');
        if (src?.startsWith('http')) {
          return src.replace(/&amp;/g, '&');
        }
      }
    }
    return null;
  }

  private async ensureCompanyExists(name: string, logoUrl: string | null): Promise<number | null> {
    try {
      // First, check if the company exists and get its ID
      const existsResp = await apiClient.checkCompanyExists(name);
      if (existsResp.success && existsResp.data?.exists) {
        const id = existsResp.data.company?.company_id ?? null;
        this.log(`Company exists: ${name} (id=${id})`);
        return id;
      }

      // Not found, create it
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
   * Enhanced job data extraction using the comprehensive scraping approach
   */
  private async extractJobDetails(): Promise<JobDetails> {
    this.log("Starting comprehensive job details extraction...");

    const jobDetails: JobDetails = {
      linkedin_job_id: null,
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
      // Extract job ID from URL first - this should always work with currentJobId parameter
      const jobIdFromUrl = this.extractJobId();
      if (jobIdFromUrl && jobIdFromUrl !== `job_${Date.now()}`) {
        jobDetails.linkedin_job_id = parseInt(jobIdFromUrl, 10);
        jobDetails.apply_url = `https://www.linkedin.com/jobs/view/${jobIdFromUrl}/`;
        this.log(`Extracted job ID from URL: ${jobIdFromUrl}`);
      }

      // Try multiple possible selectors for the main job card
      const possibleTopCardSelectors = [
        '.job-details-jobs-unified-top-card',
        '.jobs-unified-top-card',
        '.job-view-layout',
        '.jobs-search__job-details',
        '.job-details'
      ];

      let topCardEl: HTMLElement | null = null;
      for (const selector of possibleTopCardSelectors) {
        topCardEl = document.querySelector<HTMLElement>(selector);
        if (topCardEl) {
          this.log(`Found job card using selector: ${selector}`);
          break;
        }
      }

      if (topCardEl) {
        // Title - try multiple selectors
        const titleSelectors = [
          '.job-details-jobs-unified-top-card__job-title',
          '.jobs-unified-top-card__job-title', 
          '.job-details-jobs-unified-top-card__job-title a',
          '.jobs-unified-top-card__job-title a',
          'h1'
        ];
        
        for (const selector of titleSelectors) {
          const titleEl = topCardEl.querySelector<HTMLElement>(selector);
          if (titleEl?.innerText?.trim()) {
            jobDetails.title = titleEl.innerText.trim();
            this.log(`Found title using selector: ${selector}`);
            break;
          }
        }

        // Company name - try multiple selectors
        const companySelectors = [
          '.job-details-jobs-unified-top-card__company-name',
          '.jobs-unified-top-card__company-name',
          '.job-details-jobs-unified-top-card__company-name a',
          '.jobs-unified-top-card__company-name a',
          '[data-test-id="job-details-company-name"]'
        ];
        
        for (const selector of companySelectors) {
          const companyEl = topCardEl.querySelector<HTMLElement>(selector);
          if (companyEl?.innerText?.trim()) {
            jobDetails.company = companyEl.innerText.trim();
            this.log(`Found company using selector: ${selector}`);
            break;
          }
        }

        // Location, Posted Date, and Applicants
        const tertiaryInfoSelectors = [
          '.job-details-jobs-unified-top-card__tertiary-description-container',
          '.jobs-unified-top-card__tertiary-description',
          '.job-details-jobs-unified-top-card__tertiary-description'
        ];
        
        let tertiaryInfoEl: HTMLElement | null = null;
        for (const selector of tertiaryInfoSelectors) {
          tertiaryInfoEl = topCardEl.querySelector<HTMLElement>(selector);
          if (tertiaryInfoEl) {
            this.log(`Found tertiary info using selector: ${selector}`);
            break;
          }
        }
        
        if (tertiaryInfoEl) {
          const tertiaryInfoText = tertiaryInfoEl.innerText ?? '';
          
          // Location - try multiple approaches to extract from tertiary info
          let locationFound = false;
          
          // First try specific LinkedIn structure selectors
          const locationSelectors = [
            '.tvm__text.tvm__text--low-emphasis:first-child',  // New LinkedIn structure
            'span:first-child',                                 // Generic first span
            '.job-details-jobs-unified-top-card__bullet'       // Older structure
          ];
          
          for (const selector of locationSelectors) {
            const locationEl = tertiaryInfoEl.querySelector<HTMLElement>(selector);
            if (locationEl?.innerText?.trim()) {
              const locationText = locationEl.innerText.trim();
              // Clean up location text (remove extra whitespace, newlines)
              const cleanLocation = locationText.replace(/\s+/g, ' ').trim();
              if (cleanLocation && !cleanLocation.includes('siden') && !cleanLocation.includes('ago')) {
                jobDetails.location = cleanLocation;
                this.log(`Found location using selector: ${selector} - "${cleanLocation}"`);
                locationFound = true;
                break;
              }
            }
          }
          
          // Fallback: extract location from the beginning of tertiary text
          if (!locationFound) {
            const locationRegex = /^([^·•\n]+)/;
            const locationMatch = locationRegex.exec(tertiaryInfoText);
            if (locationMatch) {
              const locationText = locationMatch[1].trim();
              if (locationText && !locationText.includes('siden') && !locationText.includes('ago')) {
                jobDetails.location = locationText;
                this.log(`Found location using regex fallback: "${locationText}"`);
              }
            }
          }
          
          // Extract applicants using multiple regex patterns (Danish formats)
          const applicantsRegexes = [
            /(\d+)\s+ansøgere/i,                              // "7 ansøgere"
            /(\d+)\s+personer\s+klikkede\s+på\s+Ansøg/i,      // "X personer klikkede på Ansøg"
            /(\d+)\s+applicants/i,                            // "X applicants" (English)
            /(\d+)\s+personer\s+har\s+ansøgt/i               // "X personer har ansøgt"
          ];
          
          let applicantsMatch: RegExpExecArray | null = null;
          for (const regex of applicantsRegexes) {
            applicantsMatch = regex.exec(tertiaryInfoText);
            if (applicantsMatch) {
              this.log(`Found applicants using pattern: ${regex.source}`);
              break;
            }
          }
          jobDetails.applicants = applicantsMatch ? parseInt(applicantsMatch[1], 10) : null;

          // Extract and parse posted date - enhanced to capture more formats
          const postedDateRegex = /(\d+\s+(minut|minutter|minute|minutes|time|timer|hour|hours|dag|dage|day|days|uge|uger|week|weeks|måned|måneder|month|months)\s+siden|i går|yesterday|i dag|today)/i;
          const postedDateMatch = postedDateRegex.exec(tertiaryInfoText);
          if (postedDateMatch) {
            jobDetails.posted_date = this.parseRelativeDate(postedDateMatch[0]);
          } else {
            // Fallback to current date and time in YYYY-MM-DD HH:MM format
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            jobDetails.posted_date = `${year}-${month}-${day} ${hours}:${minutes}`;
          }
        }

        // Work Type - try multiple selectors
        const workTypeSelectors = [
          '.job-details-fit-level-preferences button',
          '.job-criteria-list__item',
          '.job-details-jobs-unified-top-card__job-insight'
        ];
        
        for (const selector of workTypeSelectors) {
          const workTypeElements = Array.from(topCardEl.querySelectorAll<HTMLElement>(selector));
          const workTypeEl = workTypeElements.find(btn => 
            btn.innerText.includes('Fuldtid') || 
            btn.innerText.includes('Deltid') || 
            btn.innerText.includes('Kontrakt') ||
            btn.innerText.includes('Full-time') ||
            btn.innerText.includes('Part-time') ||
            btn.innerText.includes('Fysisk tilstedeværelse') ||
            btn.innerText.includes('Hybridarbejde') ||
            btn.innerText.includes('Fjernarbejde') ||
            btn.innerText.includes('Remote') ||
            btn.innerText.includes('Hybrid')
          );
          if (workTypeEl) {
            // jobDetails.work_type = this.normalizeWorkType(workTypeEl.innerText.trim());
            this.log(`Found work type using selector: ${selector}`);
            break;
          }
        }
        
      } else {
        this.log("Could not find any job card element - trying global fallback selectors");
        
        // Global fallback selectors
        const titleSelectors = [
          'h1[data-test="job-title"]',
          '.jobs-unified-top-card__job-title',
          '.t-24.t-bold.inline',
          'h1'
        ];
        
        for (const selector of titleSelectors) {
          const titleEl = document.querySelector<HTMLElement>(selector);
          if (titleEl?.textContent?.trim()) {
            jobDetails.title = titleEl.textContent.trim();
            this.log(`Found title using global selector: ${selector}`);
            break;
          }
        }
        
        const companySelectors = [
          '[data-test="job-details-company-name"]',
          '.jobs-unified-top-card__company-name',
          '.jobs-unified-top-card__company-name a'
        ];
        
        for (const selector of companySelectors) {
          const companyEl = document.querySelector<HTMLElement>(selector);
          if (companyEl?.textContent?.trim()) {
            jobDetails.company = companyEl.textContent.trim();
            this.log(`Found company using global selector: ${selector}`);
            break;
          }
        }
        
        const locationSelectors = [
          '[data-test="job-details-location"]',
          '.jobs-unified-top-card__bullet',
          '.jobs-unified-top-card__workplace-type'
        ];
        
        for (const selector of locationSelectors) {
          const locationEl = document.querySelector<HTMLElement>(selector);
          if (locationEl?.textContent?.trim()) {
            jobDetails.location = locationEl.textContent.trim();
            this.log(`Found location using global selector: ${selector}`);
            break;
          }
        }
      }

      // --- Job Description - try multiple selectors ---
      const descriptionSelectors = [
        '#job-details',
        '.jobs-description-content__text',
        '.jobs-box__html-content',
        '.job-details-jobs-unified-top-card__job-description',
        '[data-test="job-details-description"]'
      ];
      
      for (const selector of descriptionSelectors) {
        const descEl = document.querySelector<HTMLElement>(selector);
        if (descEl?.innerText?.trim()) {
          let description = descEl.innerText.trim();
          
          // Clean up description - remove "Om jobbet" prefix if present
          if (description.startsWith('Om jobbet')) {
            description = description.replace(/^Om jobbet\s*\n*/, '').trim();
            this.log('Removed "Om jobbet" prefix from description');
          }
          
          jobDetails.description = description;
          this.log(`Found description using selector: ${selector}`);
          break;
        }
      }

      // --- Skills (Asynchronous part) ---
      this.log("Attempting to find and click the skills button...");
      const skillsButtonSelectors = [
        'button:has(svg[data-test-icon="skills-small"])',
        'button[aria-label*="kompetence"]',
        'button[aria-label*="skills"]',
        '.job-details-how-you-match__skills-item-subtitle button'
      ];
      
      let skillsButton: HTMLButtonElement | null = null;
      for (const selector of skillsButtonSelectors) {
        skillsButton = document.querySelector<HTMLButtonElement>(selector);
        if (skillsButton) {
          this.log(`Found skills button using selector: ${selector}`);
          break;
        }
      }
      
      if (skillsButton) {
        skillsButton.click();
        this.log("Skills button clicked. Waiting for modal...");

        await this.sleep(3000); // Wait for modal animation

        const skillsModalSelectors = [
          '.job-details-preferences-and-skills__modal-section-insights-list-item .text-body-small',
          '.job-details-how-you-match__skills-item-subtitle',
          '.skill-match-modal .skill-name'
        ];
        
        for (const selector of skillsModalSelectors) {
          const skillElements = document.querySelectorAll<HTMLElement>(selector);
          if (skillElements.length > 0) {
            this.log(`Found ${skillElements.length} skills using selector: ${selector}`);
            jobDetails.skills = Array.from(skillElements).map(el => el.innerText.trim());
            break;
          }
        }
        
        // Close the modal
        const closeModalButton = document.querySelector<HTMLButtonElement>('.artdeco-modal__dismiss');
        if (closeModalButton) {
          closeModalButton.click();
          this.log("Skills modal closed.");
        }
      } else {
        this.log("No skills button found on the page.");
      }

      // Ensure company exists in backend (create if missing) and capture ID
      if (jobDetails.company) {
        const logoUrl = this.extractCompanyLogoUrl(topCardEl);
        jobDetails.company_id = await this.ensureCompanyExists(jobDetails.company, logoUrl);
      }

    } catch (error) {
      this.log("An error occurred during comprehensive scraping:", error);
    }

    this.log("✅ Comprehensive job details extraction completed!");
    this.log("Extracted details:", jobDetails);
    return jobDetails;
  }

  

  /**
   * Navigate to a specific job by editing the URL directly
   */
  private async navigateToJob(jobId: string): Promise<boolean> {
    this.log(`Navigating to job ${jobId} by URL...`);
    
    try {
      // Get current URL and update the currentJobId parameter
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('currentJobId', jobId);
      
      const newUrl = currentUrl.toString();
      this.log(`Navigating to: ${newUrl}`);
      
      // Method 1: Update the URL without page reload
      window.history.pushState(null, '', newUrl);
      
      // Method 2: Trigger multiple events to ensure LinkedIn's SPA router responds
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.dispatchEvent(new Event('hashchange'));
      
      // Method 3: Try to trigger a custom event that LinkedIn might be listening for
      const customEvent = new CustomEvent('url-change', { detail: { url: newUrl } });
      window.dispatchEvent(customEvent);
      
      // Method 4: If LinkedIn uses history API, try to simulate navigation
      try {
        // Dispatch a fake router event
        const routerEvent = new CustomEvent('router:navigate', { 
          detail: { path: newUrl } 
        });
        window.dispatchEvent(routerEvent);
      } catch (e) {
        // Ignore if this fails
      }
      
      this.log(`URL updated successfully for job ${jobId}`);
      return true;
      
    } catch (error) {
      this.log(`Error navigating to job ${jobId}:`, error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // SEARCH PAGE NAVIGATION (pagination helpers)
  // ---------------------------------------------------------------------------
  private getCurrentSearchStart(): number {
    try {
      const url = new URL(window.location.href);
      const startParam = url.searchParams.get('start');
      const start = parseInt(startParam ?? '0', 10);
      return Number.isNaN(start) ? 0 : start;
    } catch {
      return 0;
    }
  }

  private async navigateToSearchStart(start: number): Promise<boolean> {
    this.log(`Navigating to search page with start=${start}...`);
    try {
      const currentUrl = new URL(window.location.href);
      if (!currentUrl.pathname.includes('/jobs/search')) {
        currentUrl.pathname = '/jobs/search/';
      }
      currentUrl.searchParams.set('start', String(start));

      const newUrl = currentUrl.toString();
      this.log(`Navigating to search URL: ${newUrl}`);

      window.history.pushState(null, '', newUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.dispatchEvent(new Event('hashchange'));
      try {
        const routerEvent = new CustomEvent('router:navigate', { detail: { path: newUrl } });
        window.dispatchEvent(routerEvent);
      } catch {}

      // Give the list time to refresh
      await this.sleep(1500);

      return true;
    } catch (error) {
      this.log('Error navigating to search page:', error);
      return false;
    }
  }

  /**
   * Scrape all job IDs from the LinkedIn job list by scrolling through it
   */
  async scrapeLinkedInJobIds(): Promise<Set<string>> {
    this.log("Starting LinkedIn job list scraper...");

    // Find the scrollable container
    const scrollContainer = document.querySelector<HTMLElement>('.scaffold-layout__list');

    if (!scrollContainer) {
      this.log("Error: Could not find the job list scroll container with class '.scaffold-layout__list'.");
      this.showNotification('❌ Could not find job list container', 'error');
      return new Set<string>();
    }

    this.log("Successfully found the scroll container.", scrollContainer);
    this.showNotification('🔍 Starting bulk job scraping...', 'success');

    // Use a Set to automatically store only unique job IDs
    const collectedJobIds = new Set<string>();
    
    // Helper function to extract IDs currently in the DOM
    const extractVisibleJobIds = () => {
      const jobElements = scrollContainer.querySelectorAll<HTMLLIElement>('li[data-occludable-job-id]');
      
      if (jobElements.length === 0) {
        this.log("No job elements found in the current view.");
        return;
      }

      let newIdsFound = 0;
      jobElements.forEach(jobElement => {
        const jobId = jobElement.dataset.occludableJobId;
        if (jobId && !collectedJobIds.has(jobId)) {
          collectedJobIds.add(jobId);
          newIdsFound++;
        }
      });
      
      if (newIdsFound > 0) {
        this.log(`Found ${newIdsFound} new job IDs. Total collected: ${collectedJobIds.size}`);
      }
    };

    // Scroll through the container and collect IDs
    let lastHeight = 0;
    let currentHeight = scrollContainer.scrollHeight;
    
    // Initially extract whatever is visible
    extractVisibleJobIds();

    while (lastHeight !== currentHeight) {
      lastHeight = scrollContainer.scrollHeight;
      
      // Scroll to the bottom of the container
      scrollContainer.scrollTo(0, lastHeight);
      this.log(`Scrolling to ${lastHeight}px...`);

      // Wait for new jobs to load
      await this.sleep(2000); // 2-second delay for network requests

      // After waiting, extract any new job IDs that have been loaded
      extractVisibleJobIds();

      currentHeight = scrollContainer.scrollHeight;

      // If the height hasn't changed after scrolling and waiting, we've reached the end
      if (lastHeight === currentHeight) {
        this.log("Scroll height hasn't changed. Reached the end of the list.");
        break;
      }
    }

    this.log("✅ Job ID scraping complete!");
    this.log(`Total unique job IDs collected: ${collectedJobIds.size}`);
    this.log("All collected IDs:", Array.from(collectedJobIds));
    
    this.showNotification(`✅ Found ${collectedJobIds.size} unique jobs`, 'success');
    
    return collectedJobIds;
  }

  /**
   * Bulk scrape all jobs across search pages (25 per page)
   */
  async bulkScrapeJobs(): Promise<void> {
    try {
      this.log('Starting bulk job scraping across pages...');
      
      // Fetch existing job IDs once at the start
      this.showNotification('📋 Fetching existing jobs from database...', 'success');
      const existingJobIds = await apiClient.getExistingJobIds();
      this.log(`Found ${existingJobIds.size} existing jobs in database`);

      const pageSize = 25;
      let start = this.getCurrentSearchStart();
      const maxPages = 20; // Safety cap to prevent infinite loops

      let totalSuccess = 0;
      let totalErrors = 0;
      let totalDuplicates = 0;

      for (let page = 0; page < maxPages; page++) {
        if (page > 0) {
          start += pageSize;
          const navOk = await this.navigateToSearchStart(start);
          if (!navOk) {
            this.log(`Failed to navigate to next page (start=${start}). Stopping.`);
            break;
          }
          await this.sleep(1500);
        }

        this.log(`Scraping page ${page + 1} (start=${start})...`);
        const scrapedJobIds = await this.scrapeLinkedInJobIds();

        if (scrapedJobIds.size === 0) {
          this.log('No job IDs found on this page. Stopping pagination.');
          break;
        }

        // Filter out jobs that already exist in the database
        const newJobIds = new Set<string>();
        let duplicateCount = 0;
        for (const jobId of scrapedJobIds) {
          if (existingJobIds.has(jobId)) {
            duplicateCount++;
            this.log(`Job ${jobId} already exists in database - skipping`);
          } else {
            newJobIds.add(jobId);
          }
        }
        totalDuplicates += duplicateCount;

        this.log(`Page ${page + 1}: Total scraped: ${scrapedJobIds.size}, New: ${newJobIds.size}, Duplicates: ${duplicateCount}`);

        if (newJobIds.size === 0) {
          // Continue to next page if nothing to process here
          continue;
        }

        this.showNotification(`🚀 Processing ${newJobIds.size} new jobs on page ${page + 1}...`, 'success');

        let processedCount = 0;
        for (const jobId of newJobIds) {
          try {
            processedCount++;
            this.log(`Processing job ${processedCount}/${newJobIds.size} (page ${page + 1}): ${jobId}`);
            
            const navigated = await this.navigateToJob(jobId);
            if (!navigated) {
              this.log(`Failed to navigate to job ${jobId}`);
            }

            await this.sleep(500);

            const result = await this.scrapeJobInternal(false);
            if (result.success) {
              this.log(`✅ Job ${jobId} processed successfully`);
              totalSuccess++;
              // Prevent reprocessing the same job on later pages
              existingJobIds.add(jobId);
            } else {
              this.log(`❌ Job ${jobId} failed: ${result.message}`);
              totalErrors++;
            }

            // Small delay between jobs to be respectful
            await this.sleep(1500);

          } catch (error) {
            this.log(`Error processing job ${jobId}:`, error);
            totalErrors++;
          }
        }
      }

      const totalAttempted = totalSuccess + totalErrors;
      this.log(`Bulk scraping complete across pages! Successfully processed: ${totalSuccess}, Duplicates skipped: ${totalDuplicates}, Errors: ${totalErrors}, Total attempted: ${totalAttempted}`);
      
      let notificationType: NotificationType = 'warning';
      if (totalSuccess > 0) {
        notificationType = 'success';
      } else if (totalErrors > 0) {
        notificationType = 'error';
      }
      
      this.showNotification(
        `✅ Bulk scraping complete! Success: ${totalSuccess}, Duplicates: ${totalDuplicates}, Errors: ${totalErrors}`,
        notificationType
      );

    } catch (error) {
      this.log('Error during bulk job scraping:', error);
      this.showNotification('❌ Error during bulk scraping', 'error');
    }
  }

  /**
   * Internal method to scrape and send job data - shared by both single and bulk scraping
   */
  private async scrapeJobInternal(checkDuplicate: boolean = true): Promise<{ success: boolean; message?: string }> {
    try {
      this.log('🚀 Starting job scraping process...');
      
      // First, get the job ID from URL to check if it exists
      const jobIdFromUrl = this.extractJobId();
      this.log(`📋 Extracted job ID from URL: ${jobIdFromUrl}`);
      
      if (!jobIdFromUrl || jobIdFromUrl === `job_${Date.now()}`) {
        this.log('❌ Could not extract valid job ID from URL');
        return { success: false, message: 'Could not extract job ID from URL' };
      }
      
      // Check if job already exists (if requested)
      if (checkDuplicate) {
        this.log('🔍 Checking if job already exists in database...');
        const existingJobIds = await apiClient.getExistingJobIds();
        this.log(`📊 Found ${existingJobIds.size} existing jobs in database`);
        
        if (existingJobIds.has(jobIdFromUrl)) {
          this.log(`⚠️ Job ${jobIdFromUrl} already exists in database - skipping`);
          return { success: false, message: 'Job already exists in database' };
        }
        this.log(`✅ Job ${jobIdFromUrl} is new - proceeding with extraction`);
      }
      
      this.log('🔧 Starting comprehensive job data extraction...');
      
      // Use the comprehensive extraction method
      const jobDetails = await this.extractJobDetails();
      this.log('📝 Job extraction completed:', {
        linkedin_job_id: jobDetails.linkedin_job_id,
        title: jobDetails.title,
        company: jobDetails.company,
        location: jobDetails.location,
        hasDescription: !!jobDetails.description,
        skillsCount: jobDetails.skills?.length || 0,
        company_id: jobDetails.company_id
      });
      
      if (!jobDetails.linkedin_job_id || !jobDetails.title || !jobDetails.company) {
        this.log('❌ Missing required job data:', {
          hasJobId: !!jobDetails.linkedin_job_id,
          hasTitle: !!jobDetails.title,
          hasCompany: !!jobDetails.company
        });
        return { success: false, message: 'Could not extract complete job data' };
      }

      // Send job data to API
      this.log(`📤 Sending job data to API for job ${jobIdFromUrl}...`);
      this.log('📋 Job data payload:', JSON.stringify(jobDetails, null, 2));
      
      const apiResponse = await apiClient.sendJobData(jobDetails);
      
      if (apiResponse.success) {
        this.log(`✅ Job ${jobIdFromUrl} successfully sent to API`);
        this.log('📊 API response:', apiResponse.data);
        return { success: true, message: 'Job data sent successfully' };
      } else {
        const errorMessage = apiResponse.message || 'Unknown API error';
        this.log(`❌ Failed to send job ${jobIdFromUrl} to API:`, errorMessage);
        this.log('📊 API error details:', apiResponse);
        return { success: false, message: `API error: ${errorMessage}` };
      }
      
    } catch (error) {
      this.log('💥 Error during job scraping:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('📊 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return { success: false, message: `Scraping error: ${errorMessage}` };
    }
  }

  async scrapeJob(): Promise<void> {
    try {
      this.log('Starting job scraping...');
      
      const result = await this.scrapeJobInternal(true);
      
      if (result.success) {
        this.showNotification('✅ Job data sent successfully', 'success');
      } else if (result.message?.includes('already exists')) {
        this.showNotification('⚠️ Job already exists in database', 'warning');
      } else {
        this.showNotification(`❌ ${result.message}`, 'error');
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ success: false, error: errorMessage });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'bulkScrapeJobs') {
    jobScraper.bulkScrapeJobs().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ success: false, error: errorMessage });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === 'scrapeJobIds') {
    jobScraper.scrapeLinkedInJobIds().then((jobIds) => {
      sendResponse({ success: true, jobIds: Array.from(jobIds) });
    }).catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendResponse({ success: false, error: errorMessage });
    });
    return true; // Keep message channel open for async response
  }
  return false;
});
