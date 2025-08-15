// =============================================================================
// API CONFIGURATION - Secure environment configuration
// =============================================================================
// These placeholders will be replaced by the build process with actual values
const API_BASE_URL = 'PLACEHOLDER_API_BASE_URL';
const API_KEY = 'PLACEHOLDER_API_KEY';
// =============================================================================
// DATA INTERFACES
// =============================================================================

export interface JobData {
  jobId: string;
  title: string;
  company: string;
  location: string;
  description?: string;
  postedDate?: string;
  url: string;
  salary?: string;
  employmentType?: string;
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  exists?: boolean;
}

class ApiClient {
  private log(message: string, ...args: any[]) {
    console.log(`[LINKEDIN_SCRAPER_API] ${message}`, ...args);
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      this.log(`Making request to: ${url}`);
      this.log(`Request headers:`, {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        ...options.headers,
      });
      this.log(`Request body:`, options.body || 'No body');
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
          ...options.headers,
        },
        ...options,
      });

      this.log(`Response status: ${response.status} ${response.statusText}`);
      
      // Log response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      this.log(`Response headers:`, responseHeaders);

      // Try to read response body regardless of status
      let responseText = '';
      let responseData: any = null;
      try {
        responseText = await response.text();
        this.log(`Response body (text):`, responseText);
        
        if (responseText) {
          try {
            responseData = JSON.parse(responseText);
            this.log(`Response body (parsed):`, responseData);
          } catch (parseError) {
            this.log(`Failed to parse response as JSON:`, parseError);
          }
        }
      } catch (readError) {
        this.log(`Failed to read response body:`, readError);
      }

      if (!response.ok) {
        const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        const detailedError = responseData ? 
          `${errorMessage} - ${JSON.stringify(responseData)}` : 
          `${errorMessage} - ${responseText || 'No response body'}`;
        
        this.log(`Request failed with detailed error:`, detailedError);
        
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
      this.log(`Request failed with exception:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Extract LinkedIn username from profile URL
  private extractLinkedInUsername(profileUrl: string): string {
    const regex = /\/in\/([^/?]+)/;
    const match = regex.exec(profileUrl);
    return match ? match[1] : '';
  }

  // Check if a profile already exists
  async checkProfileExists(profileUrl: string): Promise<boolean> {
    const username = this.extractLinkedInUsername(profileUrl);
    if (!username) return false;
    
    try {
      const response = await this.makeRequest<any>(`/linkedin-profile/users/${username}`);
      return response.success && response.data;
    } catch (error) {
      this.log('Error checking profile existence:', error);
      return false;
    }
  }

  // Send profile data to API using PUT method as shown in your PHP script
  async sendProfileData(profileData: ProfileData): Promise<ApiResponse<ProfileData>> {
    const username = this.extractLinkedInUsername(profileData.linkedin_url);
    if (!username) {
      return {
        success: false,
        message: 'Could not extract LinkedIn username from URL'
      };
    }

    // Log the profile data structure for debugging
    this.log('Profile data being sent:', JSON.stringify(profileData, null, 2));
    
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
      this.log('Validation errors found:', validationErrors);
      return {
        success: false,
        message: `Validation errors: ${validationErrors.join(', ')}`
      };
    }

    this.log('Profile data validation passed, sending to API...');

    return this.makeRequest<ProfileData>(`/linkedin-profile/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // Get profile data from API
  async getProfileData(profileUrl: string): Promise<ApiResponse<ProfileData>> {
    const username = this.extractLinkedInUsername(profileUrl);
    if (!username) {
      return {
        success: false,
        message: 'Could not extract LinkedIn username from URL'
      };
    }

    return this.makeRequest<ProfileData>(`/linkedin-profile/users/${username}`);
  }

  // ============================================================================
  // JOB-RELATED METHODS (for future development - keep for jobs feature)
  // ============================================================================

  // Check if a job already exists (future jobs API)
  async checkJobExists(jobId: string): Promise<boolean> {
    const response = await this.makeRequest<{ exists: boolean }>(`/jobs/seen/${jobId}`);
    return response.data?.exists || false;
  }

  // Send new job data (future jobs API)
  async sendJobData(jobData: JobData): Promise<ApiResponse<JobData>> {
    return this.makeRequest<JobData>('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  // Get recent jobs (for background worker - future jobs API)
  async getRecentJobs(limit: number = 10): Promise<ApiResponse<JobData[]>> {
    return this.makeRequest<JobData[]>(`/jobs/recent?limit=${limit}`);
  }

  // ============================================================================
  // PROFILE-RELATED METHODS (current implementation for your API)
  // ============================================================================
}

export const apiClient = new ApiClient();
