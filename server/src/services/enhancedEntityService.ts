import { db } from '../config/database';
import {
  Person,
  Company,
  CreatePersonData,
  CreateCompanyData,
  EntityResolutionResult
} from '../types/entities';
import {
  MatchCandidate,
  FuzzyMatchResult,
  findBestMatches,
  generateFuzzyTokens,
  extractCompanyFromEmailDomain
} from '../utils/fuzzyMatching';

interface AliasRecord {
  id: string;
  personId: string;
  aliasName: string;
  aliasEmail?: string;
  context: string;
  confidence: number;
  verified: boolean;
}

interface ManualOverride {
  id: string;
  overrideType: string;
  sourceIdentifier: string;
  targetPersonId?: string;
  targetCompanyId?: string;
  reason: string;
  confidence: number;
}

class EnhancedEntityService {
  private useDatabaseFallback = true;
  private personMemoryStore: Map<string, Person> = new Map();
  private companyMemoryStore: Map<string, Company> = new Map();

  // Enhanced attendee resolution with fuzzy matching and alias detection
  async resolveAttendee(email: string, displayName?: string): Promise<EntityResolutionResult> {
    const cleanEmail = email.toLowerCase().trim();

    console.log(`🔍 Enhanced resolving: ${cleanEmail} (${displayName || 'no display name'})`);

    // Step 1: Check for manual overrides first
    const override = await this.checkManualOverride(cleanEmail, displayName);
    if (override) {
      console.log('📌 Using manual override for', cleanEmail);
      return override;
    }

    // Step 2: Exact email match (highest confidence)
    const exactMatch = await this.findPersonByEmail(cleanEmail);
    if (exactMatch) {
      await this.updatePersonInteraction(exactMatch.id);
      console.log(`✅ Exact email match: ${exactMatch.name} (${exactMatch.confidence})`);
      return {
        person: exactMatch,
        confidence: exactMatch.confidence,
        method: 'exact_email'
      };
    }

    // Step 3: Fuzzy matching against all known people
    const fuzzyMatch = await this.performFuzzyMatching(cleanEmail, displayName);
    if (fuzzyMatch && fuzzyMatch.person) {
      console.log(`🎯 Fuzzy match: ${fuzzyMatch.person.name} (${fuzzyMatch.confidence}, ${fuzzyMatch.method})`);
      return fuzzyMatch;
    }

    // Step 4: Company domain matching
    const companyMatch = await this.resolveByCompanyDomain(cleanEmail, displayName);
    if (companyMatch && companyMatch.person) {
      console.log(`🏢 Company domain match: ${companyMatch.person.name} (${companyMatch.confidence})`);
      return companyMatch;
    }

    // Step 5: Create new person with smart company inference
    const newPersonMatch = await this.createSmartNewPerson(cleanEmail, displayName);
    console.log(`👤 Created new person: ${newPersonMatch.person?.name} (${newPersonMatch.confidence})`);
    return newPersonMatch;
  }

  // Check for manual overrides
  private async checkManualOverride(email: string, displayName?: string): Promise<EntityResolutionResult | null> {
    if (!this.useDatabaseFallback) return null;

    try {
      const query = `
        SELECT eo.*, p.*
        FROM entity_overrides eo
        LEFT JOIN people p ON eo.target_person_id = p.id
        WHERE eo.source_identifier = $1
        OR (eo.source_identifier = $2 AND $2 IS NOT NULL)
        ORDER BY eo.created_at DESC
        LIMIT 1
      `;

      const result = await db.query(query, [email, displayName]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      if (!row.target_person_id) return null;

      const person = await this.findPersonById(row.target_person_id);
      if (!person) return null;

      return {
        person,
        confidence: parseFloat(row.confidence) || 1.0,
        method: 'manual_override'
      };
    } catch (error) {
      console.warn('Error checking manual overrides:', error);
      return null;
    }
  }

  // Perform fuzzy matching against all known people
  private async performFuzzyMatching(email: string, displayName?: string): Promise<EntityResolutionResult | null> {
    if (!this.useDatabaseFallback || !displayName) return null;

    try {
      // Get all people with their aliases for fuzzy matching
      const query = `
        SELECT DISTINCT p.*,
               array_agg(DISTINCT pa.alias_name) FILTER (WHERE pa.alias_name IS NOT NULL) as alias_names,
               array_agg(DISTINCT pa.alias_email) FILTER (WHERE pa.alias_email IS NOT NULL) as alias_emails,
               c.name as company_name, c.domain as company_domain, c.industry as company_industry
        FROM people p
        LEFT JOIN person_aliases pa ON p.id = pa.person_id
        LEFT JOIN companies c ON p.company_id = c.id
        WHERE p.entity_status = 'active'
        GROUP BY p.id, c.name, c.domain, c.industry
        ORDER BY p.confidence DESC, p.last_interaction DESC NULLS LAST
      `;

      const result = await db.query(query);

      if (result.rows.length === 0) return null;

      // Convert to match candidates
      const candidates: MatchCandidate[] = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.emails?.[0], // Primary email
        aliases: [
          ...(row.alias_names || []),
          ...(row.emails || []).slice(1), // Additional emails as aliases
          ...(row.alias_emails || [])
        ].filter(Boolean),
        confidence: parseFloat(row.confidence)
      }));

