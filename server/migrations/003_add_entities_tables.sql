-- Add person and company entities for meeting brief generation

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255), -- company.com domain for email matching
    description TEXT,
    industry VARCHAR(255),
    size_category VARCHAR(50), -- startup, growth, enterprise, etc.
    notable_facts TEXT[], -- array of notable facts about the company

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- People table
CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    emails TEXT[] NOT NULL, -- array of known email addresses
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    title VARCHAR(255),

    -- Social/communication handles
    slack_handles TEXT[], -- array of slack handles (@username)
    linkedin_url VARCHAR(500),

    -- Profile information
    notable_facts TEXT[], -- array of notable facts about the person
    aliases TEXT[], -- alternative names/nicknames

    -- Entity resolution metadata
    confidence DECIMAL(3,2) DEFAULT 0.50, -- 0.0 to 1.0 confidence score
    last_interaction DATE, -- most recent interaction date
    interaction_count INTEGER DEFAULT 0, -- number of times mentioned/met

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meeting briefs table (enhanced from mock data structure)
CREATE TABLE IF NOT EXISTS meeting_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_event_id VARCHAR(255) NOT NULL UNIQUE, -- Google Calendar event ID
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Brief content
    one_liner TEXT,
    why_now TEXT,
    stakes TEXT,
    likely_goal TEXT,
    tone_recommendation TEXT,

    -- AI generation metadata
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    model_version VARCHAR(100), -- e.g., "claude-3-sonnet-20240229"
    confidence_score DECIMAL(3,2), -- overall confidence in the brief

    -- Source tracking
    source_count INTEGER DEFAULT 0, -- number of sources used
    has_email_context BOOLEAN DEFAULT false,
    has_slack_context BOOLEAN DEFAULT false,
    has_call_context BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Provenance links table (tracks sources for brief information)
CREATE TABLE IF NOT EXISTS provenance_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id UUID NOT NULL REFERENCES meeting_briefs(id) ON DELETE CASCADE,

    -- Source information
    source_type VARCHAR(50) NOT NULL, -- 'email', 'slack', 'call', 'manual'
    source_url TEXT, -- link back to original source
    snippet TEXT NOT NULL, -- relevant quote or summary
    confidence DECIMAL(3,2) DEFAULT 0.50,

    -- Timestamps
    source_timestamp TIMESTAMP WITH TIME ZONE, -- when original source was created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for meeting attendees (links calendar events to people)
CREATE TABLE IF NOT EXISTS meeting_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id UUID NOT NULL REFERENCES meeting_briefs(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL, -- null if unresolved

    -- Raw attendee data from calendar
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    response_status VARCHAR(50), -- accepted, declined, tentative, needs-action

    -- Entity resolution status
    resolution_status VARCHAR(50) DEFAULT 'unresolved', -- resolved, unresolved, manual
    resolution_confidence DECIMAL(3,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies USING gin(to_tsvector('english', name));

CREATE INDEX IF NOT EXISTS idx_people_emails ON people USING gin(emails);
CREATE INDEX IF NOT EXISTS idx_people_name ON people USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_people_company_id ON people(company_id);
CREATE INDEX IF NOT EXISTS idx_people_last_interaction ON people(last_interaction DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_briefs_calendar_event_id ON meeting_briefs(calendar_event_id);
CREATE INDEX IF NOT EXISTS idx_meeting_briefs_user_id ON meeting_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_briefs_generated_at ON meeting_briefs(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_provenance_links_brief_id ON provenance_links(brief_id);
CREATE INDEX IF NOT EXISTS idx_provenance_links_source_type ON provenance_links(source_type);

CREATE INDEX IF NOT EXISTS idx_meeting_attendees_brief_id ON meeting_attendees(brief_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_person_id ON meeting_attendees(person_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_email ON meeting_attendees(email);

-- Add triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meeting_briefs_updated_at BEFORE UPDATE ON meeting_briefs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some sample data for testing
INSERT INTO companies (name, domain, description, industry, size_category, notable_facts) VALUES
('Insight Partners', 'insightpartners.com', 'Leading VC firm specializing in growth-stage software companies', 'Venture Capital', 'enterprise', ARRAY['$20B+ assets under management', 'Portfolio includes Twitter, Shopify, Qualtrics']),
('Scale Venture Partners', 'scalevp.com', 'Growth equity firm focused on B2B technology companies', 'Venture Capital', 'growth', ARRAY['Focus on Series A-C rounds', 'Enterprise software expertise']);

INSERT INTO people (name, emails, company_id, title, notable_facts) VALUES
('Sarah Chen', ARRAY['sarah@insightpartners.com', 's.chen@insight.com'],
 (SELECT id FROM companies WHERE name = 'Insight Partners'),
 'Principal',
 ARRAY['Previously at Goldman Sachs tech investment banking', 'Stanford MBA', 'Leads enterprise software investments']),
('Alex Thompson', ARRAY['alex@scalevp.com', 'athompson@scale.com'],
 (SELECT id FROM companies WHERE name = 'Scale Venture Partners'),
 'Partner',
 ARRAY['Former startup founder (acquired by Salesforce)', '15+ years in B2B SaaS']);