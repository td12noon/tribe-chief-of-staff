import { db } from '../config/database';
import {
  Person,
  Company,
  CreatePersonData,
  CreateCompanyData,
  EntityResolutionResult
} from '../types/entities';

class EntityService {
  private useDatabaseFallback = true;
  private personMemoryStore: Map<string, Person> = new Map();
  private companyMemoryStore: Map<string, Company> = new Map();

  // Find person by exact email match
  async findPersonByEmail(email: string): Promise<Person | null> {
    if (!this.useDatabaseFallback) return null;

    try {
      const query = `
        SELECT p.*, c.name as company_name, c.domain as company_domain, c.industry as company_industry
        FROM people p
        LEFT JOIN companies c ON p.company_id = c.id
        WHERE $1 = ANY(p.emails)
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

  // Find company by domain (for email-based company matching)
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

  // Basic entity resolution for calendar attendees
  async resolveAttendee(email: string, displayName?: string): Promise<EntityResolutionResult> {
    const cleanEmail = email.toLowerCase().trim();

    // Step 1: Try exact email match
    const existingPerson = await this.findPersonByEmail(cleanEmail);
    if (existingPerson) {
      // Update interaction count and last interaction
      await this.updatePersonInteraction(existingPerson.id);

      return {
        person: existingPerson,
        confidence: existingPerson.confidence,
        method: 'exact_email'
      };
    }

    // Step 2: Try to match by company domain
    const emailDomain = cleanEmail.split('@')[1];
    if (emailDomain && !this.isPersonalEmailDomain(emailDomain)) {
      const company = await this.findCompanyByDomain(emailDomain);

      if (company) {
        // Create new person linked to known company
        const newPerson = await this.createPerson({
          name: displayName || this.extractNameFromEmail(cleanEmail),
          emails: [cleanEmail],
          company_id: company.id,
          confidence: 0.75 // High confidence due to company match
        });

        return {
          person: newPerson,
          confidence: 0.75,
          method: 'domain_match',
          created_new_entity: true
        };
      }
    }

    // Step 3: Create unknown person (low confidence)
    if (displayName && displayName.trim() !== '') {
      const newPerson = await this.createPerson({
        name: displayName,
        emails: [cleanEmail],
        confidence: 0.25 // Low confidence for unknown attendee
      });

      return {
        person: newPerson,
        confidence: 0.25,
        method: 'unresolved',
        created_new_entity: true
      };
    }

    // Step 4: Unable to resolve
    return {
      confidence: 0.0,
      method: 'unresolved'
    };
  }

  // Create new person
  async createPerson(data: CreatePersonData): Promise<Person> {
    const personId = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

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
            notable_facts, aliases, confidence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
          data.confidence || 0.50
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

  // Create new company
  async createCompany(data: CreateCompanyData): Promise<Company> {
    if (!this.useDatabaseFallback) {
      throw new Error('Database required for entity creation');
    }

    try {
      const query = `
        INSERT INTO companies (name, domain, description, industry, size_category, notable_facts)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        data.name,
        data.domain || null,
        data.description || null,
        data.industry || null,
        data.size_category || null,
        data.notable_facts || []
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

  // Update person interaction tracking
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

  // Helper: Check if email domain is personal (gmail, yahoo, etc.)
  private isPersonalEmailDomain(domain: string): boolean {
    const personalDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'icloud.com', 'me.com', 'mac.com', 'aol.com'
    ];
    return personalDomains.includes(domain.toLowerCase());
  }

  // Helper: Extract name from email address
  private extractNameFromEmail(email: string): string {
    const localPart = email.split('@')[0];

    // Handle common patterns like first.last or firstname.lastname
    if (localPart.includes('.')) {
      return localPart.split('.').map(part =>
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join(' ');
    }

    // Just capitalize the local part
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }

  // Get storage status for debugging
  getStorageStatus(): { type: 'database' | 'memory', available: boolean } {
    return {
      type: this.useDatabaseFallback ? 'database' : 'memory',
      available: this.useDatabaseFallback
    };
  }
}

export const entityService = new EntityService();