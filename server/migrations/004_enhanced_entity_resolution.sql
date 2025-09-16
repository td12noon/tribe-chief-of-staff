-- Enhanced Entity Resolution: Projects, Entity Aliases, and Manual Overrides

-- Projects table (represents Tribe <-> Customer relationships)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    customer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Project metadata
    status VARCHAR(50) DEFAULT 'active', -- active, completed, on_hold, cancelled
    project_type VARCHAR(100), -- consulting, development, partnership, etc.
    start_date DATE,
    end_date DATE,
    description TEXT,

    -- Key contacts for this project
    tribe_lead_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
    customer_lead_person_id UUID REFERENCES people(id) ON DELETE SET NULL,

    -- Project context for meeting briefs
    notable_facts TEXT[], -- key project details that matter for meetings
    current_phase VARCHAR(100), -- discovery, development, implementation, etc.

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entity aliases table (handles multiple identities for people)
CREATE TABLE IF NOT EXISTS person_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

    -- Different ways this person might appear
    alias_name VARCHAR(255) NOT NULL,
    alias_email VARCHAR(255),
    alias_slack_handle VARCHAR(255),

    -- Context where this alias is used
    context VARCHAR(100), -- 'calendar', 'email', 'slack', 'manual'

    -- Confidence and metadata
    confidence DECIMAL(3,2) DEFAULT 0.80,
    verified BOOLEAN DEFAULT false, -- manually verified vs automatically detected

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Manual entity overrides (for handling edge cases and corrections)
CREATE TABLE IF NOT EXISTS entity_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What we're overriding
    override_type VARCHAR(50) NOT NULL, -- 'person_merge', 'person_split', 'company_assignment', 'alias_link'

    -- Before state
    source_identifier VARCHAR(500) NOT NULL, -- email, name, or other identifier
    source_person_id UUID REFERENCES people(id) ON DELETE CASCADE,

    -- After state
    target_person_id UUID REFERENCES people(id) ON DELETE CASCADE,
    target_company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- Override metadata
    reason TEXT, -- why this override was needed
    confidence DECIMAL(3,2) DEFAULT 1.00, -- manual overrides are high confidence
    created_by VARCHAR(255), -- user who made the override

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company relationships (for handling complex business relationships)
CREATE TABLE IF NOT EXISTS company_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The relationship
    primary_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    related_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Type of relationship
    relationship_type VARCHAR(100) NOT NULL, -- 'parent', 'subsidiary', 'partner', 'customer', 'vendor'

    -- Relationship context
    description TEXT,
    start_date DATE,
    end_date DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate relationships
    UNIQUE(primary_company_id, related_company_id, relationship_type)
);

-- Enhanced people table with better tracking
ALTER TABLE people
ADD COLUMN IF NOT EXISTS person_type VARCHAR(50) DEFAULT 'external', -- 'internal', 'external', 'unknown'
ADD COLUMN IF NOT EXISTS primary_email VARCHAR(255), -- canonical email address
ADD COLUMN IF NOT EXISTS fuzzy_name_tokens TEXT[], -- for fuzzy matching
ADD COLUMN IF NOT EXISTS entity_status VARCHAR(50) DEFAULT 'active'; -- 'active', 'merged', 'duplicate', 'archived'

-- Enhanced companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS company_type VARCHAR(50) DEFAULT 'customer', -- 'internal', 'customer', 'partner', 'vendor', 'investor'
ADD COLUMN IF NOT EXISTS parent_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS website_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS employee_count_range VARCHAR(50); -- '1-10', '11-50', '51-200', '201-500', '500+'