      // Perform fuzzy matching
      const matches = findBestMatches(
        { email, displayName },
        candidates,
        0.7 // Threshold for fuzzy matching
      );

      if (matches.length === 0) return null;

      const bestMatch = matches[0];

      // Get full person object
      const person = await this.findPersonById(bestMatch.candidate.id);
      if (!person) return null;

      // Update interaction
      await this.updatePersonInteraction(person.id);

      // Create alias record if this is a new way to identify this person
      await this.createAliasRecord(person.id, displayName, email, 'calendar', bestMatch.score);

      return {
        person,
        confidence: bestMatch.score,
        method: bestMatch.matchType === 'alias' ? 'alias_match' : 'fuzzy_name'
      };

    } catch (error) {
      console.warn('Error in fuzzy matching:', error);
      return null;
    }
  }

  // Resolve by company domain matching
  private async resolveByCompanyDomain(email: string, displayName?: string): Promise<EntityResolutionResult | null> {
    const emailDomain = email.split('@')[1];
    if (!emailDomain || this.isPersonalEmailDomain(emailDomain)) return null;

    try {
      const company = await this.findCompanyByDomain(emailDomain);
      if (!company) {
        // Try to create new company based on domain
        const inferredCompanyName = extractCompanyFromEmailDomain(email);
        if (inferredCompanyName) {
          const newCompany = await this.createCompany({
            name: inferredCompanyName,
            domain: emailDomain,
            company_type: 'customer', // Default to customer
            description: `Auto-created from email domain: ${emailDomain}`
          });

          const newPerson = await this.createPerson({
            name: displayName || this.extractNameFromEmail(email),
            emails: [email],
            company_id: newCompany.id,
            person_type: 'external',
            confidence: 0.7
          });

          return {
            person: newPerson,
            confidence: 0.7,
            method: 'domain_match',
            created_new_entity: true
          };
        }
        return null;
      }

      // Create new person linked to known company
      const newPerson = await this.createPerson({
        name: displayName || this.extractNameFromEmail(email),
        emails: [email],
        company_id: company.id,
        person_type: 'external',
        confidence: 0.75
      });

      return {
        person: newPerson,
        confidence: 0.75,
        method: 'domain_match',
        created_new_entity: true
      };

    } catch (error) {
      console.warn('Error in company domain matching:', error);
      return null;
    }
  }

  // Create new person with smart company inference
  private async createSmartNewPerson(email: string, displayName?: string): Promise<EntityResolutionResult> {
    const emailDomain = email.split('@')[1];
    const name = displayName || this.extractNameFromEmail(email);

    // Check if this might be an internal Tribe email
    let personType: 'internal' | 'external' = 'external';
    let companyId: string | undefined;
    let confidence = 0.25; // Low confidence for unknown

    if (emailDomain && emailDomain.toLowerCase().includes('tribe')) {
      personType = 'internal';
      confidence = 0.8;

      // Try to find Tribe company
      const tribeCompany = await this.findTribeCompany();
      if (tribeCompany) {
        companyId = tribeCompany.id;
      }
    }

    try {
      const newPerson = await this.createPerson({
        name,
        emails: [email],
        company_id: companyId,
        person_type: personType,
        confidence
      });

      return {
        person: newPerson,
        confidence,
        method: personType === 'internal' ? 'internal_inference' : 'unresolved',
        created_new_entity: true
      };
    } catch (error) {
      console.error('Error creating new person:', error);
      return {
        confidence: 0.0,
        method: 'unresolved'
      };
    }
  }

  // Create an alias record for a person
  private async createAliasRecord(
    personId: string,
    aliasName?: string,
    aliasEmail?: string,
    context: string = 'calendar',
    confidence: number = 0.8
  ): Promise<void> {
    if (!this.useDatabaseFallback || (!aliasName && !aliasEmail)) return;

    try {
      // Check if alias already exists
      const existingQuery = `
        SELECT id FROM person_aliases
        WHERE person_id = $1
        AND (alias_name = $2 OR alias_email = $3)
      `;

      const existing = await db.query(existingQuery, [personId, aliasName, aliasEmail]);
      if (existing.rows.length > 0) return; // Already exists

      // Insert new alias
      const insertQuery = `
        INSERT INTO person_aliases (person_id, alias_name, alias_email, context, confidence)
        VALUES ($1, $2, $3, $4, $5)
      `;

      await db.query(insertQuery, [personId, aliasName, aliasEmail, context, confidence]);
      console.log(`📝 Created alias for person ${personId}: ${aliasName || aliasEmail}`);
    } catch (error) {
      console.warn('Error creating alias record:', error);
    }
  }

  // Find person by ID
  private async findPersonById(id: string): Promise<Person | null> {
    if (!this.useDatabaseFallback) return null;

    try {
      const query = `
        SELECT p.*, c.name as company_name, c.domain as company_domain, c.industry as company_industry
        FROM people p
        LEFT JOIN companies c ON p.company_id = c.id
        WHERE p.id = $1
      `;

      const result = await db.query(query, [id]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        emails: row.emails,
        company_id: row.company_id,
        title: row.title,
        slack_handles: row.slack_handles || [],
        linkedin_url: row.linkedin_url,
        notable_facts: row.notable_facts || [],
        aliases: row.aliases || [],
        confidence: parseFloat(row.confidence),
        last_interaction: row.last_interaction,
        interaction_count: row.interaction_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
        company: row.company_name ? {
          id: row.company_id,
          name: row.company_name,
          domain: row.company_domain,
          industry: row.company_industry,
          description: '',
          size_category: '',
          notable_facts: [],
          created_at: new Date(),
          updated_at: new Date()
        } : undefined
      };
    } catch (error) {
      console.warn('Error finding person by ID:', error);
      return null;
    }
  }

  // Find Tribe company (internal company)
  private async findTribeCompany(): Promise<Company | null> {
    if (!this.useDatabaseFallback) return null;

    try {
      const result = await db.query(
        "SELECT * FROM companies WHERE company_type = 'internal' OR name ILIKE '%tribe%' ORDER BY company_type LIMIT 1"
      );
      return result.rows[0] || null;
    } catch (error) {
      console.warn('Error finding Tribe company:', error);
      return null;
    }
  }

  // All the existing methods from the original entityService
  async findPersonByEmail(email: string): Promise<Person | null> {
    if (!this.useDatabaseFallback) return null;

    try {
      const query = `
        SELECT p.*, c.name as company_name, c.domain as company_domain, c.industry as company_industry
        FROM people p
        LEFT JOIN companies c ON p.company_id = c.id
        WHERE $1 = ANY(p.emails) AND p.entity_status = 'active'
        ORDER BY p.confidence DESC, p.last_interaction DESC NULLS LAST
        LIMIT 1
      `;

      const result = await db.query(query, [email.toLowerCase()]);

      if (result.rows[0]) {
        const row = result.rows[0];
        return {
          id: row.id,
          name: row.name,
          emails: row.emails,
          company_id: row.company_id,
          title: row.title,
          slack_handles: row.slack_handles || [],
          linkedin_url: row.linkedin_url,
          notable_facts: row.notable_facts || [],
          aliases: row.aliases || [],
          confidence: parseFloat(row.confidence),
          last_interaction: row.last_interaction,
          interaction_count: row.interaction_count,
          created_at: row.created_at,
          updated_at: row.updated_at,
          company: row.company_name ? {
            id: row.company_id,
            name: row.company_name,
            domain: row.company_domain,
            industry: row.company_industry,
            description: '',
            size_category: '',
            notable_facts: [],
            created_at: new Date(),
            updated_at: new Date()
          } : undefined
        };
      }
      return null;
    } catch (error) {
      console.warn('Database unavailable for entity lookup:', error);
      this.useDatabaseFallback = false;
      return null;
    }
  }

  async findCompanyByDomain(domain: string): Promise<Company | null> {
    if (!this.useDatabaseFallback) return null;

    try {
      const result = await db.query(
        'SELECT * FROM companies WHERE domain = $1',
        [domain.toLowerCase()]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.warn('Database unavailable for company lookup:', error);
      return null;
    }
  }

  async createPerson(data: CreatePersonData): Promise<Person> {
    const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // Generate fuzzy tokens for the name
    const fuzzyTokens = generateFuzzyTokens(data.name);

    const person: Person = {
      id: personId,
      name: data.name,
      emails: data.emails,
      company_id: data.company_id,
      title: data.title,
      slack_handles: data.slack_handles || [],
      linkedin_url: data.linkedin_url,
      notable_facts: data.notable_facts || [],
      aliases: data.aliases || [],
      confidence: data.confidence || 0.50,
      last_interaction: undefined,
      interaction_count: 0,
      created_at: now,
      updated_at: now
    };

    if (this.useDatabaseFallback) {
      try {
        const query = `
          INSERT INTO people (
            name, emails, company_id, title, slack_handles, linkedin_url,
            notable_facts, aliases, confidence, person_type, primary_email,
            fuzzy_name_tokens, entity_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `;

        const values = [
          data.name,
          data.emails,
          data.company_id || null,
          data.title || null,
          data.slack_handles || [],
          data.linkedin_url || null,
          data.notable_facts || [],
          data.aliases || [],
          data.confidence || 0.50,
          (data as any).person_type || 'external',
          data.emails[0] || null,
          fuzzyTokens,
          'active'
        ];

        const result = await db.query(query, values);
        const dbPerson = result.rows[0];

        console.log('✅ Created new person in database:', dbPerson.name, dbPerson.emails);
        return {
          id: dbPerson.id,
          name: dbPerson.name,
          emails: dbPerson.emails,
          company_id: dbPerson.company_id,
          title: dbPerson.title,
          slack_handles: dbPerson.slack_handles || [],
          linkedin_url: dbPerson.linkedin_url,
          notable_facts: dbPerson.notable_facts || [],
          aliases: dbPerson.aliases || [],
          confidence: parseFloat(dbPerson.confidence),
          last_interaction: dbPerson.last_interaction,
          interaction_count: dbPerson.interaction_count,
          created_at: dbPerson.created_at,
          updated_at: dbPerson.updated_at
        };
      } catch (error) {
        console.warn('Database unavailable for person creation:', error);
        this.useDatabaseFallback = false;
      }
    }

    // Fallback to memory store
    this.personMemoryStore.set(personId, person);
    console.log('⚠️  Created new person in memory store:', person.name, person.emails);
    return person;
  }

  async createCompany(data: CreateCompanyData & { company_type?: string }): Promise<Company> {
    if (!this.useDatabaseFallback) {
      throw new Error('Database required for entity creation');
    }

    try {
      const query = `
        INSERT INTO companies (name, domain, description, industry, size_category, notable_facts, company_type, website_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        data.name,
        data.domain || null,
        data.description || null,
        data.industry || null,
        data.size_category || null,
        data.notable_facts || [],
        data.company_type || 'customer',
        data.domain ? `https://${data.domain}` : null
      ];

      const result = await db.query(query, values);
      const company = result.rows[0];

      console.log('✅ Created new company:', company.name);
      return company;
    } catch (error) {
      console.error('Failed to create company:', error);
      throw error;
    }
  }

  private async updatePersonInteraction(personId: string): Promise<void> {
    if (!this.useDatabaseFallback) return;

    try {
      await db.query(`
        UPDATE people
        SET
          last_interaction = CURRENT_DATE,
          interaction_count = interaction_count + 1,
          updated_at = NOW()
        WHERE id = $1
      `, [personId]);
    } catch (error) {
      console.warn('Failed to update person interaction:', error);
    }
  }

  private isPersonalEmailDomain(domain: string): boolean {
    const personalDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com',
      'fastmail.com', 'hey.com'
    ];
    return personalDomains.includes(domain.toLowerCase());
  }

  private extractNameFromEmail(email: string): string {
    const localPart = email.split('@')[0];

    if (localPart.includes('.')) {
      return localPart.split('.').map(part =>
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join(' ');
    }

    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }

  getStorageStatus(): { type: 'database' | 'memory', available: boolean } {
    return {
      type: this.useDatabaseFallback ? 'database' : 'memory',
      available: this.useDatabaseFallback
    };
  }
}

export const enhancedEntityService = new EnhancedEntityService();