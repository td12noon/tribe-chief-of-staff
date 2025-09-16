export interface Company {
  id: string;
  name: string;
  domain?: string;
  description?: string;
  industry?: string;
  size_category?: string;
  notable_facts: string[];
  created_at: Date;
  updated_at: Date;
}

export interface Person {
  id: string;
  name: string;
  emails: string[];
  company_id?: string;
  title?: string;
  slack_handles: string[];
  linkedin_url?: string;
  notable_facts: string[];
  aliases: string[];
  confidence: number;
  last_interaction?: Date;
  interaction_count: number;
  created_at: Date;
  updated_at: Date;
  // Joined data
  company?: Company;
}

export interface MeetingBrief {
  id: string;
  calendar_event_id: string;
  user_id: string;
  one_liner?: string;
  why_now?: string;
  stakes?: string;
  likely_goal?: string;
  tone_recommendation?: string;
  generated_at: Date;
  model_version?: string;
  confidence_score?: number;
  source_count: number;
  has_email_context: boolean;
  has_slack_context: boolean;
  has_call_context: boolean;
  created_at: Date;
  updated_at: Date;
  // Joined data
  attendees?: MeetingAttendee[];
  provenance_links?: ProvenanceLink[];
}

export interface ProvenanceLink {
  id: string;
  brief_id: string;
  source_type: 'email' | 'slack' | 'call' | 'manual';
  source_url?: string;
  snippet: string;
  confidence: number;
  source_timestamp?: Date;
  created_at: Date;
}

export interface MeetingAttendee {
  id: string;
  brief_id: string;
  person_id?: string;
  email: string;
  display_name?: string;
  response_status?: string;
  resolution_status: 'resolved' | 'unresolved' | 'manual';
  resolution_confidence?: number;
  created_at: Date;
  // Joined data
  person?: Person;
}

export interface CreateCompanyData {
  name: string;
  domain?: string;
  description?: string;
  industry?: string;
  size_category?: string;
  notable_facts?: string[];
}

export interface CreatePersonData {
  name: string;
  emails: string[];
  company_id?: string;
  title?: string;
  slack_handles?: string[];
  linkedin_url?: string;
  notable_facts?: string[];
  aliases?: string[];
  confidence?: number;
  person_type?: 'internal' | 'external' | 'unknown';
}

export interface EntityResolutionResult {
  person?: Person;
  confidence: number;
  method: 'exact_email' | 'domain_match' | 'name_similarity' | 'manual' | 'unresolved' |
          'manual_override' | 'fuzzy_name' | 'alias_match' | 'internal_inference';
  created_new_entity?: boolean;
}