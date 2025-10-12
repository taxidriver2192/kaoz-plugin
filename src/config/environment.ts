// Environment configuration for the LinkedIn Scraper Chrome Extension
// Simplified single environment configuration

// API configuration - values will be injected by build script
const API_CONFIG = {
  API_BASE_URL: 'PLACEHOLDER_API_BASE_URL',
  API_KEY: 'PLACEHOLDER_API_KEY'
};

// Get API configuration
export async function getCurrentApiConfig() {
  return API_CONFIG;
}

export const CONFIG = {
  // API Configuration - will be dynamically loaded
  API: {
    BASE_URL: 'PLACEHOLDER_API_BASE_URL', // Will be replaced during build
    API_KEY: 'PLACEHOLDER_API_KEY', // Will be replaced during build
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
export async function validateConfig(): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];
  const apiConfig = await getCurrentApiConfig();
  
  if (!apiConfig.API_BASE_URL) {
    errors.push('API BASE_URL is not configured properly');
  }
  
  if (!apiConfig.API_KEY) {
    errors.push('API_KEY is not configured properly');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Function to get validated configuration
export async function getValidatedConfig() {
  const validation = await validateConfig();
  if (!validation.isValid) {
    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
  }
  
  const apiConfig = await getCurrentApiConfig();
  
  return {
    apiKey: apiConfig.API_KEY,
    apiBaseUrl: apiConfig.API_BASE_URL,
    debugMode: CONFIG.DEBUG.ENABLE_VERBOSE_LOGGING,
    logLevel: CONFIG.DEBUG.LOG_API_REQUESTS ? 'verbose' : 'error'
  };
}