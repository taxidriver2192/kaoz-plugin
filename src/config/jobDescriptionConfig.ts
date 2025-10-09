/**
 * Job Description Scraping Configuration
 * Platform-specific selectors for extracting job descriptions
 */

export interface PlatformConfig {
  name: string;
  displayName: string;
  sourceId: number; // Maps to job_sources.id in Laravel database
  urlPatterns: string[];
  descriptionSelectors: string[];
  waitTime?: number;
  enabled: boolean;
}

export const JOB_DESCRIPTION_PLATFORMS: Record<string, PlatformConfig> = {
  'jobindex.dk': {
    name: 'jobindex.dk',
    displayName: 'Jobindex.dk',
    sourceId: 2,
    urlPatterns: ['www.jobindex.dk'],
    descriptionSelectors: [
      '.jobcontent',
      '.read-more-container .read-more',
      '.jobtext-jobad__body'
    ],
    waitTime: 3000,
    // virker
    enabled: true
  },
  
  'hr-manager.net': {
    name: 'hr-manager.net',
    displayName: 'HR Manager',
    sourceId: 4,
    urlPatterns: ['candidate.hr-manager.net'],
    descriptionSelectors: [
      '.AdContentContainer'
    ],
    waitTime: 3000,
    // virker
    enabled: false
  },
  
  'thehub.io': {
    name: 'thehub.io',
    displayName: 'The Hub',
    sourceId: 3,
    urlPatterns: ['thehub.io'],
    descriptionSelectors: [
      '.text-block__content--default'
    ],
    waitTime: 3000,
    // virker 
    enabled: true
  },

  'oraclecloud.com': {
    name: 'oraclecloud.com',
    displayName: 'Oracle Cloud',
    sourceId: 5,
    urlPatterns: ['efzu.fa.em2.oraclecloud.com'],
    descriptionSelectors: [
      '.job-details__description-content'
    ],
    waitTime: 3000,
    // virker
    enabled: true
  },

  'emply.com': {
    name: 'emply.com',
    displayName: 'Emply',
    sourceId: 6,
    urlPatterns: ['career.emply.com'],
    descriptionSelectors: [
      '.csa_jobadText'
    ],
    waitTime: 3000,
    // virker
    enabled: true
  },

  'myworkdayjobs.com': {
    name: 'myworkdayjobs.com',
    displayName: 'Workday',
    sourceId: 7,
    urlPatterns: ['myworkdayjobs.com'],
    descriptionSelectors: [
      '[data-automation-id="jobPostingDescription"]'
    ],
    waitTime: 3000,
    // virker
    enabled: true
  },

  'emagine.org': {
    name: 'emagine.org',
    displayName: 'Emagine',
    sourceId: 8,
    urlPatterns: ['portal.emagine.org'],
    descriptionSelectors: [
      '.job-description',
      '.job-content',
      '.description',
      '.content',
      '.job-details',
      '[data-test="job-description"]',
      '.job-text',
      '.job-body',
      '.job-announcement',
      '.vacancy-description',
      '.job-summary'
    ],
    waitTime: 3000,
    // virker ikke den er anderledes.
    enabled: false
  },

  'talent-soft.com': {
    name: 'talent-soft.com',
    displayName: 'Talent Soft',
    sourceId: 9,
    urlPatterns: ['jndata-career.talent-soft.com'],
    descriptionSelectors: [
      '.card-body'
    ],
    waitTime: 3000,
    // virker
    enabled: true
  },

  'politi.dk': {
    name: 'politi.dk',
    displayName: 'Politi.dk',
    sourceId: 10,
    urlPatterns: ['job.politi.dk'],
    descriptionSelectors: [
      '.rtltextaligneligible'
    ],
    waitTime: 3000,
    // virker
    enabled: true
  },    

  'systematic.com': {
    name: 'systematic.com',
    displayName: 'Systematic',
    sourceId: 11,
    urlPatterns: ['jobs.systematic.com'],
    descriptionSelectors: [
      '.rtltextaligneligible'
    ],
    waitTime: 3000,
    // virker
    enabled: true
  },

  'tryg.com': {
    name: 'tryg.com',
    displayName: 'Tryg',
    sourceId: 12,
    urlPatterns: ['careers.tryg.com'],
    descriptionSelectors: [
      '.rtltextaligneligible'
    ],
    waitTime: 3000,
    // virker
    enabled: true
  },

  'lego.com': {
    name: 'lego.com',
    displayName: 'LEGO',
    sourceId: 13,
    urlPatterns: ['www.lego.com'],
    descriptionSelectors: [
      '.c-content-block__text',
      '.u-type-base',
      '.c-content'
    ],
    waitTime: 3000,
    enabled: true
  }
};

/**
 * Detect platform from URL (only returns enabled platforms)
 */
export function detectPlatformFromUrl(url: string): PlatformConfig | null {
  for (const [key, config] of Object.entries(JOB_DESCRIPTION_PLATFORMS)) {
    // Only check enabled platforms
    if (!config.enabled) {
      continue;
    }
    
    for (const pattern of config.urlPatterns) {
      if (url.includes(pattern)) {
        return config;
      }
    }
  }
  return null;
}

/**
 * Get list of enabled platforms
 */
export function getEnabledPlatforms(): PlatformConfig[] {
  return Object.values(JOB_DESCRIPTION_PLATFORMS).filter(config => config.enabled);
}

/**
 * Get list of disabled platforms
 */
export function getDisabledPlatforms(): PlatformConfig[] {
  return Object.values(JOB_DESCRIPTION_PLATFORMS).filter(config => !config.enabled);
}
