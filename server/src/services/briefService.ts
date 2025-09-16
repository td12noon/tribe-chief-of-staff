import { db } from '../config/database';
import { entityService } from './entityService';
import {
  MeetingBrief,
  MeetingAttendee,
  ProvenanceLink,
  Person
} from '../types/entities';

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
}

interface BriefGenerationContext {
  event: CalendarEvent;
  resolvedAttendees: Array<{
    email: string;
    displayName?: string;
    person?: Person;
    confidence: number;
  }>;
  userEmail: string;
}

class BriefService {
  private useDatabaseFallback = true;
  private briefMemoryStore: Map<string, MeetingBrief> = new Map();

  // Generate a comprehensive meeting brief
  async generateBrief(event: CalendarEvent, userId: string, userEmail: string): Promise<MeetingBrief> {
    console.log('🤖 Generating brief for meeting:', event.summary);

    // Step 1: Resolve all attendees to people/companies
    const resolvedAttendees = await this.resolveEventAttendees(event, userEmail);

    // Step 2: Generate AI brief content
    const briefContent = await this.generateAIBrief({
      event,
      resolvedAttendees,
      userEmail
    });

    // Step 3: Save to database
    const brief = await this.saveBrief(event, userId, briefContent, resolvedAttendees);

    console.log('✅ Generated brief with', resolvedAttendees.length, 'attendees');
    return brief;
  }

  // Resolve calendar event attendees to known people
  private async resolveEventAttendees(event: CalendarEvent, userEmail: string) {
    const resolvedAttendees = [];

    if (!event.attendees) return resolvedAttendees;

    for (const attendee of event.attendees) {
      if (!attendee.email || attendee.email === userEmail) {
        continue; // Skip the user themselves
      }

      try {
        const resolution = await entityService.resolveAttendee(
          attendee.email,
          attendee.displayName
        );

        resolvedAttendees.push({
          email: attendee.email,
          displayName: attendee.displayName,
          person: resolution.person,
          confidence: resolution.confidence,
          responseStatus: attendee.responseStatus
        });

        console.log(`👤 Resolved ${attendee.email} -> ${resolution.person?.name || 'Unknown'} (${resolution.confidence})`);
      } catch (error) {
        console.warn('Failed to resolve attendee:', attendee.email, error);
        resolvedAttendees.push({
          email: attendee.email,
          displayName: attendee.displayName,
          confidence: 0.0
        });
      }
    }

    return resolvedAttendees;
  }

  // Generate AI-powered brief content using Anthropic Claude
  private async generateAIBrief(context: BriefGenerationContext) {
    const { event, resolvedAttendees } = context;

    // For now, generate a simple brief based on available data
    // TODO: Integrate with Anthropic Claude API when API key is available
    const knownAttendees = resolvedAttendees.filter(a => a.person);
    const unknownAttendees = resolvedAttendees.filter(a => !a.person);

    // Build context string
    let attendeeContext = '';
    if (knownAttendees.length > 0) {
      attendeeContext = knownAttendees.map(a => {
        const person = a.person!;
        const company = person.company ? ` from ${person.company.name}` : '';
        const title = person.title ? ` (${person.title})` : '';
        const facts = person.notable_facts.length > 0 ? `. Notable: ${person.notable_facts.join(', ')}` : '';
        return `${person.name}${company}${title}${facts}`;
      }).join('; ');
    }

    // Generate basic brief content
    const brief = {
      one_liner: this.generateOneLiner(event, knownAttendees, unknownAttendees),
      why_now: this.generateWhyNow(event, knownAttendees),
      stakes: this.generateStakes(event, knownAttendees),
      likely_goal: this.generateLikelyGoal(event, knownAttendees),
      tone_recommendation: this.generateToneRecommendation(knownAttendees),
      confidence_score: this.calculateOverallConfidence(resolvedAttendees),
      model_version: 'basic-v1' // Will be updated to claude-3-sonnet when API is integrated
    };

    console.log('📝 Generated brief content:', {
      oneLiner: brief.one_liner,
      confidence: brief.confidence_score
    });

    return brief;
  }

