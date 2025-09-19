// Environment configuration for the LinkedIn Scraper Chrome Extension
// Update these values according to your environment

export const CONFIG = {
  // API Configuration
  API: {
    BASE_URL: 'https://laravel-job-dashboard.test/api', // Will be replaced by build script
    API_KEY: 'PLACEHOLDER_API_KEY', // Will be replaced by build script
  },
  
  // LinkedIn Configuration
  LINKEDIN: {
    JOB_URL_PREFIX: 'https://www.linkedin.com/jobs/view/',
    PROFILE_URL_PREFIX: 'https://www.linkedin.com/in/',
  },
  
  // Scraping Configuration
  SCRAPING: {
    DELAY_BETWEEN_CHECKS: 2000, // 2 seconds delay between job checks
    TAB_LOAD_TIMEOUT: 10000, // 10 seconds timeout for tab loading
    MAX_RETRIES: 3, // Maximum number of retries for failed requests
  },
  
  // Debug Configuration
  DEBUG: {
    ENABLE_VERBOSE_LOGGING: true, // Set to false in production
    LOG_API_REQUESTS: true, // Log all API requests
    LOG_SCRAPING_ACTIONS: true, // Log scraping actions
  }
};

// Validation function to check if configuration is properly set
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!CONFIG.API.BASE_URL || CONFIG.API.BASE_URL === 'https://laravel-job-dashboard.test/api') {
    errors.push('API BASE_URL is not configured properly');
  }
  
  if (!CONFIG.API.API_KEY || CONFIG.API.API_KEY === 'PLACEHOLDER_API_KEY') {
    errors.push('API_KEY is not configured properly');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Function to get validated configuration
export function getValidatedConfig() {
  const validation = validateConfig();
  if (!validation.isValid) {
    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
  }
  
  return {
    apiKey: CONFIG.API.API_KEY,
    apiBaseUrl: CONFIG.API.BASE_URL,
    debugMode: CONFIG.DEBUG.ENABLE_VERBOSE_LOGGING,
    logLevel: CONFIG.DEBUG.LOG_API_REQUESTS ? 'verbose' : 'error'
  };
}