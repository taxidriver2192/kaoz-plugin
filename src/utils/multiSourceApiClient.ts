/**
 * Multi-Source API Client
 * Handles API communication for multiple job platforms with proper source detection
 */

import { getValidatedConfig } from '../config/environment.js';
import { PlatformDetector } from './platformDetector.js';

export interface MultiSourceJobDetails {
  // Core job data
  title: string;
  location: string;
  description: string;
  apply_url: string;
  posted_date: string;
  skills: string[];
  company: string;
  company_id: number | null;

  // Platform-specific data
  source_id: number;
  source_job_id: string;
  source_url: string;

  // Optional fields
  applicants?: number | null;
}

export interface CompanyExistsResponse {
  success: boolean;
  data?: {
    exists: boolean;
    company?: {
      company_id: number;
      name: string;
    };
  };
  message?: string;
}

export interface CompanyCreateResponse {
  success: boolean;
  data?: {
    company: {
      company_id: number;
      name: string;
    };
  };
  message?: string;
}

export interface JobCreateResponse {
  success: boolean;
  data?: any;
  message?: string;
}

export class MultiSourceApiClient {
  private log(message: string, ...args: any[]) {
    console.info(`[MULTI_SOURCE_API] ${message}`, ...args);
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; message?: string }> {
    try {
      const config = await getValidatedConfig();
      const url = `${config.apiBaseUrl}${endpoint}`;
      
      // Build headers
      const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        ...options.headers,
      };
      
      this.log(`\n${'='.repeat(80)}`);
      this.log(`📤 API REQUEST`);
      this.log(`${'='.repeat(80)}`);
      this.log(`🔗 URL: ${options.method || 'GET'} ${url}`);
      this.log(`📋 Headers:`);
      Object.entries(headers).forEach(([key, value]) => {
        // Mask API key for security
        const displayValue = key === 'X-API-Key' ? `${String(value).substring(0, 10)}...` : value;
        this.log(`   ${key}: ${displayValue}`);
      });
      
      if (options.body) {
        this.log(`📦 Request Body:`);
        try {
          const bodyObj = JSON.parse(options.body as string);
          this.log(JSON.stringify(bodyObj, null, 2));
        } catch {
          this.log(options.body);
        }
      }
      
      const response = await fetch(url, {
        headers,
        ...options,
      });

      this.log(`\n${'='.repeat(80)}`);
      this.log(`📥 API RESPONSE`);
      this.log(`${'='.repeat(80)}`);
      this.log(`📊 Status: ${response.status} ${response.statusText}`);
      this.log(`📋 Response Headers:`);
      response.headers.forEach((value, key) => {
        this.log(`   ${key}: ${value}`);
      });

      const responseText = await response.text();
      let responseData: any = null;
      
      this.log(`📦 Response Body (raw text, ${responseText.length} chars):`);
      
      if (responseText) {
        try {
          responseData = JSON.parse(responseText);
          this.log(`📦 Response Body (parsed JSON):`);
          this.log(JSON.stringify(responseData, null, 2));
        } catch (parseError) {
          this.log(`⚠️ Failed to parse response as JSON:`, parseError);
          this.log(`📄 Raw response text: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);
        }
      } else {
        this.log(`📦 Response Body: (empty)`);
      }

      if (!response.ok) {
        const errorMessage = responseData?.message || responseData?.error || responseText || 'Unknown error';
        this.log(`\n❌ Request failed: ${response.status} - ${errorMessage}`);
        this.log(`${'='.repeat(80)}\n`);
        return {
          success: false,
          message: `HTTP ${response.status}: ${errorMessage}`,
          data: responseData
        };
      }

      this.log(`\n✅ Request successful`);
      this.log(`${'='.repeat(80)}\n`);
      return {
        success: true,
        data: responseData
      };
    } catch (error) {
      this.log(`\n💥 Request failed with exception:`);
      this.log(error);
      this.log(`${'='.repeat(80)}\n`);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if a company exists in the database
   */
  async checkCompanyExists(companyName: string): Promise<CompanyExistsResponse> {
    this.log(`Checking if company exists: ${companyName}`);
    
    const response = await this.makeRequest<any>('/companies/exists', {
      method: 'POST',
      body: JSON.stringify({ name: companyName })
    });

    return {
      success: response.success,
      data: response.data,
      message: response.message
    };
  }

  /**
   * Create a new company
   */
  async createCompany(companyData: { name: string; image_url?: string }): Promise<CompanyCreateResponse> {
    this.log(`Creating company: ${companyData.name}`);
    
    const response = await this.makeRequest<any>('/companies', {
      method: 'POST',
      body: JSON.stringify(companyData)
    });

    return {
      success: response.success,
      data: response.data,
      message: response.message
    };
  }

  /**
   * Send job data to API with automatic source detection
   */
  async sendJobData(jobDetails: MultiSourceJobDetails): Promise<JobCreateResponse> {
    this.log(`Sending job data for ${jobDetails.title} at ${jobDetails.company}`);
    
    // Validate required fields
    if (!jobDetails.source_id || !jobDetails.source_job_id || !jobDetails.source_url) {
      return {
        success: false,
        message: 'Missing required source information (source_id, source_job_id, source_url)'
      };
    }

    if (!jobDetails.title || !jobDetails.company) {
      return {
        success: false,
        message: 'Missing required job information (title, company)'
      };
    }

    // Prepare payload for API
    const payload = {
      source_id: jobDetails.source_id,
      source_job_id: jobDetails.source_job_id,
      source_url: jobDetails.source_url,
      title: jobDetails.title,
      location: jobDetails.location,
      description: jobDetails.description,
      apply_url: jobDetails.apply_url,
      posted_date: jobDetails.posted_date,
      skills: jobDetails.skills,
      company: jobDetails.company,
      company_id: jobDetails.company_id,
      applicants: jobDetails.applicants
    };

    this.log('Job payload:', JSON.stringify(payload, null, 2));

    const response = await this.makeRequest<any>('/jobs', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      success: response.success,
      data: response.data,
      message: response.message
    };
  }

  /**
   * Get existing job IDs for duplicate checking
   */
  async getExistingJobIds(): Promise<Set<string>> {
    this.log('Getting existing job IDs for duplicate checking...');
    
    try {
      const response = await this.makeRequest<{ job_ids: string[] }>('/jobs/existing-ids');
      
      if (response.success && response.data?.job_ids) {
        const jobIds = new Set(response.data.job_ids);
        this.log(`Retrieved ${jobIds.size} existing job IDs`);
        return jobIds;
      } else {
        this.log('Failed to get existing job IDs:', response.message);
        return new Set();
      }
    } catch (error) {
      this.log('Error getting existing job IDs:', error);
      return new Set();
    }
  }

  /**
   * Create job details from platform-specific data
   */
  private createJobDetails(
    platformData: any,
    platform: any,
    jobId: string
  ): MultiSourceJobDetails {
    return {
      // Core job data
      title: platformData.title || '',
      location: platformData.location || '',
      description: platformData.description || '',
      apply_url: platformData.apply_url || window.location.href,
      posted_date: platformData.posted_date || new Date().toISOString().slice(0, 16).replace('T', ' '),
      skills: platformData.skills || [],
      company: platformData.company || '',
      company_id: platformData.company_id || null,

      // Platform-specific data
      source_id: platform.id,
      source_job_id: jobId,
      source_url: window.location.href,
      applicants: platformData.applicants || null
    };
  }

  /**
   * Auto-detect source from URL and create appropriate job details
   */
  async createJobDetailsFromCurrentPage(platformData: any): Promise<MultiSourceJobDetails | null> {
    const detected = PlatformDetector.detectCurrentPlatform();
    if (!detected || !detected.jobId) {
      console.error('[MULTI_SOURCE_API] Could not detect platform or job ID');
      return null;
    }

    return this.createJobDetails(platformData, detected.platform, detected.jobId);
  }
}

// Export singleton instance
export const multiSourceApiClient = new MultiSourceApiClient();
