// Environment configuration for the LinkedIn Scraper Chrome Extension
// Environment toggle system - no more .env file needed!

// Environment configurations - values will be injected by build script
const ENVIRONMENTS = {
  DEV: {
    API_BASE_URL: 'PLACEHOLDER_DEV_API_BASE_URL',
    API_KEY: 'PLACEHOLDER_DEV_API_KEY'
  },
  PROD: {
    API_BASE_URL: 'PLACEHOLDER_PROD_API_BASE_URL',
    API_KEY: 'PLACEHOLDER_PROD_API_KEY'
  }
};

// Get current environment from Chrome storage (defaults to DEV)
async function getCurrentEnvironment(): Promise<keyof typeof ENVIRONMENTS> {
  try {
    const result = await chrome.storage.local.get(['environment']);
    return result.environment || 'DEV';
  } catch (error) {
    console.warn('Failed to get environment from storage, defaulting to DEV:', error);
    return 'DEV';
  }
}

// Get current API configuration
export async function getCurrentApiConfig() {
  const env = await getCurrentEnvironment();
  return ENVIRONMENTS[env];
}

// Set environment
export async function setEnvironment(env: keyof typeof ENVIRONMENTS) {
  try {
    await chrome.storage.local.set({ environment: env });
    console.log(`Environment switched to: ${env}`);
  } catch (error) {
    console.error('Failed to save environment:', error);
  }
}

// Get current environment name
export async function getCurrentEnvironmentName(): Promise<string> {
  return await getCurrentEnvironment();
}

export const CONFIG = {
  // API Configuration - will be dynamically loaded
  API: {
    BASE_URL: 'PLACEHOLDER_DEV_API_BASE_URL', // Default fallback
    API_KEY: 'PLACEHOLDER_DEV_API_KEY', // Default fallback
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