  // Generate one-liner description
  private generateOneLiner(event: CalendarEvent, knownAttendees: any[], unknownAttendees: any[]): string {
    if (knownAttendees.length === 0 && unknownAttendees.length === 0) {
      return `Meeting: ${event.summary || 'Untitled Meeting'}`;
    }

    if (knownAttendees.length === 1) {
      const person = knownAttendees[0].person;
      const company = person.company ? ` from ${person.company.name}` : '';
      return `Meeting with ${person.name}${company}${person.title ? ` (${person.title})` : ''}`;
    }

    if (knownAttendees.length > 1) {
      const companies = [...new Set(knownAttendees
        .map(a => a.person.company?.name)
        .filter(Boolean))];

      if (companies.length === 1) {
        return `${companies[0]} team meeting with ${knownAttendees.length} attendees`;
      } else if (companies.length > 1) {
        return `Multi-company meeting with ${companies.join(', ')}`;
      }
    }

    const totalAttendees = knownAttendees.length + unknownAttendees.length;
    return `Meeting with ${totalAttendees} attendees`;
  }

  // Generate why now context
  private generateWhyNow(event: CalendarEvent, knownAttendees: any[]): string {
    const now = new Date();
    const eventStart = event.start?.dateTime ? new Date(event.start.dateTime) : now;
    const isToday = eventStart.toDateString() === now.toDateString();

    if (knownAttendees.length === 0) {
      return `Scheduled ${isToday ? 'for today' : 'meeting'} - context to be enhanced with integration data`;
    }

    // Look for patterns in known attendees
    const companies = [...new Set(knownAttendees
      .map(a => a.person.company?.name)
      .filter(Boolean))];

    if (companies.some(c => c?.toLowerCase().includes('partner'))) {
      return 'Partnership discussion - likely exploring collaboration opportunities';
    }

    if (companies.some(c => c?.toLowerCase().includes('venture') || c?.toLowerCase().includes('capital'))) {
      return 'Investor meeting - potential funding or strategic discussion';
    }

    return 'Scheduled business meeting - context will improve with email/Slack integration';
  }

  // Generate stakes assessment
  private generateStakes(event: CalendarEvent, knownAttendees: any[]): string {
    if (knownAttendees.length === 0) {
      return 'Stakes to be determined based on meeting context';
    }

    const companies = knownAttendees.map(a => a.person.company?.name).filter(Boolean);
    const industries = [...new Set(knownAttendees
      .map(a => a.person.company?.industry)
      .filter(Boolean))];

    if (industries.includes('Venture Capital')) {
      return 'High - potential funding opportunity or strategic partnership';
    }

    if (companies.length > 1) {
      return 'Medium-High - cross-company alignment and relationship building';
    }

    return 'Business relationship and potential collaboration';
  }

  // Generate likely meeting goal
  private generateLikelyGoal(event: CalendarEvent, knownAttendees: any[]): string {
    const title = event.summary?.toLowerCase() || '';

    if (title.includes('intro') || title.includes('introduction')) {
      return 'Initial introduction and relationship building';
    }

    if (title.includes('strategy') || title.includes('planning')) {
      return 'Strategic planning and alignment discussion';
    }

    if (title.includes('review') || title.includes('sync')) {
      return 'Progress review and synchronization';
    }

    if (knownAttendees.some(a => a.person.company?.industry === 'Venture Capital')) {
      return 'Investment discussion and company evaluation';
    }

    return 'Business discussion and relationship development';
  }

  // Generate tone recommendation
  private generateToneRecommendation(knownAttendees: any[]): string {
    if (knownAttendees.length === 0) {
      return 'Professional and engaging';
    }

    const industries = knownAttendees.map(a => a.person.company?.industry).filter(Boolean);

    if (industries.includes('Venture Capital')) {
      return 'Professional but engaging - focus on vision and metrics';
    }

    if (knownAttendees.some(a => a.person.title?.includes('CEO') || a.person.title?.includes('Founder'))) {
      return 'Executive-level - strategic and relationship-focused';
    }

    return 'Professional and collaborative';
  }

  // Calculate overall confidence score
  private calculateOverallConfidence(resolvedAttendees: any[]): number {
    if (resolvedAttendees.length === 0) return 0.1;

    const avgConfidence = resolvedAttendees.reduce((sum, a) => sum + a.confidence, 0) / resolvedAttendees.length;
    return Math.round(avgConfidence * 100) / 100; // Round to 2 decimal places
  }

