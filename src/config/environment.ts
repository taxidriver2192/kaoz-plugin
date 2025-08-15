/**
 * Environment Configuration Module
 * Handles loading and validating environment variables for the extension
 */

export interface ExtensionConfig {
  apiKey: string;
  apiBaseUrl: string;
  debugMode: boolean;
  logLevel: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ExtensionConfig = {
  apiKey: '',
  apiBaseUrl: 'https://kaoz.dk/api',
  debugMode: false,
  logLevel: 'error'
};

/**
 * Runtime configuration - will be populated by injected values
 */
let runtimeConfig: ExtensionConfig | null = null;

/**
 * Initialize configuration with injected values
 * This function should be called by the build system's injected code
 */
export function initializeConfig(config: Partial<ExtensionConfig>): void {
  runtimeConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
}

/**
 * Get the current environment configuration
 */
export function getConfig(): ExtensionConfig {
  if (runtimeConfig) {
    return runtimeConfig;
  }

  // Fallback to default config if no runtime config is available
  return DEFAULT_CONFIG;
}

/**
 * Validate that required configuration is present
 */
export function validateConfig(config: ExtensionConfig): boolean {
  if (!config.apiKey || config.apiKey.trim() === '') {
    console.error('API_KEY is required but not provided');
    return false;
  }

  if (!config.apiBaseUrl || config.apiBaseUrl.trim() === '') {
    console.error('API_BASE_URL is required but not provided');
    return false;
  }

  return true;
}

/**
 * Get validated configuration or throw error
 */
export function getValidatedConfig(): ExtensionConfig {
  const config = getConfig();
  
  if (!validateConfig(config)) {
    throw new Error('Invalid extension configuration. Please check your environment settings.');
  }

  return config;
}
