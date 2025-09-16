-- Initial schema for Meeting Pre-Briefs system

-- People/Company profiles table
CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    title VARCHAR(255),
    emails TEXT[] DEFAULT '{}',
    slack_handles TEXT[] DEFAULT '{}',
    notable_facts TEXT[] DEFAULT '{}',
    aliases TEXT[] DEFAULT '{}',
    confidence DECIMAL(3,2) DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id VARCHAR(255) PRIMARY KEY, -- Google Calendar event ID
    summary VARCHAR(500) NOT NULL,
    description TEXT,
    start_datetime TIMESTAMP WITH TIME ZONE,
    end_datetime TIMESTAMP WITH TIME ZONE,
    location VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event attendees junction table
CREATE TABLE IF NOT EXISTS event_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) REFERENCES calendar_events(id) ON DELETE CASCADE,
    person_id UUID REFERENCES people(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    response_status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, person_id)
);

-- Meeting briefs table
CREATE TABLE IF NOT EXISTS meeting_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) REFERENCES calendar_events(id) ON DELETE CASCADE UNIQUE,
    one_liner TEXT,
    why_now TEXT,
    stakes TEXT,
    likely_goal TEXT,
    tone_recommendation VARCHAR(255),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Provenance links table
CREATE TABLE IF NOT EXISTS provenance_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id UUID REFERENCES meeting_briefs(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'slack', 'call')),
    url TEXT NOT NULL,
    snippet TEXT,
    timestamp TIMESTAMP WITH TIME ZONE,
    confidence DECIMAL(3,2) DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_people_emails ON people USING GIN(emails);
CREATE INDEX IF NOT EXISTS idx_people_slack_handles ON people USING GIN(slack_handles);
CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);
CREATE INDEX IF NOT EXISTS idx_people_company ON people(company);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_person_id ON event_attendees(person_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_email ON event_attendees(email);

CREATE INDEX IF NOT EXISTS idx_meeting_briefs_event_id ON meeting_briefs(event_id);
CREATE INDEX IF NOT EXISTS idx_provenance_links_brief_id ON provenance_links(brief_id);
CREATE INDEX IF NOT EXISTS idx_provenance_links_type ON provenance_links(type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meeting_briefs_updated_at BEFORE UPDATE ON meeting_briefs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();