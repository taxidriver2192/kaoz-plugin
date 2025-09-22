/**
 * API Client Module
 * Handles all API communication with proper environment configuration
 */

import { getValidatedConfig } from './environment.js';

export interface PositionItem {
  title: string;
  company_name: string;
  summary?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  skills?: string[];
}

export interface EducationItem {
  school_name: string;
  summary: string;
  degree: string;
  start_year?: number;
  end_year?: number;
  skills?: string[];
}

export interface ProfileData {
  linkedin_url: string;
  headline: string;
  summary?: string;
  location_city: string;
  avatar?: string;
  positions: PositionItem[];
  educations: EducationItem[];
  skill_frequencies: { [key: string]: number };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export class ApiClient {
  private log(message: string, ...args: any[]) {
    console.info(`[LINKEDIN_SCRAPER_API] ${message}`, ...args);
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Get current configuration dynamically
      const config = await getValidatedConfig();
      const url = `${config.apiBaseUrl}${endpoint}`;
      
      this.log(`INFO: Making request to: ${url}`);
      this.log(`INFO: Request headers:`, {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        ...options.headers,
      });
      this.log(`INFO: Request body:`, options.body || 'No body');
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
          ...options.headers,
        },
        ...options,
      });

      this.log(`INFO: Response status: ${response.status} ${response.statusText}`);
      
      // Log response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      this.log(`INFO: Response headers:`, responseHeaders);

      // Try to read response body regardless of status
      let responseText = '';
      let responseData: any = null;
      try {
        responseText = await response.text();
        this.log(`INFO: Response body (text):`, responseText);
        
        if (responseText) {
          try {
            responseData = JSON.parse(responseText);
            this.log(`INFO: Response body (parsed):`, responseData);
          } catch (parseError) {
            this.log(`ERROR: Failed to parse response as JSON:`, parseError);
          }
        }
      } catch (readError) {
        this.log(`ERROR: Failed to read response body:`, readError);
      }

      if (!response.ok) {
        const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        const detailedError = responseData ? 
          `${errorMessage} - ${JSON.stringify(responseData)}` : 
          `${errorMessage} - ${responseText || 'No response body'}`;
        
        this.log(`ERROR: Request failed with detailed error:`, detailedError);
        
        return {
          success: false,
          message: detailedError,
          data: responseData as T | undefined
        };
      }

      return {
        success: true,
        data: responseData as T
      };
    } catch (error) {
      this.log(`ERROR: Request failed with exception:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  extractLinkedInUsername(profileUrl: string): string {
    const regex = /\/in\/([^/?]+)/;
    const match = regex.exec(profileUrl);
    const username = match ? match[1] : '';
    this.log(`INFO: Extracted username from URL ${profileUrl}: ${username}`);
    return username;
  }

  async checkProfileExists(profileUrl: string): Promise<boolean> {
    this.log(`INFO: Checking if profile exists for URL: ${profileUrl}`);
    const username = this.extractLinkedInUsername(profileUrl);
    if (!username) {
      this.log(`ERROR: Could not extract username from URL: ${profileUrl}`);
      return false;
    }
    
    try {
      const response = await this.makeRequest<any>(`/linkedin-profile/users/${username}`);
      const exists = response.success && response.data;
      this.log(`INFO: Profile exists check result: ${exists}`);
      return exists;
    } catch (error) {
      this.log('ERROR: Error checking profile existence:', error);
      return false;
    }
  }

  async sendProfileDataToAPI(profileData: ProfileData): Promise<ApiResponse<ProfileData>> {
    this.log(`INFO: Sending profile data for URL: ${profileData.linkedin_url}`);
    
    // Log the profile data structure for debugging
    this.log('INFO: Profile data being sent:', JSON.stringify(profileData, null, 2));
    
    // Validate required fields
    const validationErrors: string[] = [];
    if (!profileData.linkedin_url) validationErrors.push('linkedin_url is required');
    if (!profileData.headline) validationErrors.push('headline is required');
    if (!profileData.location_city) validationErrors.push('location_city is required');
    
    // Validate positions array
    if (!Array.isArray(profileData.positions)) {
      validationErrors.push('positions must be an array');
    } else {
      profileData.positions.forEach((position, index) => {
        if (!position.title) validationErrors.push(`positions[${index}].title is required`);
        if (!position.company_name) validationErrors.push(`positions[${index}].company_name is required`);
      });
    }
    
    // Validate educations array
    if (!Array.isArray(profileData.educations)) {
      validationErrors.push('educations must be an array');
    } else {
      profileData.educations.forEach((education, index) => {
        if (!education.school_name) validationErrors.push(`educations[${index}].school_name is required`);
        if (!education.degree) validationErrors.push(`educations[${index}].degree is required`);
        if (!education.summary) validationErrors.push(`educations[${index}].summary is required`);
      });
    }
    
    // Validate skill_frequencies object
    if (!profileData.skill_frequencies || typeof profileData.skill_frequencies !== 'object') {
      validationErrors.push('skill_frequencies must be an object');
    }
    
    if (validationErrors.length > 0) {
      this.log('ERROR: Validation errors found:', validationErrors);
      return {
        success: false,
        message: `Validation errors: ${validationErrors.join(', ')}`
      };
    }

    this.log('INFO: Profile data validation passed, sending to API...');
    
    const username = this.extractLinkedInUsername(profileData.linkedin_url);
    if (!username) {
      const error = 'Could not extract LinkedIn username from URL';
      this.log(`ERROR: ${error}`);
      return {
        success: false,
        message: error
      };
    }

    this.log(`INFO: Sending PUT request for username: ${username}`);
    return this.makeRequest<ProfileData>(`/linkedin-profile/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