  // Save brief to database or memory store
  private async saveBrief(
    event: CalendarEvent,
    userId: string,
    briefContent: any,
    resolvedAttendees: any[]
  ): Promise<MeetingBrief> {
    const briefId = `brief_${event.id}`;
    const now = new Date();

    const brief: MeetingBrief = {
      id: briefId,
      calendar_event_id: event.id!,
      user_id: userId,
      one_liner: briefContent.one_liner,
      why_now: briefContent.why_now,
      stakes: briefContent.stakes,
      likely_goal: briefContent.likely_goal,
      tone_recommendation: briefContent.tone_recommendation,
      generated_at: now,
      model_version: briefContent.model_version,
      confidence_score: briefContent.confidence_score,
      source_count: 0,
      has_email_context: false,
      has_slack_context: false,
      has_call_context: false,
      created_at: now,
      updated_at: now,
      attendees: resolvedAttendees.map(a => ({
        id: `attendee_${event.id}_${a.email}`,
        brief_id: briefId,
        person_id: a.person?.id,
        email: a.email,
        display_name: a.displayName,
        response_status: a.responseStatus || 'needs-action',
        resolution_status: a.person ? 'resolved' : 'unresolved',
        resolution_confidence: a.confidence,
        created_at: now,
        person: a.person
      } as MeetingAttendee))
    };

    if (this.useDatabaseFallback) {
      try {
        // Try to save to database
        const briefQuery = `
          INSERT INTO meeting_briefs (
            calendar_event_id, user_id, one_liner, why_now, stakes,
            likely_goal, tone_recommendation, model_version, confidence_score,
            source_count, has_email_context, has_slack_context, has_call_context
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (calendar_event_id) DO UPDATE SET
            one_liner = EXCLUDED.one_liner,
            why_now = EXCLUDED.why_now,
            stakes = EXCLUDED.stakes,
            likely_goal = EXCLUDED.likely_goal,
            tone_recommendation = EXCLUDED.tone_recommendation,
            model_version = EXCLUDED.model_version,
            confidence_score = EXCLUDED.confidence_score,
            source_count = EXCLUDED.source_count,
            updated_at = NOW()
          RETURNING *
        `;

        const briefResult = await db.query(briefQuery, [
          event.id,
          userId,
          briefContent.one_liner,
          briefContent.why_now,
          briefContent.stakes,
          briefContent.likely_goal,
          briefContent.tone_recommendation,
          briefContent.model_version,
          briefContent.confidence_score,
          0, // source_count - will be updated when we add email/slack
          false, // has_email_context
          false, // has_slack_context
          false  // has_call_context
        ]);

        const dbBrief = briefResult.rows[0];
        await this.saveAttendees(dbBrief.id, resolvedAttendees);

        console.log('💾 Brief saved to database');
        return brief;

      } catch (error) {
        console.warn('Database unavailable, using memory store for brief:', error);
        this.useDatabaseFallback = false;
      }
    }

    // Fallback to memory store
    this.briefMemoryStore.set(event.id!, brief);
    console.log('⚠️  Brief saved to memory store');
    return brief;
  }

  // Save meeting attendees
  private async saveAttendees(briefId: string, resolvedAttendees: any[]) {
    if (!this.useDatabaseFallback) return;

    try {
      // Clear existing attendees for this brief
      await db.query('DELETE FROM meeting_attendees WHERE brief_id = $1', [briefId]);

      // Insert new attendees
      for (const attendee of resolvedAttendees) {
        await db.query(`
          INSERT INTO meeting_attendees (
            brief_id, person_id, email, display_name, response_status,
            resolution_status, resolution_confidence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          briefId,
          attendee.person?.id || null,
          attendee.email,
          attendee.displayName || null,
          attendee.responseStatus || 'needs-action',
          attendee.person ? 'resolved' : 'unresolved',
          attendee.confidence
        ]);
      }

      console.log(`💾 Saved ${resolvedAttendees.length} attendees for brief`);
    } catch (error) {
      console.error('Failed to save attendees:', error);
    }
  }

  // Get existing brief by calendar event ID
  async getBriefByEventId(eventId: string): Promise<MeetingBrief | null> {
    if (this.useDatabaseFallback) {
      try {
        const result = await db.query(
          'SELECT * FROM meeting_briefs WHERE calendar_event_id = $1',
          [eventId]
        );
        return result.rows[0] || null;
      } catch (error) {
        console.warn('Database unavailable for brief lookup:', error);
        this.useDatabaseFallback = false;
      }
    }

    // Fallback to memory store
    return this.briefMemoryStore.get(eventId) || null;
  }
}

export const briefService = new BriefService();