/**
 * Platform Detection Utility
 * Automatically detects which job platform the user is currently on
 */

export interface PlatformConfig {
  id: number;
  name: string;
  displayName: string;
  baseUrl: string;
  jobUrlPattern: string;
  companyUrlPattern?: string;
  rateLimit: number;
}

export interface DetectedPlatform {
  platform: PlatformConfig;
  jobId: string | null;
  companyId: string | null;
  isJobPage: boolean;
  isCompanyPage: boolean;
  isSearchPage: boolean;
}

export class PlatformDetector {
  private static readonly PLATFORMS: PlatformConfig[] = [
    {
      id: 1,
      name: 'linkedin',
      displayName: 'LinkedIn',
      baseUrl: 'https://www.linkedin.com',
      jobUrlPattern: 'https://www.linkedin.com/jobs/view/{id}',
      companyUrlPattern: 'https://www.linkedin.com/company/{id}',
      rateLimit: 100
    },
    {
      id: 2,
      name: 'jobindex',
      displayName: 'Jobindex.dk',
      baseUrl: 'https://www.jobindex.dk',
      jobUrlPattern: 'https://www.jobindex.dk/jobsoegning/stilling/{id}',
      rateLimit: 50
    }
  ];

  /**
   * Detect the current platform and extract relevant IDs
   */
  static detectCurrentPlatform(): DetectedPlatform | null {
    const currentUrl = window.location.href;
    const hostname = window.location.hostname;

    console.log(`[PLATFORM_DETECTOR] Checking URL: ${currentUrl}`);
    console.log(`[PLATFORM_DETECTOR] Hostname: ${hostname}`);

    // Find matching platform
    const platform = this.PLATFORMS.find(p => {
      const nameMatch = hostname.includes(p.name);
      const urlMatch = currentUrl.includes(p.baseUrl);
      console.log(`[PLATFORM_DETECTOR] Checking platform ${p.name}: nameMatch=${nameMatch}, urlMatch=${urlMatch}`);
      return nameMatch || urlMatch;
    });

    if (!platform) {
      console.log(`[PLATFORM_DETECTOR] No supported platform detected for: ${currentUrl}`);
      return null;
    }

    console.log(`[PLATFORM_DETECTOR] Detected platform: ${platform.displayName}`);

    // Extract IDs based on platform
    const jobId = this.extractJobId(currentUrl, platform);
    const companyId = this.extractCompanyId(currentUrl, platform);

    // Determine page type
    const isJobPage = this.isJobPage(currentUrl, platform);
    const isCompanyPage = this.isCompanyPage(currentUrl, platform);
    const isSearchPage = this.isSearchPage(currentUrl, platform);

    console.log(`[PLATFORM_DETECTOR] Page type detection: isJobPage=${isJobPage}, isCompanyPage=${isCompanyPage}, isSearchPage=${isSearchPage}`);
    console.log(`[PLATFORM_DETECTOR] Job ID: ${jobId}`);

    return {
      platform,
      jobId,
      companyId,
      isJobPage,
      isCompanyPage,
      isSearchPage
    };
  }

  /**
   * Extract job ID from URL based on platform
   */
  private static extractJobId(url: string, platform: PlatformConfig): string | null {
    switch (platform.name) {
      case 'linkedin':
        // LinkedIn: /jobs/view/123456 or ?currentJobId=123456
        const linkedinJobMatch = url.match(/\/jobs\/view\/(\d+)/) || 
                                url.match(/[?&]currentJobId=(\d+)/);
        return linkedinJobMatch ? linkedinJobMatch[1] : null;

      case 'jobindex':
        // Jobindex: /jobsoegning/stilling/12345 or /jobannonce/h12345/...
        const jobindexMatch = url.match(/\/jobsoegning\/stilling\/(\d+)/) || 
                             url.match(/\/jobannonce\/([^\/]+)/);
        return jobindexMatch ? jobindexMatch[1] : null;

      default:
        return null;
    }
  }

  /**
   * Extract company ID from URL based on platform
   */
  private static extractCompanyId(url: string, platform: PlatformConfig): string | null {
    switch (platform.name) {
      case 'linkedin':
        // LinkedIn: /company/company-name-123456
        const linkedinCompanyMatch = url.match(/\/company\/([^/?]+)/);
        return linkedinCompanyMatch ? linkedinCompanyMatch[1] : null;

      case 'jobindex':
        // Jobindex doesn't have separate company pages in the same way
        return null;

      default:
        return null;
    }
  }

  /**
   * Check if current page is a job detail page
   */
  private static isJobPage(url: string, platform: PlatformConfig): boolean {
    switch (platform.name) {
      case 'linkedin':
        return url.includes('/jobs/view/') || url.includes('currentJobId=');

      case 'jobindex':
        return url.includes('/jobsoegning/stilling/') || url.includes('/jobannonce/');

      default:
        return false;
    }
  }

  /**
   * Check if current page is a company page
   */
  private static isCompanyPage(url: string, platform: PlatformConfig): boolean {
    switch (platform.name) {
      case 'linkedin':
        // Detect company pages with jobs - these are scrapable
        return url.includes('/company/') && url.includes('/jobs/');

      case 'jobindex':
        // Jobindex doesn't have separate company pages
        return false;

      default:
        return false;
    }
  }

  /**
   * Check if current page is a search/listing page
   */
  private static isSearchPage(url: string, platform: PlatformConfig): boolean {
    switch (platform.name) {
      case 'linkedin':
        return url.includes('/jobs/search') || (url.includes('/jobs/') && !url.includes('/jobs/view/'));

      case 'jobindex':
        // Match /jobsoegning/ or /jobsoegning? (with or without trailing slash)
        return url.includes('/jobsoegning') && !url.includes('/stilling/') && !url.includes('/jobannonce/');

      default:
        return false;
    }
  }

  /**
   * Get platform configuration by name
   */
  static getPlatformByName(name: string): PlatformConfig | null {
    return this.PLATFORMS.find(p => p.name === name) || null;
  }

  /**
   * Get platform configuration by ID
   */
  static getPlatformById(id: number): PlatformConfig | null {
    return this.PLATFORMS.find(p => p.id === id) || null;
  }

  /**
   * Get all supported platforms
   */
  static getAllPlatforms(): PlatformConfig[] {
    return [...this.PLATFORMS];
  }

  /**
   * Check if current page supports scraping
   */
  static canScrapeCurrentPage(): boolean {
    const detected = this.detectCurrentPlatform();
    return detected !== null && (detected.isJobPage || detected.isSearchPage || detected.isCompanyPage);
  }

  /**
   * Check if current page supports bulk scraping
   */
  static canBulkScrapeCurrentPage(): boolean {
    const detected = this.detectCurrentPlatform();
    return detected !== null && detected.isSearchPage;
  }

  /**
   * Get the appropriate scraper class name for the current platform
   */
  static getScraperClassName(): string | null {
    const detected = this.detectCurrentPlatform();
    if (!detected) return null;

    switch (detected.platform.name) {
      case 'linkedin':
        return 'LinkedInJobScraper';
      case 'jobindex':
        return 'JobindexJobScraper';
      default:
        return null;
    }
  }
}