-- Project participants (many-to-many between projects and people)
CREATE TABLE IF NOT EXISTS project_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

    -- Role in project
    role VARCHAR(100), -- 'lead', 'contributor', 'stakeholder', 'sponsor'
    company_side VARCHAR(50), -- 'tribe', 'customer'

    -- Participation metadata
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(project_id, person_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_customer_company_id ON projects(customer_company_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_tribe_lead ON projects(tribe_lead_person_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer_lead ON projects(customer_lead_person_id);

CREATE INDEX IF NOT EXISTS idx_person_aliases_person_id ON person_aliases(person_id);
CREATE INDEX IF NOT EXISTS idx_person_aliases_alias_email ON person_aliases(alias_email);
CREATE INDEX IF NOT EXISTS idx_person_aliases_alias_name ON person_aliases USING gin(to_tsvector('english', alias_name));

CREATE INDEX IF NOT EXISTS idx_entity_overrides_source_person ON entity_overrides(source_person_id);
CREATE INDEX IF NOT EXISTS idx_entity_overrides_target_person ON entity_overrides(target_person_id);
CREATE INDEX IF NOT EXISTS idx_entity_overrides_source_identifier ON entity_overrides(source_identifier);

CREATE INDEX IF NOT EXISTS idx_company_relationships_primary ON company_relationships(primary_company_id);
CREATE INDEX IF NOT EXISTS idx_company_relationships_related ON company_relationships(related_company_id);

CREATE INDEX IF NOT EXISTS idx_project_participants_project ON project_participants(project_id);
CREATE INDEX IF NOT EXISTS idx_project_participants_person ON project_participants(person_id);

CREATE INDEX IF NOT EXISTS idx_people_person_type ON people(person_type);
CREATE INDEX IF NOT EXISTS idx_people_primary_email ON people(primary_email);
CREATE INDEX IF NOT EXISTS idx_people_fuzzy_tokens ON people USING gin(fuzzy_name_tokens);
CREATE INDEX IF NOT EXISTS idx_people_entity_status ON people(entity_status);

CREATE INDEX IF NOT EXISTS idx_companies_company_type ON companies(company_type);
CREATE INDEX IF NOT EXISTS idx_companies_parent_company ON companies(parent_company_id);

-- Add triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert Tribe as the internal company
INSERT INTO companies (name, domain, company_type, description, industry, size_category, notable_facts) VALUES
('Tribe', 'tribe.com', 'internal', 'Internal company - Tribe team members', 'Technology', 'startup', ARRAY['Internal team', 'Meeting preparation platform'])
ON CONFLICT (name) DO NOTHING;

-- Function to generate fuzzy name tokens for matching
CREATE OR REPLACE FUNCTION generate_fuzzy_name_tokens(name_input TEXT)
RETURNS TEXT[] AS $$
DECLARE
    tokens TEXT[] := '{}';
    clean_name TEXT;
    parts TEXT[];
    part TEXT;
BEGIN
    -- Clean and normalize the name
    clean_name := lower(trim(regexp_replace(name_input, '[^a-zA-Z0-9\s]', '', 'g')));

    -- Split into parts
    parts := string_to_array(clean_name, ' ');

    -- Add full name
    tokens := array_append(tokens, clean_name);

    -- Add individual parts
    FOREACH part IN ARRAY parts
    LOOP
        IF length(part) > 1 THEN
            tokens := array_append(tokens, part);
        END IF;
    END LOOP;

    -- Add first + last initial (if applicable)
    IF array_length(parts, 1) >= 2 THEN
        tokens := array_append(tokens, parts[1] || ' ' || left(parts[array_length(parts, 1)], 1));
        tokens := array_append(tokens, left(parts[1], 1) || ' ' || parts[array_length(parts, 1)]);
    END IF;

    RETURN tokens;
END;
$$ LANGUAGE plpgsql;

-- Update existing people with fuzzy name tokens
UPDATE people
SET fuzzy_name_tokens = generate_fuzzy_name_tokens(name),
    primary_email = CASE
        WHEN array_length(emails, 1) > 0 THEN emails[1]
        ELSE NULL
    END,
    person_type = CASE
        WHEN EXISTS (
            SELECT 1 FROM companies c
            WHERE c.id = people.company_id
            AND c.company_type = 'internal'
        ) THEN 'internal'
        ELSE 'external'
    END
WHERE fuzzy_name_tokens IS NULL;

-- Trigger to automatically generate fuzzy tokens on insert/update
CREATE OR REPLACE FUNCTION update_person_fuzzy_tokens()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fuzzy_name_tokens := generate_fuzzy_name_tokens(NEW.name);

    -- Set primary email if not set
    IF NEW.primary_email IS NULL AND array_length(NEW.emails, 1) > 0 THEN
        NEW.primary_email := NEW.emails[1];
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_person_fuzzy_tokens_trigger
    BEFORE INSERT OR UPDATE ON people
    FOR EACH ROW
    EXECUTE FUNCTION update_person_fuzzy_tokens();