// =============================================================================
// API CONFIGURATION - Simplified single environment configuration
// =============================================================================
// API configuration - values will be injected by build script
const API_CONFIG = {
  API_BASE_URL: 'PLACEHOLDER_API_BASE_URL',
  API_KEY: 'PLACEHOLDER_API_KEY'
};

// Get API configuration
async function getCurrentApiConfig() {
  return API_CONFIG;
}
// =============================================================================
// DATA INTERFACES
// =============================================================================

export interface JobDetails {
  source_id: number; // Platform source ID (1 = LinkedIn, 2 = Jobindex)
  source_job_id: string; // Job ID from the source platform
  title: string | null;
  location: string | null;
  description: string | null;
  apply_url: string | null;
  posted_date: string | null; // Format: YYYY-MM-DD
  applicants: number | null;
  skills: string[];
  company: string | null;
  company_id: number | null; // New field for company ID
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

export interface JobIdsResponse {
  success: boolean;
  count: number;
  job_ids: Array<{
    source_id: number;
    source_job_id: string;
  }>;
}

// -----------------------------------------------------------------------------
// COMPANY INTERFACES
// -----------------------------------------------------------------------------
export interface CompanyCreateRequest {
  name: string;
  image_url: string;
}

export interface CompanyNamesResponse {
  success: boolean;
  count: number;
  company_names: string[];
}

export interface CompanyRecord {
  company_id: number;
  name: string;
  vat?: string | null;
  status?: string | null;
  address?: string | null;
  zipcode?: string | null;
  city?: string | null;
  website?: string | null;
  email?: string | null;
  employees?: number | null;
  industrycode?: string | null;
  industrydesc?: string | null;
  companytype?: string | null;
  image_url?: string | null;
  full_image_url?: string | null;
}

export interface CompanyExistsResponse {
  exists: boolean;
  company?: CompanyRecord;
}

export interface CompanyCreateResponse {
  success: boolean;
  message?: string;
  company?: CompanyRecord;
}

class ApiClient {
  private log(message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [LINKEDIN_SCRAPER_API] ${message}`, ...args);
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Get current API configuration
      const apiConfig = await getCurrentApiConfig();
      const url = `${apiConfig.API_BASE_URL}${endpoint}`;
      
      this.log(`Making request to: ${url}`);
      this.log(`Request headers:`, {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': apiConfig.API_KEY,
        ...options.headers,
      });
      this.log(`Request body:`, options.body || 'No body');
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-Key': apiConfig.API_KEY,
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
        
        // Extract meaningful error message from Laravel API response
        let detailedError = errorMessage;
        if (responseData) {
          if (responseData.message) {
            detailedError = responseData.message;
          } else if (responseData.error) {
            detailedError = responseData.error;
          } else if (responseData.errors && typeof responseData.errors === 'object') {
            // Handle Laravel validation errors
            const validationErrors = Object.values(responseData.errors).flat();
            detailedError = `Validation failed: ${validationErrors.join(', ')}`;
          } else {
            detailedError = `${errorMessage} - ${JSON.stringify(responseData)}`;
          }
        } else {
          detailedError = `${errorMessage} - ${responseText || 'No response body'}`;
        }
        
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
  // ==========================================================================

  // Get all existing job IDs from the database
  // Optional: filter by source_id (1 = LinkedIn, 2 = Jobindex)
  async getExistingJobIds(sourceId?: number): Promise<Set<string>> {
    try {
      const response = await this.makeRequest<JobIdsResponse>('/jobs/ids');
      
      if (response.success && response.data?.job_ids) {
        // Filter by source_id if provided, then extract source_job_id
        let jobIds = response.data.job_ids;
        
        if (sourceId !== undefined) {
          jobIds = jobIds.filter(job => job.source_id === sourceId);
          this.log(`Filtered to ${jobIds.length} job IDs for source_id ${sourceId}`);
        }
        
        const sourceJobIds = jobIds.map(job => job.source_job_id);
        this.log(`Fetched ${sourceJobIds.length} existing job IDs from database`);
        return new Set(sourceJobIds);
      }
      
      this.log('No existing job IDs found or API call failed');
      return new Set<string>();
    } catch (error) {
      this.log('Error fetching existing job IDs:', error);
      return new Set<string>();
    }
  }

  // Check if a job already exists (future jobs API)
  async checkJobExists(jobId: string): Promise<boolean> {
    const response = await this.makeRequest<{ exists: boolean }>(`/jobs/seen/${jobId}`);
    return response.data?.exists || false;
  }

  // Send new job data (future jobs API)
  async sendJobData(jobData: JobDetails): Promise<ApiResponse<JobDetails>> {
    return this.makeRequest<JobDetails>('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  // Get recent jobs (for background worker - future jobs API)
  async getRecentJobs(limit: number = 10): Promise<ApiResponse<JobDetails[]>> {
    return this.makeRequest<JobDetails[]>(`/jobs/recent?limit=${limit}`);
  }

  // ----------------------------------------------------------------------------
  // COMPANY METHODS
  // ----------------------------------------------------------------------------
  async getCompanyNames(): Promise<ApiResponse<CompanyNamesResponse>> {
    return this.makeRequest<CompanyNamesResponse>('/companies/names');
  }

  async checkCompanyExists(name: string): Promise<ApiResponse<CompanyExistsResponse>> {
    // First try documented POST JSON
    const primary = await this.makeRequest<CompanyExistsResponse>('/companies/exists', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    // If 405 Method Not Allowed or other failure, try a GET fallback with query param
    if (!primary.success && (primary.message?.includes('HTTP 405') || primary.message?.includes('Method Not Allowed'))) {
      this.log('POST /companies/exists returned 405. Trying GET fallback with query parameter...');
      const query = encodeURIComponent(name);
      return this.makeRequest<CompanyExistsResponse>(`/companies/exists?name=${query}`, {
        method: 'GET',
      });
    }

    // Also try a form-encoded POST if generic failure persists (some servers expect form data)
    if (!primary.success && !primary.message?.includes('HTTP 405')) {
      try {
        this.log('Retrying /companies/exists with application/x-www-form-urlencoded...');
        const urlEncodedBody = new URLSearchParams({ name }).toString();
        return await this.makeRequest<CompanyExistsResponse>('/companies/exists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: urlEncodedBody,
        });
      } catch (e) {
        // Fall-through to return primary
      }
    }

    return primary;
  }

  async createCompany(payload: CompanyCreateRequest): Promise<ApiResponse<CompanyCreateResponse>> {
    return this.makeRequest<CompanyCreateResponse>('/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ============================================================================
  // PROFILE-RELATED METHODS (current implementation for your API)
  // ============================================================================
}

export const apiClient = new ApiClient();
