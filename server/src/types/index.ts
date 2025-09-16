// Common type definitions for the backend

export interface Person {
  id: string;
  emails: string[];
  slackHandles: string[];
  name: string;
  company: string;
  title: string;
  notableFacts: string[];
  aliases: string[];
  confidence: number;
}

export interface MeetingBrief {
  eventId: string;
  oneLiner: string;
  whyNow: string;
  stakes: string;
  likelyGoal: string;
  toneRecommendation: string;
  provenanceLinks: ProvenanceLink[];
  attendees: Person[];
  generatedAt: Date;
}

export interface ProvenanceLink {
  type: 'email' | 'slack' | 'call';
  url: string;
  snippet: string;
  timestamp?: Date;
  confidence: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  location?: string;
  created: string;
  updated: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}