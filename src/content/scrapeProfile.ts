// =============================================================================
// IMPORTS - Clean modular approach with ES modules
// =============================================================================
// Configuration is handled by environment.ts
import { apiClient, type ProfileData, type PositionItem, type EducationItem, type ApiResponse } from '../config/apiClient.js';
import { showNotification } from '../utils/uiUtils.js';

// =============================================================================
// PROFILE SCRAPER CLASS
// =============================================================================

class ProfileScraper {

  private log(message: string, ...args: any[]) {
    console.info(`[LINKEDIN_SCRAPER_PROFILE] ${message}`, ...args);
  }

  private async clickSeeAllExperiencesButton(): Promise<void> {
    try {
      this.log('INFO: Looking for "See all experiences" button...');

      // Find the experience section first
      const experienceSection = document.querySelector('#experience')?.closest('section.artdeco-card');
      if (!experienceSection) {
        this.log('INFO: Experience section not found');
        return;
      }

      // Look for the "See all experiences" button within the experience section
      const seeAllButton = experienceSection.querySelector('a[id*="see-all-experiences"], a[href*="/details/experience"]');

      if (seeAllButton) {
        this.log('INFO: Found "See all experiences" button, clicking...');
        (seeAllButton as HTMLElement).click();

        // Wait for the page to load the expanded experience list
        this.log('INFO: Waiting for expanded experience list to load...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        this.log('INFO: Successfully clicked "See all experiences" button');
      } else {
        this.log('INFO: "See all experiences" button not found - all experiences might already be visible');
      }
    } catch (error) {
      this.log('ERROR: Error clicking "See all experiences" button:', error);
    }
  }

  private isExpandedExperiencePage(): boolean {
    const url = window.location.href;
    const isExpanded = url.includes('/details/experience/');
    this.log(`INFO: Is expanded experience page: ${isExpanded}, URL: ${url}`);
    console.log('🔍 [PROFILE SCRAPER] Checking if expanded experience page:', isExpanded, 'URL:', url);
    return isExpanded;
  }

  private isExpandedEducationPage(): boolean {
    const url = window.location.href;
    const isExpanded = url.includes('/details/education/');
    this.log(`INFO: Is expanded education page: ${isExpanded}, URL: ${url}`);
    console.log('🔍 [PROFILE SCRAPER] Checking if expanded education page:', isExpanded, 'URL:', url);
    return isExpanded;
  }

  private extractFromExpandedExperiencePage(): PositionItem[] {
    this.log('INFO: Extracting from expanded experience page');
    const positions: PositionItem[] = [];

    // Selectors for the expanded experience page
    const expandedSelectors = [
      '.pvs-list__paged-list-item',
      '.pvs-list__item--line-separated',
      '.pvs-list__item',
      '.artdeco-list__item',
      '.pv-profile-section__section-info .pv-entity__summary-info'
    ];

    let experienceItems: NodeListOf<Element> | null = null;

    for (const selector of expandedSelectors) {
      experienceItems = document.querySelectorAll(selector);
      if (experienceItems.length > 0) {
        this.log(`INFO: Found ${experienceItems.length} experience items on expanded page using selector: ${selector}`);
        break;
      }
    }

    if (!experienceItems || experienceItems.length === 0) {
      this.log('WARNING: No experience items found on expanded page');
      return positions;
    }

    experienceItems.forEach((item, index) => {
      this.log(`INFO: Processing expanded page experience item ${index + 1}:`, item);

      try {
        // Extract title from expanded page
        const titleSelectors = [
          '.display-flex.align-items-center.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
          '.mr1.t-bold span[aria-hidden="true"]',
          '.t-bold.t-16 span[aria-hidden="true"]',
          '.pvs-entity__summary-title .t-bold span',
          'h3 .t-bold span[aria-hidden="true"]',
          '.hoverable-link-text.t-bold span[aria-hidden="true"]'
        ];

        let title = '';
        for (const selector of titleSelectors) {
          const titleElement = item.querySelector(selector);
          if (titleElement?.textContent?.trim()) {
            title = titleElement.textContent.trim();
            this.log(`INFO: Found title on expanded page using selector "${selector}": ${title}`);
            break;
          }
        }

        // Extract company from expanded page
        const companySelectors = [
          '.t-14.t-normal span[aria-hidden="true"]',
          '.pvs-entity__summary-subtitle .t-14 span[aria-hidden="true"]',
          '.t-14.t-black--light span[aria-hidden="true"]',
          '.pv-entity__secondary-title'
        ];

        let company_name = '';
        for (const selector of companySelectors) {
          const companyElements = Array.from(item.querySelectorAll(selector));
          // Look for the first text that doesn't look like a date
          for (const companyElement of companyElements) {
            const text = companyElement.textContent?.trim() || '';
            const dateRegex = /\d+\s*(yr|mo|year|month|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
            if (text && !dateRegex.test(text)) {
              // Clean up company name - remove everything after "· " (employment type, etc.)
              company_name = text.includes(' · ') ? text.split(' · ')[0].trim() : text;
              this.log(`INFO: Found company on expanded page using selector "${selector}": ${company_name}`);
              break;
            }
          }
          if (company_name) break;
        }

        // Extract duration from expanded page
        const durationSelectors = [
          '.t-14.t-normal.t-black--light span[aria-hidden="true"]',
          '.pvs-entity__summary-metadata .t-14 span[aria-hidden="true"]',
          '.t-black--light span[aria-hidden="true"]'
        ];

        let duration = '';
        for (const selector of durationSelectors) {
          const durationElements = Array.from(item.querySelectorAll(selector));
          // Look for text that looks like a date or duration
          for (const durationElement of durationElements) {
            const text = durationElement.textContent?.trim() || '';
            const dateRegex = /\d+\s*(yr|mo|year|month|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
            if (text && (dateRegex.test(text) ||
                        text.includes('Present') || text.includes('-'))) {
              duration = text;
              this.log(`INFO: Found duration on expanded page using selector "${selector}": ${duration}`);
              break;
            }
          }
          if (duration) break;
        }

        const locationSelectors = [
            '.t-14.t-normal.t-black--light span[aria-hidden="true"]',
            '.pvs-entity__summary-metadata .t-12 span[aria-hidden="true"]'
          ];

          let location = '';
          for (const selector of locationSelectors) {
            const locationElements = Array.from(item.querySelectorAll(selector));

            // Look for location text that doesn't contain date patterns or duration indicators
            for (const locationElement of locationElements) {
              const text = locationElement.textContent?.trim() || '';

              // Skip if this looks like a date/duration (contains months, years, or duration indicators)
              const dateRegex = /\d+\s*(yr|mo|mdr|year|month|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)/i;
              const durationRegex = /(\d+\s*(mdr|months?|years?|yr|mo)|\s-\s|·)/i;

              if (text && !dateRegex.test(text) && !durationRegex.test(text) && !text.includes('Present')) {
                // This should be location text
                location = text;
                this.log(`INFO: Found location on expanded page: ${location}`);
                break;
              }
            }
            if (location) break;
          }

        // Extract description from expanded page
        let summary = '';
        const descriptionSelectors = [
          '.t-14.t-normal.t-black span[aria-hidden="true"]',
          '.pvs-list__outer-container .t-14.t-normal.t-black',
          '.pvs-list__outer-container .t-14',
          '.inline-show-more-text .t-14',
          '.pv-entity__description'
        ];

        for (const selector of descriptionSelectors) {
          const descElement = item.querySelector(selector);
          if (descElement?.textContent?.trim()) {
            const text = descElement.textContent.trim();

            // Skip if this looks like skills, company name, or duration text
            const isSkillsText = text.includes('Kompetencer:') || text.includes('Skills:');
            const isCompanyText = text === company_name || text.includes(' · ');
            const isDurationText = /\d+\s*(yr|mo|mdr|year|month|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(text);

            if (!isSkillsText && !isCompanyText && !isDurationText && text.length > 50) {
              summary = text;
              this.log(`INFO: Found description on expanded page using selector "${selector}": ${summary.substring(0, 100)}...`);
              break;
            }
          }
        }

        // Extract skills from expanded page
        let skills: string[] = [];
        try {
          // Look for skills section within this experience item
          const skillsElements = item.querySelectorAll('.t-14.t-normal.t-black span[aria-hidden="true"]');

          for (const skillElement of Array.from(skillsElements)) {
            const skillText = skillElement.textContent?.trim() || '';

            // Check if this contains skills (look for "Kompetencer:" or "Skills:" and the "·" separator)
            if ((skillText.includes('Kompetencer:') || skillText.includes('Skills:')) && skillText.includes('·')) {
              this.log(`INFO: Found skills text on expanded page: ${skillText}`);

              // Extract the skills part after "Kompetencer:" or "Skills:"
              let skillsPart = '';
              if (skillText.includes('Kompetencer:')) {
                skillsPart = skillText.split('Kompetencer:')[1];
              } else if (skillText.includes('Skills:')) {
                skillsPart = skillText.split('Skills:')[1];
              }

              if (skillsPart) {
                // Split by · and clean up each skill
                skills = skillsPart
                  .split('·')
                  .map(skill => skill.trim())
                  .filter(skill => skill.length > 0);

                this.log(`INFO: Extracted ${skills.length} skills from expanded page:`, skills);
                break;
              }
            }
          }
        } catch (error) {
          this.log('ERROR: Error extracting skills from expanded page:', error);
        }

        // Only add if we have at least a title and company
        if (title && company_name && !this.isEducationItemByContent(title, company_name)) {
          const { start_date, end_date } = this.parseDuration(duration);

          const position: PositionItem = {
            title,
            company_name,
            summary: summary || undefined,
            location: location || undefined,
            start_date,
            end_date,
            skills
          };

          positions.push(position);
          this.log(`INFO: Added position from expanded page:`, position);
        } else {
          this.log(`INFO: Skipping expanded page item - Title: "${title}", Company: "${company_name}" (missing data or education)`);
        }
      } catch (error) {
        this.log('ERROR: Error processing expanded page experience item:', error);
      }
    });

    return positions;
  }

  private extractFromExpandedEducationPage(): EducationItem[] {
    this.log('INFO: Extracting from expanded education page');
    const educations: EducationItem[] = [];

    // Selectors for the expanded education page
    const expandedSelectors = [
      '.pvs-list__paged-list-item',
      '.pvs-list__item--line-separated',
      '.pvs-list__item',
      '.artdeco-list__item',
      '.pv-profile-section__section-info .pv-entity__summary-info'
    ];

    let educationItems: NodeListOf<Element> | null = null;

    for (const selector of expandedSelectors) {
      educationItems = document.querySelectorAll(selector);
      if (educationItems.length > 0) {
        this.log(`INFO: Found ${educationItems.length} education items on expanded page using selector: ${selector}`);
        break;
      }
    }

    if (!educationItems || educationItems.length === 0) {
      this.log('WARNING: No education items found on expanded page');
      return educations;
    }

    educationItems.forEach((item, index) => {
      this.log(`INFO: Processing expanded page education item ${index + 1}:`, item);

      try {
        // Extract school name from expanded page
        const schoolSelectors = [
          '.display-flex.align-items-center.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
          '.mr1.t-bold span[aria-hidden="true"]',
          '.t-bold.t-16 span[aria-hidden="true"]',
          '.pvs-entity__summary-title .t-bold span',
          'h3 .t-bold span[aria-hidden="true"]',
          '.hoverable-link-text.t-bold span[aria-hidden="true"]'
        ];

        let school_name = '';
        for (const selector of schoolSelectors) {
          const schoolElement = item.querySelector(selector);
          if (schoolElement?.textContent?.trim()) {
            school_name = schoolElement.textContent.trim();
            this.log(`INFO: Found school on expanded page using selector "${selector}": ${school_name}`);
            break;
          }
        }

        // Extract degree from expanded page
        const degreeSelectors = [
          '.t-14.t-normal span[aria-hidden="true"]',
          '.pvs-entity__summary-subtitle .t-14 span[aria-hidden="true"]',
          '.t-14.t-black--light span[aria-hidden="true"]',
          '.pv-entity__secondary-title'
        ];

        let degree = '';
        for (const selector of degreeSelectors) {
          const degreeElements = Array.from(item.querySelectorAll(selector));
          // Look for the first text that doesn't look like a date or duration
          for (const degreeElement of degreeElements) {
            const text = degreeElement.textContent?.trim() || '';
            const dateRegex = /\d+\s*(yr|mo|year|month|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
            const yearRegex = /^\d{4}(\s*-\s*\d{4})?$/;
            if (text && !dateRegex.test(text) && !yearRegex.test(text) && !text.includes('Present')) {
              degree = text;
              this.log(`INFO: Found degree on expanded page using selector "${selector}": ${degree}`);
              break;
            }
          }
          if (degree) break;
        }

        // Extract years from expanded page
        const yearSelectors = [
          '.t-14.t-normal.t-black--light span[aria-hidden="true"]',
          '.pvs-entity__summary-metadata .t-14 span[aria-hidden="true"]',
          '.t-black--light span[aria-hidden="true"]'
        ];

        let years = '';
        for (const selector of yearSelectors) {
          const yearElements = Array.from(item.querySelectorAll(selector));
          // Look for text that looks like years or duration
          for (const yearElement of yearElements) {
            const text = yearElement.textContent?.trim() || '';
            const yearRegex = /\d{4}/;
            if (text && (yearRegex.test(text) || text.includes('-') || text.includes('Present'))) {
              years = text;
              this.log(`INFO: Found years on expanded page using selector "${selector}": ${years}`);
              break;
            }
          }
          if (years) break;
        }

        // Extract description from expanded page
        let summary = '';
        const descriptionSelectors = [
          '.t-14.t-normal.t-black span[aria-hidden="true"]',
          '.pvs-list__outer-container .t-14.t-normal.t-black',
          '.pvs-list__outer-container .t-14',
          '.inline-show-more-text .t-14',
          '.pv-entity__description'
        ];

        for (const selector of descriptionSelectors) {
          const descElement = item.querySelector(selector);
          if (descElement?.textContent?.trim()) {
            const text = descElement.textContent.trim();

            // Skip if this looks like skills, company name, or duration text
            const isSkillsText = text.includes('Kompetencer:') || text.includes('Skills:');
            const isCompanyText = text === school_name || text.includes(' · ');
            const isDurationText = /\d+\s*(yr|mo|mdr|year|month|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(text);

            if (!isSkillsText && !isCompanyText && !isDurationText && text.length > 50) {
              summary = text;
              this.log(`INFO: Found description on expanded page using selector "${selector}": ${summary.substring(0, 100)}...`);
              break;
            }
          }
        }

        // Extract skills from expanded page
        let skills: string[] = [];
        try {
          // Look for skills section within this education item
          const skillsElements = item.querySelectorAll('.t-14.t-normal.t-black span[aria-hidden="true"]');

          for (const skillElement of Array.from(skillsElements)) {
            const skillText = skillElement.textContent?.trim() || '';

            // Check if this contains skills (look for "Kompetencer:" or "Skills:" and the "·" separator)
            if ((skillText.includes('Kompetencer:') || skillText.includes('Skills:')) && skillText.includes('·')) {
              this.log(`INFO: Found skills text on expanded education page: ${skillText}`);

              // Extract the skills part after "Kompetencer:" or "Skills:"
              let skillsPart = '';
              if (skillText.includes('Kompetencer:')) {
                skillsPart = skillText.split('Kompetencer:')[1];
              } else if (skillText.includes('Skills:')) {
                skillsPart = skillText.split('Skills:')[1];
              }

              if (skillsPart) {
                // Split by · and clean up each skill
                skills = skillsPart
                  .split('·')
                  .map(skill => skill.trim())
                  .filter(skill => skill.length > 0);

                this.log(`INFO: Extracted ${skills.length} skills from expanded education page:`, skills);
                break;
              }
            }
          }
        } catch (error) {
          this.log('ERROR: Error extracting skills from expanded education page:', error);
        }

        // Only add if we have at least a school name and degree
        if (school_name && degree) {
          const { start_year, end_year } = this.parseEducationYears(years);

          const education: EducationItem = {
            school_name,
            summary: summary || 'N/A', // Default to 'N/A' if no summary
            degree,
            start_year,
            end_year,
            skills
          };

          educations.push(education);
          this.log(`INFO: Added education from expanded page:`, education);
        } else {
          this.log(`INFO: Skipping expanded page education item - School: "${school_name}", Degree: "${degree}" (missing data)`);
        }
      } catch (error) {
        this.log('ERROR: Error processing expanded page education item:', error);
      }
    });

    return educations;
  }

  private async navigateToExpandedExperiencePageForMoreData(): Promise<void> {
    try {
      const currentUrl = window.location.href;
      console.log('🔍 [PROFILE SCRAPER] ===== NAVIGATING TO EXPERIENCE PAGE =====');
      console.log('🔍 [PROFILE SCRAPER] Current URL:', currentUrl);

      // Only navigate if we're not already on the expanded page
      if (!currentUrl.includes('/details/experience/')) {
        const profileUrlMatch = currentUrl.match(/^(https:\/\/www\.linkedin\.com\/in\/[^\/\?]+)/);
        if (profileUrlMatch) {
          const baseProfileUrl = profileUrlMatch[1];
          const expandedExperienceUrl = `${baseProfileUrl}/details/experience/`;

          this.log(`INFO: Navigating to expanded experience page for detailed data: ${expandedExperienceUrl}`);
          console.log('🔍 [PROFILE SCRAPER] Base profile URL:', baseProfileUrl);
          console.log('🔍 [PROFILE SCRAPER] Expanded experience URL:', expandedExperienceUrl);

          // Store that we want to auto-scrape experience when we arrive
          sessionStorage.setItem('linkedin-scraper-auto-scrape-experience', 'true');
          console.log('🔍 [PROFILE SCRAPER] Set auto-scrape experience flag');
          console.log('🔍 [PROFILE SCRAPER] Navigating to:', expandedExperienceUrl);
          window.location.href = expandedExperienceUrl;
        } else {
          console.log('🔍 [PROFILE SCRAPER] ⚠️ Could not extract profile URL from current URL');
        }
      } else {
        console.log('🔍 [PROFILE SCRAPER] Already on expanded experience page, no navigation needed');
      }
    } catch (error) {
      this.log('ERROR: Error navigating to expanded experience page:', error);
      console.log('🔍 [PROFILE SCRAPER] ❌ ERROR: Error navigating to expanded experience page:', error);
    }
  }

  private async navigateToExpandedEducationPageForMoreData(): Promise<void> {
    try {
      const currentUrl = window.location.href;
      console.log('🔍 [PROFILE SCRAPER] ===== NAVIGATING TO EDUCATION PAGE =====');
      console.log('🔍 [PROFILE SCRAPER] Current URL:', currentUrl);

      // Only navigate if we're not already on the expanded page
      if (!currentUrl.includes('/details/education/')) {
        const profileUrlMatch = currentUrl.match(/^(https:\/\/www\.linkedin\.com\/in\/[^\/\?]+)/);
        if (profileUrlMatch) {
          const baseProfileUrl = profileUrlMatch[1];
          const expandedEducationUrl = `${baseProfileUrl}/details/education/`;

          this.log(`INFO: Navigating to expanded education page for detailed data: ${expandedEducationUrl}`);
          console.log('🔍 [PROFILE SCRAPER] Base profile URL:', baseProfileUrl);
          console.log('🔍 [PROFILE SCRAPER] Expanded education URL:', expandedEducationUrl);

          // Store that we want to auto-scrape education when we arrive
          sessionStorage.setItem('linkedin-scraper-auto-scrape-education', 'true');
          console.log('🔍 [PROFILE SCRAPER] Set auto-scrape education flag');
          console.log('🔍 [PROFILE SCRAPER] Navigating to:', expandedEducationUrl);
          window.location.href = expandedEducationUrl;
        } else {
          console.log('🔍 [PROFILE SCRAPER] ⚠️ Could not extract profile URL from current URL');
        }
      } else {
        console.log('🔍 [PROFILE SCRAPER] Already on expanded education page, no navigation needed');
      }
    } catch (error) {
      this.log('ERROR: Error navigating to expanded education page:', error);
      console.log('🔍 [PROFILE SCRAPER] ❌ ERROR: Error navigating to expanded education page:', error);
    }
  }

  private isEducationItemByContent(title: string, company: string): boolean {
    // More comprehensive check for education content
    const educationKeywords = [
      // Danish education keywords
      'zealand', 'erhvervsakademi', 'tekniske skole', 'universitet', 'gymnasium',
      'datamatiker', 'webudvikler', 'uddannelse', 'studium',

      // English education keywords
      'university', 'college', 'school', 'academy', 'institute', 'institution',
      'education', 'bachelor', 'master', 'phd', 'diploma', 'degree', 'certificate',
      'campus', 'faculty', 'department'
    ];

    const titleLower = title.toLowerCase();
    const companyLower = company.toLowerCase();

    // Check if any education keywords are present
    const hasEducationKeywords = educationKeywords.some(keyword =>
      titleLower.includes(keyword) || companyLower.includes(keyword)
    );

    // Additional patterns that suggest education
    const educationPatterns = [
      /\b(bachelor|master|phd|ph\.?d|diploma|certificate)\b/i,
      /\b(student|graduate|undergraduate|postgraduate)\b/i,
      /\b(study|studies|studied|studying)\b/i
    ];

    const hasEducationPatterns = educationPatterns.some(pattern =>
      pattern.test(title) || pattern.test(company)
    );

    return hasEducationKeywords || hasEducationPatterns;
  }

  private parseDuration(duration: string): { start_date?: string; end_date?: string } {
    // Enhanced duration parsing to handle various formats
    // Examples: "Jan 2024 - Present", "Jan 2024 - Dec 2024", "I dag · 1 år", etc.
    try {
      this.log(`INFO: Parsing duration: "${duration}"`);

      if (duration.includes(' - ')) {
        const [start, end] = duration.split(' - ');
        const startTrimmed = start.trim();
        const endTrimmed = end.trim();

        this.log(`INFO: Split duration - start: "${startTrimmed}", end: "${endTrimmed}"`);

        // Extract the actual date part before duration indicators
        const endDatePart = endTrimmed.split('·')[0].trim(); // Get "dec. 2024" from "dec. 2024 · 1 år 4 mdr."
        this.log(`INFO: Extracted end date part: "${endDatePart}" from "${endTrimmed}"`);

        // Check if the extracted date part indicates current/present
        const presentIndicators = ['present', 'i dag', 'today', 'current', 'now'];
        const isPresent = presentIndicators.some(indicator =>
          endDatePart.toLowerCase().includes(indicator)
        );

        if (isPresent) {
          this.log(`INFO: End date indicates present/current, setting to undefined`);
          return {
            start_date: this.parseDate(startTrimmed),
            end_date: undefined
          };
        } else {
          this.log(`INFO: Parsing end date: "${endDatePart}"`);
          return {
            start_date: this.parseDate(startTrimmed),
            end_date: this.parseDate(endDatePart)
          };
        }
      } else {
        // Single date or unparseable format
        const presentIndicators = ['present', 'i dag', 'today', 'current', 'now'];
        const isPresent = presentIndicators.some(indicator =>
          duration.toLowerCase().includes(indicator)
        );

        if (isPresent) {
          this.log(`INFO: Duration indicates present/current, returning undefined dates`);
          return { start_date: undefined, end_date: undefined };
        }

        // Try to parse as a single date
        const parsedDate = this.parseDate(duration);
        if (parsedDate && parsedDate !== duration) {
          // Successfully parsed
          return { start_date: parsedDate, end_date: undefined };
        }
      }
    } catch (error) {
      this.log('ERROR: Error parsing duration:', duration, error);
    }

    this.log(`WARNING: Could not parse duration "${duration}", returning empty object`);
    return {};
  }

  private parseDate(dateStr: string): string | undefined {
    try {
      this.log(`INFO: Parsing date: "${dateStr}"`);

      // Check if it's clearly not a date (contains duration indicators)
      const nonDateIndicators = ['år', 'year', 'mdr', 'month', '·', 'og', 'i dag', 'today', 'present'];
      if (nonDateIndicators.some(indicator => dateStr.toLowerCase().includes(indicator))) {
        this.log(`INFO: Date string contains non-date indicators, returning undefined: "${dateStr}"`);
        return undefined;
      }

      // Handle Danish month abbreviations and convert them to English
      const danishToEnglish: { [key: string]: string } = {
        'jan.': 'Jan',
        'feb.': 'Feb',
        'mar.': 'Mar',
        'apr.': 'Apr',
        'maj': 'May',
        'jun.': 'Jun',
        'jul.': 'Jul',
        'aug.': 'Aug',
        'sep.': 'Sep',
        'okt.': 'Oct',
        'nov.': 'Nov',
        'dec.': 'Dec',
        // Also handle full month names in Danish
        'januar': 'January',
        'februar': 'February',
        'marts': 'March',
        'april': 'April',
        'juni': 'June',
        'juli': 'July',
        'august': 'August',
        'september': 'September',
        'oktober': 'October',
        'november': 'November',
        'december': 'December'
      };

      let normalizedDate = dateStr.toLowerCase();

      // Replace Danish months with English equivalents
      for (const [danish, english] of Object.entries(danishToEnglish)) {
        if (normalizedDate.includes(danish)) {
          normalizedDate = normalizedDate.replace(danish, english);
          break;
        }
      }

      this.log(`INFO: Normalized date: "${normalizedDate}"`);

      // Try to parse the normalized date
      const date = new Date(normalizedDate);
      if (!isNaN(date.getTime())) {
        const isoDate = date.toISOString();
        this.log(`INFO: Successfully parsed date to ISO: "${isoDate}"`);
        return isoDate;
      }

      // If direct parsing fails, try to extract month and year manually
      const monthYearMatch = normalizedDate.match(/(\w+)\s+(\d{4})/);
      if (monthYearMatch) {
        const [, month, year] = monthYearMatch;
        const manualDate = new Date(`${month} 1, ${year}`);
        if (!isNaN(manualDate.getTime())) {
          const isoDate = manualDate.toISOString();
          this.log(`INFO: Manually parsed date to ISO: "${isoDate}"`);
          return isoDate;
        }
      }

      this.log(`WARNING: Could not parse date "${dateStr}", returning undefined`);
      return undefined;
    } catch (error) {
      this.log('ERROR: Error parsing date:', dateStr, error);
      return undefined;
    }
  }

  private extractEducations(): EducationItem[] {
    const educations: EducationItem[] = [];

    try {
      // Look for education section
      const educationSection = document.querySelector('#education')?.parentElement?.parentElement;
      if (!educationSection) return educations;

      const educationItems = educationSection.querySelectorAll('li.artdeco-list__item');

      educationItems.forEach((item) => {
        const schoolElement = item.querySelector('.mr1.t-bold span[aria-hidden="true"]');
        const degreeElement = item.querySelector('.t-14.t-normal span[aria-hidden="true"]');
        const yearsElement = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]');

        const school_name = schoolElement?.textContent?.trim() || '';
        const degree = degreeElement?.textContent?.trim() || '';
        const years = yearsElement?.textContent?.trim() || '';

        // Extract description/summary from education item
        let summary = '';
        const descriptionSelectors = [
          '.t-14.t-normal.t-black span[aria-hidden="true"]',
          '.pvs-list__outer-container .t-14.t-normal.t-black',
          '.pvs-list__outer-container .t-14',
          '.inline-show-more-text .t-14',
          '.pv-entity__description'
        ];

        for (const selector of descriptionSelectors) {
          const descElement = item.querySelector(selector);
          if (descElement?.textContent?.trim()) {
            const text = descElement.textContent.trim();

            // Skip if this looks like skills, school name, degree, or year text
            const isSkillsText = text.includes('Kompetencer:') || text.includes('Skills:');
            const isSchoolText = text === school_name;
            const isDegreeText = text === degree;
            const isYearText = /\d{4}/.test(text) && text === years;

            if (!isSkillsText && !isSchoolText && !isDegreeText && !isYearText && text.length > 20) {
              summary = text;
              break;
            }
          }
        }

        if (school_name && degree) {
          const { start_year, end_year } = this.parseEducationYears(years);

          educations.push({
            school_name,
            summary: summary || 'N/A', // Default to 'N/A' if no summary
            degree,
            start_year,
            end_year,
            skills: [] // Will be populated later if available
          });
        }
      });
    } catch (error) {
      this.log('Error extracting educations:', error);
    }

    return educations;
  }

  private parseEducationYears(years: string): { start_year?: number; end_year?: number } {
    try {
      // Parse years like "2019 - 2021" or "2019"
      if (years.includes(' - ')) {
        const [start, end] = years.split(' - ');
        return {
          start_year: parseInt(start.trim(), 10) || undefined,
          end_year: parseInt(end.trim(), 10) || undefined
        };
      } else if (years.trim()) {
        const year = parseInt(years.trim(), 10);
        return { start_year: year || undefined };
      }
    } catch (error) {
      this.log('Error parsing education years:', years, error);
    }
    return {};
  }

  private extractSkills(): string[] {
    const skills: string[] = [];

    try {
      // Look for skills section
      const skillsSection = document.querySelector('#skills')?.parentElement?.parentElement;
      if (!skillsSection) return skills;

      const skillItems = skillsSection.querySelectorAll('.mr1.t-bold span[aria-hidden="true"]');

      skillItems.forEach((item) => {
        const skill = item.textContent?.trim();
        if (skill) {
          skills.push(skill);
        }
      });
    } catch (error) {
      this.log('Error extracting skills:', error);
    }

    return skills;
  }

  private createSkillFrequencies(skills: string[]): { [key: string]: number } {
    const frequencies: { [key: string]: number } = {};

    skills.forEach(skill => {
      frequencies[skill] = (frequencies[skill] || 0) + 1;
    });

    return frequencies;
  }

  private async processFinalDataAndSendToAPI(): Promise<void> {
    try {
      this.log('INFO: Starting final data processing and API submission');

      // Get basic profile data from session storage
      const storedBasicProfile = sessionStorage.getItem('linkedin-scraper-basic-profile');
      if (!storedBasicProfile) {
        this.log('ERROR: No basic profile data found in session storage');
        return;
      }

      const basicProfileData = JSON.parse(storedBasicProfile);
      this.log('INFO: Retrieved basic profile data from session storage');

      // Get experience data from session storage
      const storedExpandedExperience = sessionStorage.getItem('linkedin-scraper-expanded-experience');
      let positions: PositionItem[] = [];
      if (storedExpandedExperience) {
        positions = JSON.parse(storedExpandedExperience);
        this.log(`INFO: Retrieved ${positions.length} experience items from session storage`);
      }

      // Get education data from session storage
      const storedExpandedEducation = sessionStorage.getItem('linkedin-scraper-expanded-education');
      let educations: EducationItem[] = [];
      if (storedExpandedEducation) {
        educations = JSON.parse(storedExpandedEducation);
        this.log(`INFO: Retrieved ${educations.length} education items from session storage`);
      }

      // Generate skill frequencies from all extracted skills
      const allSkills: string[] = [];
      positions.forEach(position => {
        if (position.skills) {
          allSkills.push(...position.skills);
        }
      });
      educations.forEach(education => {
        if (education.skills) {
          allSkills.push(...education.skills);
        }
      });
      const skill_frequencies = this.createSkillFrequencies(allSkills);

      // Assemble final profile data
      const currentUrl = window.location.href;
      // Extract base profile URL (remove any /details/... parts)
      const profileUrlMatch = currentUrl.match(/^(https:\/\/www\.linkedin\.com\/in\/[^\/\?]+)/);
      const linkedin_url = profileUrlMatch ? profileUrlMatch[1] : currentUrl;

      const profileData: ProfileData = {
        linkedin_url,
        headline: basicProfileData.headline || basicProfileData.name, // Use headline, fallback to name
        summary: basicProfileData.summary,
        location_city: basicProfileData.location_city,
        avatar: basicProfileData.avatar,
        positions,
        educations,
        skill_frequencies
      };

      this.log('INFO: Final profile data assembled:', {
        linkedin_url: profileData.linkedin_url,
        headline: profileData.headline,
        positionsCount: profileData.positions.length,
        educationsCount: profileData.educations.length,
        skillsCount: Object.keys(profileData.skill_frequencies).length
      });

      // Clean up all session storage data
      sessionStorage.removeItem('linkedin-scraper-basic-profile');
      sessionStorage.removeItem('linkedin-scraper-expanded-experience');
      sessionStorage.removeItem('linkedin-scraper-experience-complete');
      sessionStorage.removeItem('linkedin-scraper-expanded-education');
      sessionStorage.removeItem('linkedin-scraper-education-complete');
      this.log('INFO: Cleaned up session storage data');

      // Send data to API
      await this.sendDataToAPI(profileData);

    } catch (error) {
      this.log('ERROR: Error in final data processing:', error);
    }
  }

  private async sendDataToAPI(profileData: ProfileData): Promise<void> {
    try {
      this.log('INFO: Preparing to send profile data to API');

      this.log('INFO: Sending profile data to API:', {
        linkedin_url: profileData.linkedin_url,
        headline: profileData.headline,
        positionsCount: profileData.positions.length,
        educationsCount: profileData.educations.length,
        skillsCount: Object.keys(profileData.skill_frequencies).length
      });

      const response = await apiClient.sendProfileDataToAPI(profileData);

      if (response.success) {
        this.log('SUCCESS: Profile data sent to API successfully');
        showNotification('✅ Profile data sent successfully', 'success');
      } else {
        this.log('ERROR: Failed to send profile data to API:', response.message);
        showNotification(`❌ Failed to send data: ${response.message}`, 'error');
      }
    } catch (error) {
      this.log('ERROR: Error sending data to API:', error);
    }
  }

  async scrapeProfile(): Promise<void> {
    try {
      this.log('INFO: ===== Starting profile scraping =====');
      console.log('🔍 [PROFILE SCRAPER] ===== PROFILE SCRAPING STARTED =====');
      console.log('🔍 [PROFILE SCRAPER] Current URL:', window.location.href);
      console.log('🔍 [PROFILE SCRAPER] Page title:', document.title);
      console.log('🔍 [PROFILE SCRAPER] Document ready state:', document.readyState);
      console.log('🔍 [PROFILE SCRAPER] Session storage keys:', Object.keys(sessionStorage).filter(key => key.includes('linkedin-scraper')));

      const currentUrl = window.location.href;

      // Check if we're on the expanded experience page and should auto-scrape
      if (this.isExpandedExperiencePage() && sessionStorage.getItem('linkedin-scraper-auto-scrape-experience') === 'true') {
        this.log('INFO: On expanded experience page, extracting and storing data');
        console.log('🔍 [PROFILE SCRAPER] ===== EXPANDED EXPERIENCE PAGE DETECTED =====');
        console.log('🔍 [PROFILE SCRAPER] Auto-scrape experience flag found');
        console.log('🔍 [PROFILE SCRAPER] Page URL:', window.location.href);
        console.log('🔍 [PROFILE SCRAPER] Page content preview:', document.body.innerText.substring(0, 500));

        // Clear the auto-scrape flag
        sessionStorage.removeItem('linkedin-scraper-auto-scrape-experience');
        console.log('🔍 [PROFILE SCRAPER] Cleared auto-scrape experience flag');

        // Extract from expanded page and store in session storage
        console.log('🔍 [PROFILE SCRAPER] Starting experience extraction from expanded page...');
        const expandedPositions = this.extractFromExpandedExperiencePage();
        console.log('🔍 [PROFILE SCRAPER] Extracted positions:', expandedPositions);
        console.log('🔍 [PROFILE SCRAPER] Number of positions found:', expandedPositions.length);

        if (expandedPositions.length > 0) {
          sessionStorage.setItem('linkedin-scraper-expanded-experience', JSON.stringify(expandedPositions));
          this.log(`INFO: Stored ${expandedPositions.length} positions from expanded page`);
          console.log('🔍 [PROFILE SCRAPER] Stored positions in session storage');
        } else {
          console.log('🔍 [PROFILE SCRAPER] ⚠️ No positions extracted from expanded page');
        }

        // Set flag that expanded experience extraction is complete
        sessionStorage.setItem('linkedin-scraper-experience-complete', 'true');
        console.log('🔍 [PROFILE SCRAPER] Set experience complete flag');

        // Navigate directly to education page instead of back to profile
        this.log('INFO: Experience extraction complete, navigating directly to education page');
        console.log('🔍 [PROFILE SCRAPER] Navigating to education page...');
        await this.navigateToExpandedEducationPageForMoreData();
        return;
      }

      // Check if we're on the expanded education page and should auto-scrape
      if (this.isExpandedEducationPage() && sessionStorage.getItem('linkedin-scraper-auto-scrape-education') === 'true') {
        this.log('INFO: On expanded education page, extracting and storing data');
        console.log('🔍 [PROFILE SCRAPER] ===== EXPANDED EDUCATION PAGE DETECTED =====');
        console.log('🔍 [PROFILE SCRAPER] Auto-scrape education flag found');
        console.log('🔍 [PROFILE SCRAPER] Page URL:', window.location.href);
        console.log('🔍 [PROFILE SCRAPER] Page content preview:', document.body.innerText.substring(0, 500));

        // Clear the auto-scrape flag
        sessionStorage.removeItem('linkedin-scraper-auto-scrape-education');
        console.log('🔍 [PROFILE SCRAPER] Cleared auto-scrape education flag');

        // Extract from expanded page and store in session storage
        console.log('🔍 [PROFILE SCRAPER] Starting education extraction from expanded page...');
        const expandedEducations = this.extractFromExpandedEducationPage();
        console.log('🔍 [PROFILE SCRAPER] Extracted educations:', expandedEducations);
        console.log('🔍 [PROFILE SCRAPER] Number of educations found:', expandedEducations.length);

        if (expandedEducations.length > 0) {
          sessionStorage.setItem('linkedin-scraper-expanded-education', JSON.stringify(expandedEducations));
          this.log(`INFO: Stored ${expandedEducations.length} educations from expanded page`);
          console.log('🔍 [PROFILE SCRAPER] Stored educations in session storage');
        } else {
          console.log('🔍 [PROFILE SCRAPER] ⚠️ No educations extracted from expanded page');
        }

        // Set flag that expanded education extraction is complete
        sessionStorage.setItem('linkedin-scraper-education-complete', 'true');
        console.log('🔍 [PROFILE SCRAPER] Set education complete flag');

        this.log('INFO: Education extraction complete, proceeding to final data processing and API submission');
        console.log('🔍 [PROFILE SCRAPER] Proceeding to final data processing...');

        // Since we have both experience and education data, proceed directly to final processing
        // Assemble final data from session storage and send to API
        await this.processFinalDataAndSendToAPI();
        return;
      }

      // We're on the regular profile page - extract basic profile data first
      this.log('INFO: On profile page - extracting basic profile data...');
      console.log('🔍 [PROFILE SCRAPER] ===== REGULAR PROFILE PAGE DETECTED =====');
      console.log('🔍 [PROFILE SCRAPER] Starting basic profile data extraction...');

      // Wait a bit for the page to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('🔍 [PROFILE SCRAPER] Waited 2 seconds for page load');

      // Extract basic profile data (only from profile page, not expanded pages)
      console.log('🔍 [PROFILE SCRAPER] Looking for name element...');
      const nameElement = document.querySelector('h1.text-heading-xlarge, .pv-text-details__left-panel h1');
      const name = nameElement?.textContent?.trim() || '';
      console.log('🔍 [PROFILE SCRAPER] Name element found:', nameElement);
      console.log('🔍 [PROFILE SCRAPER] Name extracted:', name);

      console.log('🔍 [PROFILE SCRAPER] Looking for headline element...');
      const headlineElement = document.querySelector('.text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium');
      const headline = headlineElement?.textContent?.trim() || name;
      console.log('🔍 [PROFILE SCRAPER] Headline element found:', headlineElement);
      console.log('🔍 [PROFILE SCRAPER] Headline extracted:', headline);

      console.log('🔍 [PROFILE SCRAPER] Looking for summary element...');
      const summaryElement = document.querySelector('#about')?.parentElement?.querySelector('.pv-shared-text-with-see-more');
      const summary = summaryElement?.textContent?.trim() || '';
      console.log('🔍 [PROFILE SCRAPER] Summary element found:', summaryElement);
      console.log('🔍 [PROFILE SCRAPER] Summary extracted:', summary ? `${summary.substring(0, 100)}...` : 'No summary');

      console.log('🔍 [PROFILE SCRAPER] Looking for location element...');
      const locationElement = document.querySelector('.text-body-small.inline.t-black--light.break-words, .pv-text-details__left-panel .text-body-small');
      const location_city = locationElement?.textContent?.trim() || '';
      console.log('🔍 [PROFILE SCRAPER] Location element found:', locationElement);
      console.log('🔍 [PROFILE SCRAPER] Location extracted:', location_city);

      console.log('🔍 [PROFILE SCRAPER] Looking for avatar element...');
      const avatarElement = document.querySelector('.pv-top-card__photo, .profile-photo-edit__preview img') as HTMLImageElement;
      const avatar = avatarElement?.src || '';
      console.log('🔍 [PROFILE SCRAPER] Avatar element found:', avatarElement);
      console.log('🔍 [PROFILE SCRAPER] Avatar URL extracted:', avatar);

      // Store basic profile data in session storage for later use
      const basicProfileData = { name, headline, summary, location_city, avatar };
      sessionStorage.setItem('linkedin-scraper-basic-profile', JSON.stringify(basicProfileData));
      this.log('INFO: Stored basic profile data for later use');
      console.log('🔍 [PROFILE SCRAPER] Stored basic profile data:', basicProfileData);

      // Handle experience extraction - check if we have completed data
      console.log('🔍 [PROFILE SCRAPER] ===== CHECKING EXPERIENCE DATA =====');
      let positions: PositionItem[] = [];
      const storedExpandedExperience = sessionStorage.getItem('linkedin-scraper-expanded-experience');
      const experienceComplete = sessionStorage.getItem('linkedin-scraper-experience-complete') === 'true';

      console.log('🔍 [PROFILE SCRAPER] Stored experience data exists:', !!storedExpandedExperience);
      console.log('🔍 [PROFILE SCRAPER] Experience complete flag:', experienceComplete);

      if (storedExpandedExperience && experienceComplete) {
        this.log('INFO: Using stored expanded experience data');
        console.log('🔍 [PROFILE SCRAPER] Using stored experience data');
        positions = JSON.parse(storedExpandedExperience);
        console.log('🔍 [PROFILE SCRAPER] Parsed positions:', positions);
        console.log('🔍 [PROFILE SCRAPER] Number of stored positions:', positions.length);
        // Clean up the stored data
        sessionStorage.removeItem('linkedin-scraper-expanded-experience');
        sessionStorage.removeItem('linkedin-scraper-experience-complete');
        console.log('🔍 [PROFILE SCRAPER] Cleaned up experience session storage');
      } else {
        this.log('INFO: Need to extract experience from expanded page');
        console.log('🔍 [PROFILE SCRAPER] Need to extract experience from expanded page');
        console.log('🔍 [PROFILE SCRAPER] Navigating to expanded experience page...');
        // Navigate to expanded experience page
        await this.navigateToExpandedExperiencePageForMoreData();
        return; // Navigation will trigger re-scraping
      }

      // Handle education extraction - check if we have completed data
      console.log('🔍 [PROFILE SCRAPER] ===== CHECKING EDUCATION DATA =====');
      let educations: EducationItem[] = [];
      const storedExpandedEducation = sessionStorage.getItem('linkedin-scraper-expanded-education');
      const educationComplete = sessionStorage.getItem('linkedin-scraper-education-complete') === 'true';

      console.log('🔍 [PROFILE SCRAPER] Stored education data exists:', !!storedExpandedEducation);
      console.log('🔍 [PROFILE SCRAPER] Education complete flag:', educationComplete);

      if (storedExpandedEducation && educationComplete) {
        this.log('INFO: Using stored expanded education data');
        console.log('🔍 [PROFILE SCRAPER] Using stored education data');
        educations = JSON.parse(storedExpandedEducation);
        console.log('🔍 [PROFILE SCRAPER] Parsed educations:', educations);
        console.log('🔍 [PROFILE SCRAPER] Number of stored educations:', educations.length);
        // Clean up the stored data
        sessionStorage.removeItem('linkedin-scraper-expanded-education');
        sessionStorage.removeItem('linkedin-scraper-education-complete');
        console.log('🔍 [PROFILE SCRAPER] Cleaned up education session storage');
      } else {
        this.log('INFO: Need to extract education from expanded page');
        console.log('🔍 [PROFILE SCRAPER] Need to extract education from expanded page');
        console.log('🔍 [PROFILE SCRAPER] Navigating to expanded education page...');
        // Navigate to expanded education page
        await this.navigateToExpandedEducationPageForMoreData();
        return; // Navigation will trigger re-scraping
      }

      // Generate skill frequencies from all extracted skills
      console.log('🔍 [PROFILE SCRAPER] ===== GENERATING SKILL FREQUENCIES =====');
      const allSkills: string[] = [];
      positions.forEach(position => {
        if (position.skills) {
          allSkills.push(...position.skills);
        }
      });
      educations.forEach(education => {
        if (education.skills) {
          allSkills.push(...education.skills);
        }
      });
      console.log('🔍 [PROFILE SCRAPER] All skills collected:', allSkills);
      const skill_frequencies = this.createSkillFrequencies(allSkills);
      console.log('🔍 [PROFILE SCRAPER] Skill frequencies:', skill_frequencies);

      console.log('🔍 [PROFILE SCRAPER] ===== CONSTRUCTING FINAL PROFILE DATA =====');
      const profileData: ProfileData = {
        linkedin_url: currentUrl,
        headline,
        summary: summary && summary.trim() ? summary : undefined,
        location_city,
        avatar: avatar && avatar.trim() ? avatar : undefined,
        positions,
        educations,
        skill_frequencies
      };

      this.log('INFO: Profile data constructed successfully');
      console.log('🔍 [PROFILE SCRAPER] Profile data constructed successfully');
      this.log('INFO: Profile data validation:');
      console.log('🔍 [PROFILE SCRAPER] ===== PROFILE DATA VALIDATION =====');
      this.log(`  - linkedin_url: ${profileData.linkedin_url} (length: ${profileData.linkedin_url?.length || 0})`);
      this.log(`  - headline: ${profileData.headline} (length: ${profileData.headline?.length || 0})`);
      this.log(`  - summary: ${profileData.summary ? 'Present' : 'Not present'} (length: ${profileData.summary?.length || 0})`);
      this.log(`  - location_city: ${profileData.location_city} (length: ${profileData.location_city?.length || 0})`);
      this.log(`  - avatar: ${profileData.avatar ? 'Present' : 'Not present'} (length: ${profileData.avatar?.length || 0})`);
      this.log(`  - positions: ${profileData.positions.length} items`);
      this.log(`  - educations: ${profileData.educations.length} items`);
      this.log(`  - skill_frequencies: ${Object.keys(profileData.skill_frequencies).length} skills`);

      console.log('🔍 [PROFILE SCRAPER] Profile data validation:');
      console.log(`🔍 [PROFILE SCRAPER] - linkedin_url: ${profileData.linkedin_url} (length: ${profileData.linkedin_url?.length || 0})`);
      console.log(`🔍 [PROFILE SCRAPER] - headline: ${profileData.headline} (length: ${profileData.headline?.length || 0})`);
      console.log(`🔍 [PROFILE SCRAPER] - summary: ${profileData.summary ? 'Present' : 'Not present'} (length: ${profileData.summary?.length || 0})`);
      console.log(`🔍 [PROFILE SCRAPER] - location_city: ${profileData.location_city} (length: ${profileData.location_city?.length || 0})`);
      console.log(`🔍 [PROFILE SCRAPER] - avatar: ${profileData.avatar ? 'Present' : 'Not present'} (length: ${profileData.avatar?.length || 0})`);
      console.log(`🔍 [PROFILE SCRAPER] - positions: ${profileData.positions.length} items`);
      console.log(`🔍 [PROFILE SCRAPER] - educations: ${profileData.educations.length} items`);
      console.log(`🔍 [PROFILE SCRAPER] - skill_frequencies: ${Object.keys(profileData.skill_frequencies).length} skills`);

      // Validate positions
      console.log('🔍 [PROFILE SCRAPER] ===== VALIDATING POSITIONS =====');
      profileData.positions.forEach((position, index) => {
        this.log(`  - positions[${index}]:`, {
          title: position.title,
          company_name: position.company_name,
          summary: position.summary ? `${position.summary.length} chars` : 'none',
          location: position.location || 'none',
          start_date: position.start_date || 'none',
          end_date: position.end_date || 'none',
          skills: position.skills ? `${position.skills.length} skills` : 'none'
        });
        console.log(`🔍 [PROFILE SCRAPER] - positions[${index}]:`, {
          title: position.title,
          company_name: position.company_name,
          summary: position.summary ? `${position.summary.length} chars` : 'none',
          location: position.location || 'none',
          start_date: position.start_date || 'none',
          end_date: position.end_date || 'none',
          skills: position.skills ? `${position.skills.length} skills` : 'none'
        });
      });

      // Validate educations
      console.log('🔍 [PROFILE SCRAPER] ===== VALIDATING EDUCATIONS =====');
      profileData.educations.forEach((education, index) => {
        this.log(`  - educations[${index}]:`, {
          school_name: education.school_name,
          degree: education.degree,
          summary: education.summary ? `${education.summary.length} chars` : 'none',
          start_year: education.start_year || 'none',
          end_year: education.end_year || 'none',
          skills: education.skills ? `${education.skills.length} skills` : 'none'
        });
        console.log(`🔍 [PROFILE SCRAPER] - educations[${index}]:`, {
          school_name: education.school_name,
          degree: education.degree,
          summary: education.summary ? `${education.summary.length} chars` : 'none',
          start_year: education.start_year || 'none',
          end_year: education.end_year || 'none',
          skills: education.skills ? `${education.skills.length} skills` : 'none'
        });
      });

      this.log('INFO: Complete profile data being sent:', JSON.stringify(profileData, null, 2));
      console.log('🔍 [PROFILE SCRAPER] ===== COMPLETE PROFILE DATA =====');
      console.log('🔍 [PROFILE SCRAPER] Complete profile data being sent:', JSON.stringify(profileData, null, 2));

      // Check if profile already exists
      this.log('INFO: Checking if profile already exists...');
      console.log('🔍 [PROFILE SCRAPER] ===== CHECKING IF PROFILE EXISTS =====');
      console.log('🔍 [PROFILE SCRAPER] Checking if profile already exists for URL:', profileData.linkedin_url);
      const exists = await apiClient.checkProfileExists(profileData.linkedin_url);
      console.log('🔍 [PROFILE SCRAPER] Profile exists check result:', exists);

      if (exists) {
        this.log('WARNING: Profile already exists in database');
        console.log('🔍 [PROFILE SCRAPER] ⚠️ Profile already exists in database');
        showNotification('⚠️ Profile already exists in database', 'warning');
        return;
      }

      this.log('INFO: Profile is new, sending data to API...');
      console.log('🔍 [PROFILE SCRAPER] ===== SENDING DATA TO API =====');
      console.log('🔍 [PROFILE SCRAPER] Profile is new, sending data to API...');
      // Send profile data to API
      const response = await apiClient.sendProfileDataToAPI(profileData);
      console.log('🔍 [PROFILE SCRAPER] API response:', response);

      if (response.success) {
        this.log('SUCCESS: Profile data sent successfully to API');
        console.log('🔍 [PROFILE SCRAPER] ✅ SUCCESS: Profile data sent successfully to API');
        showNotification('✅ Profile data sent successfully', 'success');
      } else {
        this.log('ERROR: Failed to send profile data:', response.message);
        console.log('🔍 [PROFILE SCRAPER] ❌ ERROR: Failed to send profile data:', response.message);
        showNotification(`❌ Failed to send data: ${response.message}`, 'error');
      }

    } catch (error) {
      this.log('ERROR: Error in scrapeProfile:', error);
      console.log('🔍 [PROFILE SCRAPER] ❌ ERROR: Error in scrapeProfile:', error);
      console.log('🔍 [PROFILE SCRAPER] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      showNotification('❌ Error during scraping', 'error');
    }
  }
}

// Initialize scraper
const profileScraper = new ProfileScraper();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.action === 'ping') {
    // Respond to ping to indicate content script is ready
    sendResponse({ success: true, ready: true });
    return true;
  } else if (request.action === 'scrapeProfile') {
    profileScraper.scrapeProfile().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async response
  }
  return false;
});

// Check if we should auto-scrape after navigation
document.addEventListener('DOMContentLoaded', () => {
  const shouldAutoScrapeExperience = sessionStorage.getItem('linkedin-scraper-auto-scrape-experience');
  const shouldAutoScrapeEducation = sessionStorage.getItem('linkedin-scraper-auto-scrape-education');

  if (shouldAutoScrapeExperience === 'true' || shouldAutoScrapeEducation === 'true') {
    // Wait a bit for the page to fully load, then scrape
    setTimeout(() => {
      profileScraper.scrapeProfile();
    }, 2000);
  }
});

// If document is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  const shouldAutoScrapeExperience = sessionStorage.getItem('linkedin-scraper-auto-scrape-experience');
  const shouldAutoScrapeEducation = sessionStorage.getItem('linkedin-scraper-auto-scrape-education');

  if (shouldAutoScrapeExperience === 'true' || shouldAutoScrapeEducation === 'true') {
    // Wait a bit for the page to fully load, then scrape
    setTimeout(() => {
      profileScraper.scrapeProfile();
    }, 2000);
  }
}
