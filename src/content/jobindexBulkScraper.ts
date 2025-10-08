/**
 * Jobindex Bulk Scraper
 * Scrapes job listings from Jobindex.dk search pages
 */

import { multiSourceApiClient, MultiSourceJobDetails } from '../utils/multiSourceApiClient.js';
import { PlatformDetector } from '../utils/platformDetector.js';
import { showNotification, NotificationType } from '../utils/uiUtils.js';

export interface JobindexJobListing {
  id: string;
  title: string;
  company: string;
  companyUrl: string | null;
  location: string;
  redirectUrl: string;
  finalUrl: string | null;
  publishedDate: string;
  description: string | null;
}

export interface BulkScrapeResult {
  success: boolean;
  totalJobs: number;
  processedJobs: number;
  successfulJobs: number;
  failedJobs: number;
  errors: string[];
  jobs: JobindexJobListing[];
}

export class JobindexBulkScraper {
  private log(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [JOBINDEX_BULK_SCRAPER] ${message}`, ...args);
  }

  /**
   * Analyze collected jobs in storage and print host breakdown
   */
  async analyzeCollectedJobsHosts(): Promise<{ total: number; byHost: Record<string, number> }> {
    this.log('📊 Analyzing collected Jobindex jobs (host distribution)...');

    const jobs: JobindexJobListing[] = await new Promise((resolve) => {
      chrome.storage?.local?.get(['jobindexBulkJobs'], (data) => {
        resolve((data?.jobindexBulkJobs as JobindexJobListing[]) || []);
      });
    });

    const byHost: Record<string, number> = {};
    for (const job of jobs) {
      const urlToUse = job.finalUrl || job.redirectUrl;
      try {
        const u = new URL(urlToUse);
        const host = u.hostname.replace(/^www\./, '');
        byHost[host] = (byHost[host] || 0) + 1;
      } catch {
        byHost['invalid-url'] = (byHost['invalid-url'] || 0) + 1;
      }
    }

    // Sort and log nicely
    const entries = Object.entries(byHost).sort((a, b) => b[1] - a[1]);
    const total = jobs.length;
    this.log(`📦 Total collected jobs: ${total}`);
    for (const [host, count] of entries) {
      const pct = ((count / total) * 100).toFixed(1);
      this.log(`• ${host}: ${count} (${pct}%)`);
    }

    return { total, byHost };
  }
  private showNotification(message: string, type: NotificationType = 'success'): void {
    showNotification(message, type);
  }

  /**
   * Scrape all jobs from the current search page
   */
  async scrapeCurrentPage(): Promise<BulkScrapeResult> {
    this.log('🚀 Starting Jobindex bulk scraping from current page...');
    
    try {
      const jobs = await this.extractJobsFromCurrentPage();
      this.log(`📋 Found ${jobs.length} jobs on current page`);
      
      if (jobs.length === 0) {
        this.showNotification('❌ No jobs found on current page', 'error');
        return {
          success: false,
          totalJobs: 0,
          processedJobs: 0,
          successfulJobs: 0,
          failedJobs: 0,
          errors: ['No jobs found on current page'],
          jobs: []
        };
      }

      // Process each job
      const result = await this.processJobs(jobs);
      
      this.log(`✅ Bulk scraping completed: ${result.successfulJobs}/${result.totalJobs} jobs processed successfully`);
      this.showNotification(`✅ Bulk scraping completed: ${result.successfulJobs}/${result.totalJobs} jobs processed`, 'success');
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('❌ Error during bulk scraping:', errorMessage);
      this.showNotification('❌ Error during bulk scraping', 'error');
      
      return {
        success: false,
        totalJobs: 0,
        processedJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        errors: [errorMessage],
        jobs: []
      };
    }
  }

  /**
   * Scrape all jobs from multiple pages (pagination)
   */
  async scrapeAllPages(maxPages: number = 10): Promise<BulkScrapeResult> {
    this.log(`🚀 Starting Jobindex bulk scraping from all pages (max ${maxPages})...`);
    
    try {
      const allJobs: JobindexJobListing[] = [];
      let currentPage = 1;
      let hasMoreJobs = true;

      while (hasMoreJobs && currentPage <= maxPages) {
        this.log(`📄 Scraping page ${currentPage}...`);
        
        const pageJobs = await this.extractJobsFromPage(currentPage);
        this.log(`📋 Found ${pageJobs.length} jobs on page ${currentPage}`);
        
        if (pageJobs.length === 0) {
          hasMoreJobs = false;
          this.log('📄 No more jobs found, stopping pagination');
        } else {
          allJobs.push(...pageJobs);
          currentPage++;
          
          // Add delay between pages to be respectful
          await this.delay(2000);
        }
      }

      this.log(`📋 Total jobs found across ${currentPage - 1} pages: ${allJobs.length}`);

      if (allJobs.length === 0) {
        this.showNotification('❌ No jobs found on any pages', 'error');
        return {
          success: false,
          totalJobs: 0,
          processedJobs: 0,
          successfulJobs: 0,
          failedJobs: 0,
          errors: ['No jobs found on any pages'],
          jobs: []
        };
      }

      // Process all jobs
      const result = await this.processJobs(allJobs);
      
      this.log(`✅ Bulk scraping completed: ${result.successfulJobs}/${result.totalJobs} jobs processed successfully`);
      this.showNotification(`✅ Bulk scraping completed: ${result.successfulJobs}/${result.totalJobs} jobs processed`, 'success');
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('❌ Error during bulk scraping:', errorMessage);
      this.showNotification('❌ Error during bulk scraping', 'error');
      
      return {
        success: false,
        totalJobs: 0,
        processedJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        errors: [errorMessage],
        jobs: []
      };
    }
  }

  /**
   * Extract jobs from the current page
   */
  private async extractJobsFromCurrentPage(): Promise<JobindexJobListing[]> {
    this.log('🔍 Extracting jobs from current page...');
    
    // Wait for page to load
    await this.delay(1000);
    
    // Find all potential job containers and filter
    const allContainers = Array.from(document.querySelectorAll('[data-tid]')) as HTMLElement[];
    this.log(`📋 Found ${allContainers.length} job containers`);

    const jobs: JobindexJobListing[] = [];
    const seenIds = new Set<string>();

    for (const container of allContainers) {
      try {
        // Skip if container doesn't include a job link/button
        const hasJobLink = !!(container.querySelector('a.seejobdesktop, a.btn-primary, h4 a, h3 a'));
        if (!hasJobLink) { continue; }

        const job = await this.extractJobFromContainer(container as HTMLElement);
        if (job) {
          if (seenIds.has(job.id)) { continue; }
          seenIds.add(job.id);
          jobs.push(job);
        }
      } catch (error) {
        this.log('❌ Error extracting job from container:', error);
      }
    }
    
    this.log(`✅ Successfully extracted ${jobs.length} jobs from current page`);
    return jobs;
  }

  /**
   * Extract jobs from a specific page number
   */
  private async extractJobsFromPage(pageNumber: number): Promise<JobindexJobListing[]> {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('page', pageNumber.toString());

    const pageUrl = currentUrl.toString();
    this.log(`🔍 Fetching page ${pageNumber}: ${pageUrl}`);

    // Some pages render listings via scripts; use an offscreen iframe to get the fully rendered HTML
    try {
      const doc = await this.loadDocumentInIframe(pageUrl, 8000);
      if (doc) {
        return await this.extractJobsFromDocument(doc);
      }
    } catch (e) {
      this.log(`❌ Failed to load page in iframe ${pageNumber}:`, e);
    }

    // Fallback to fetch/parse (server-rendered pages)
    try {
      const response = await fetch(pageUrl, { credentials: 'include' });
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      return await this.extractJobsFromDocument(doc);
    } catch (e) {
      this.log(`❌ Failed to fetch page ${pageNumber}:`, e);
      return [];
    }
  }

  /**
   * Extract jobs from a provided Document (used for fetched pages)
   */
  private async extractJobsFromDocument(doc: Document): Promise<JobindexJobListing[]> {
    // Find all potential job containers and filter
    const allContainers = Array.from(doc.querySelectorAll('[data-tid]')) as HTMLElement[];
    this.log(`📋 [page fetch] Found ${allContainers.length} job containers`);

    const jobs: JobindexJobListing[] = [];
    const seenIds = new Set<string>();

    for (const container of allContainers) {
      try {
        const hasJobLink = !!(container.querySelector('a.seejobdesktop, a.btn-primary, h4 a, h3 a'));
        if (!hasJobLink) { continue; }

        const job = await this.extractJobFromContainer(container as HTMLElement);
        if (job) {
          if (seenIds.has(job.id)) { continue; }
          seenIds.add(job.id);
          jobs.push(job);
        }
      } catch (error) {
        this.log('❌ Error extracting job from fetched page container:', error);
      }
    }

    this.log(`✅ [page fetch] Extracted ${jobs.length} jobs from fetched page`);
    return jobs;
  }

  /**
   * Load a URL into an offscreen iframe and return its Document when loaded
   */
  private loadDocumentInIframe(url: string, timeoutMs: number = 8000): Promise<Document | null> {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.src = url;

      const cleanup = () => {
        try { iframe.remove(); } catch {}
      };

      const onLoad = () => {
        try {
          const doc = iframe.contentDocument || iframe.ownerDocument;
          resolve(doc as Document);
        } catch {
          resolve(null);
        } finally {
          cleanup();
        }
      };

      const to = setTimeout(() => {
        resolve(null);
        cleanup();
      }, timeoutMs);

      iframe.addEventListener('load', () => {
        clearTimeout(to);
        onLoad();
      });

      document.body.appendChild(iframe);
    });
  }

  /**
   * Extract job data from a single job container
   */
  private async extractJobFromContainer(container: HTMLElement): Promise<JobindexJobListing | null> {
    try {
      // Extract job ID
      const jobId = container.getAttribute('data-tid');
      if (!jobId) {
        this.log('❌ No data-tid found on job container');
        return null;
      }

      // Extract title (fallbacks)
      let titleElement = container.querySelector('h4 a');
      if (!titleElement) { titleElement = container.querySelector('h4'); }
      if (!titleElement) { titleElement = container.querySelector('h3 a'); }
      if (!titleElement) { titleElement = container.querySelector('h3'); }
      if (!titleElement) { titleElement = container.querySelector('[data-testid="job-title"]'); }
      if (!titleElement) {
        this.log(`❌ No title found for job ${jobId}`);
        return null;
      }
      const title = titleElement.textContent?.trim() || '';

      // Extract company - try multiple selectors
      let companyElement = container.querySelector('.jix-toolbar-top__company a');
      if (!companyElement) {
        companyElement = container.querySelector('.jix-toolbar-top__company');
      }
      if (!companyElement) {
        companyElement = container.querySelector('[data-testid="company-name"]');
      }
      if (!companyElement) {
        companyElement = container.querySelector('.company-name');
      }
      if (!companyElement) {
        // Try to find any element that might contain company name
        companyElement = container.querySelector('a[href*="/virksomhed/"]');
      }
      
      const company = companyElement?.textContent?.trim() || '';
      const companyUrl = companyElement?.getAttribute('href') || null;
      
      this.log(`🔍 Company extraction for job ${jobId}: "${company}" (selector: ${companyElement?.tagName || 'none'})`);

      // Extract location
      const locationElement = container.querySelector('.jix_robotjob--area, .jobad-element-area span');
      const location = locationElement?.textContent?.trim() || '';

      // Extract redirect URL
      const redirectElement = container.querySelector('a.seejobdesktop, a.btn-primary');
      let redirectUrl = '';
      if (redirectElement) {
        const dataClick = redirectElement.getAttribute('data-click');
        if (dataClick) {
          redirectUrl = `https://www.jobindex.dk${dataClick}`;
        } else {
          redirectUrl = redirectElement.getAttribute('href') || '';
        }
      }

      // Extract published date
      const dateElement = container.querySelector('time');
      const publishedDate = dateElement?.getAttribute('datetime') || '';

      const job: JobindexJobListing = {
        id: jobId,
        title,
        company,
        companyUrl,
        location,
        redirectUrl,
        finalUrl: null, // Will be resolved later
        publishedDate,
        description: null // Will be scraped from job detail page later
      };

      this.log(`✅ Extracted job: ${title} at ${company} (${jobId})`);
      return job;
    } catch (error) {
      this.log('❌ Error extracting job from container:', error);
      return null;
    }
  }

  /**
   * Process a list of jobs (resolve redirects and send to API)
   */
  private async processJobs(jobs: JobindexJobListing[]): Promise<BulkScrapeResult> {
    this.log(`🔄 Processing ${jobs.length} jobs (collect only, no API sends)...`);
    
    const result: BulkScrapeResult = {
      success: true,
      totalJobs: jobs.length,
      processedJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      errors: [],
      jobs: []
    };

    for (const job of jobs) {
      try {
        this.log(`🔄 Processing job: ${job.title} at ${job.company}`);
        
        // Do not resolve final URL at this stage; leave it empty for now
        job.finalUrl = null;

        // Validate minimal fields before storing
        if (!job.title) {
          result.failedJobs++;
          result.errors.push(`Missing required job title for ${job.id}`);
          this.log(`❌ Missing required job title`);
        } else {
          result.successfulJobs++;
          result.jobs.push(job);
          this.log(`✅ Collected job listing: ${job.title}${job.company ? ` at ${job.company}` : ' (no company found)'}`);
        }

        result.processedJobs++;
        
        // Small delay to be respectful
        await this.delay(400);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failedJobs++;
        result.errors.push(`Error processing ${job.title}: ${errorMessage}`);
        this.log(`❌ Error processing job ${job.title}:`, errorMessage);
      }
    }

    // Persist collected jobs for later detailed scraping
    try {
      await new Promise<void>((resolve) => {
        chrome.storage?.local?.set({ jobindexBulkJobs: result.jobs }, () => resolve());
      });
      this.log(`💾 Stored ${result.jobs.length} collected jobs in chrome.storage.local (jobindexBulkJobs)`);
      // Print full collected object for inspection
      this.log('🧾 Full collected jobs object:', JSON.stringify(result.jobs, null, 2));
    } catch (e) {
      this.log('⚠️ Failed to persist collected jobs to storage');
    }

    result.success = result.successfulJobs > 0 && result.failedJobs === 0;
    return result;
  }

  /**
   * Resolve redirect URL to get the final job URL
   */
  private async resolveRedirectUrl(redirectUrl: string): Promise<string | null> {
    try {
      if (!redirectUrl) return null;
      
      this.log(`🔗 Resolving redirect URL: ${redirectUrl}`);
      
      // For now, we'll return the redirect URL as-is
      // In a real implementation, you might want to follow the redirect
      // But this could be complex due to CORS restrictions
      return redirectUrl;
    } catch (error) {
      this.log('❌ Error resolving redirect URL:', error);
      return null;
    }
  }

  /**
   * Create multi-source job details from Jobindex job listing
   */
  private async createMultiSourceJobDetails(job: JobindexJobListing): Promise<MultiSourceJobDetails | null> {
    try {
      const platform = PlatformDetector.getPlatformByName('jobindex');
      if (!platform) {
        this.log('❌ Jobindex platform not found');
        return null;
      }

      const multiSourceJobDetails: MultiSourceJobDetails = {
        title: job.title,
        location: job.location,
        description: null, // Will be filled when we scrape the individual job page
        apply_url: job.finalUrl || job.redirectUrl,
        posted_date: job.publishedDate,
        skills: [], // Will be filled when we scrape the individual job page
        company: job.company,
        company_id: null, // Will be resolved by API
        source_id: platform.id,
        source_job_id: job.id,
        source_url: job.finalUrl || job.redirectUrl,
        applicants: null,
        work_type: null
      };

      return multiSourceJobDetails;
    } catch (error) {
      this.log('❌ Error creating multi-source job details:', error);
      return null;
    }
  }

  /**
   * Utility method to add delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Class is already exported above
