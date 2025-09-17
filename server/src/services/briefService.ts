import { db } from '../config/database';
import { enhancedEntityService } from './enhancedEntityService';
import { aiService } from './aiService';
import { GmailService } from './gmailService';
import { google } from 'googleapis';
import {
  MeetingBrief,
  MeetingAttendee,
  ProvenanceLink,
  Person
} from '../types/entities';

interface CalendarEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  start?: { dateTime?: string | null; date?: string | null };
  end?: { dateTime?: string | null; date?: string | null };
  attendees?: Array<{
    email?: string | null;
    displayName?: string | null;
    responseStatus?: string | null;
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
  async generateBrief(event: CalendarEvent, userId: string, userEmail: string, userTokens?: { access_token: string, refresh_token: string }): Promise<MeetingBrief> {
    console.log('🤖 Generating brief for meeting:', event.summary);

    // Step 1: Resolve all attendees to people/companies
    const resolvedAttendees = await this.resolveEventAttendees(event, userEmail);

    // Step 2: Gather email context with enhanced search
    let emailContext: ProvenanceLink[] = [];
    console.log(`🔍 Email context check: userTokens=${!!userTokens}, attendees=${resolvedAttendees.length}`);
    if (userTokens && resolvedAttendees.length > 0) {
      try {
        console.log(`📧 Starting enhanced email context gathering...`);
        emailContext = await this.gatherEmailContext(resolvedAttendees, userEmail, userTokens, event);
        console.log(`📧 Found ${emailContext.length} relevant email contexts`);
      } catch (error) {
        console.warn('Failed to gather email context:', error);
      }
    } else {
      console.log(`⚠️ Skipping email context: userTokens=${!!userTokens}, attendees=${resolvedAttendees.length}`);
    }

    // Step 3: Generate AI brief content
    const briefContent = await this.generateAIBrief({
      event,
      resolvedAttendees,
      userEmail
    });

    // Step 4: Save to database with email context
    const brief = await this.saveBrief(event, userId, briefContent, resolvedAttendees, emailContext);

    console.log('✅ Generated brief with', resolvedAttendees.length, 'attendees and', emailContext.length, 'email sources');
    return brief;
  }

  // Resolve calendar event attendees to known people
  private async resolveEventAttendees(event: CalendarEvent, userEmail: string) {
    const resolvedAttendees: Array<{
      email: string;
      displayName?: string;
      person?: Person;
      confidence: number;
      responseStatus?: string;
    }> = [];

    if (!event.attendees) return resolvedAttendees;

    for (const attendee of event.attendees) {
      if (!attendee.email || attendee.email === userEmail) {
        continue; // Skip the user themselves
      }

      try {
        const resolution = await enhancedEntityService.resolveAttendee(
          attendee.email || '',
          attendee.displayName || undefined
        );

        resolvedAttendees.push({
          email: attendee.email || '',
          displayName: attendee.displayName || undefined,
          person: resolution.person,
          confidence: resolution.confidence,
          responseStatus: attendee.responseStatus || undefined
        });

        console.log(`👤 Resolved ${attendee.email} -> ${resolution.person?.name || 'Unknown'} (${resolution.confidence})`);
      } catch (error) {
        console.warn('Failed to resolve attendee:', attendee.email, error);
        resolvedAttendees.push({
          email: attendee.email || '',
          displayName: attendee.displayName || undefined,
          confidence: 0.0
        });
      }
    }

    return resolvedAttendees;
  }

  // Gather email context for meeting attendees (Enhanced with event-specific search)
  private async gatherEmailContext(
    resolvedAttendees: any[],
    userEmail: string,
    userTokens: { access_token: string, refresh_token: string },
    event?: CalendarEvent
  ): Promise<ProvenanceLink[]> {
    const startTime = Date.now();

    try {
      // Set up OAuth client with user's tokens
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        access_token: userTokens.access_token,
        refresh_token: userTokens.refresh_token,
      });

      const gmailService = new GmailService(oauth2Client);
      const attendeeEmails = resolvedAttendees.map(a => a.email);

      console.log(`📧 Searching enhanced email context for ${attendeeEmails.length} attendees...`);

      // Search for multiple types of email context with timeout
      const emailSearches = await Promise.race([
        Promise.all([
          // 1. Introduction emails (existing functionality)
          gmailService.findIntroductionEmails(userEmail, attendeeEmails),

          // 2. Event-related emails (new functionality)
          event?.summary && event?.start?.dateTime ?
            gmailService.findEventRelatedEmails(
              event.summary,
              attendeeEmails,
              new Date(event.start.dateTime),
              userEmail
            ) : Promise.resolve([]),

          // 3. Direct correspondence (new functionality)
          gmailService.findDirectCorrespondence(userEmail, attendeeEmails, 30)
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gmail search timeout')), 15000) // 15s timeout for enhanced search
        )
      ]);

      const [introductions, eventRelated, correspondence] = emailSearches;

      // Combine and deduplicate email contexts
      const allEmailContexts = [...introductions, ...eventRelated, ...correspondence];
      const uniqueContexts = allEmailContexts.filter((context, index, array) =>
        array.findIndex(c => c.threadId === context.threadId) === index
      );

      console.log(`📧 Found ${introductions.length} introductions, ${eventRelated.length} event-related, ${correspondence.length} correspondence emails`);

      // Convert to provenance links with enhanced relevance scoring
      const provenanceLinks: ProvenanceLink[] = uniqueContexts.map(context => ({
        id: `email_${context.threadId}`,
        brief_id: '', // Will be set when saving
        source_type: 'email' as const,
        source_url: context.gmailUrl,
        snippet: context.snippet,
        source_timestamp: context.timestamp,
        confidence: this.calculateEnhancedEmailRelevance(context, attendeeEmails, event),
        created_at: new Date()
      }));

      // Sort by relevance and recency
      const sortedLinks = provenanceLinks.sort((a, b) => {
        // Primary sort: confidence
        const confidenceDiff = b.confidence - a.confidence;
        if (Math.abs(confidenceDiff) > 0.1) return confidenceDiff;

        // Secondary sort: recency
        return (b.source_timestamp?.getTime() || 0) - (a.source_timestamp?.getTime() || 0);
      });

      const duration = Date.now() - startTime;
      console.log(`📧 Enhanced email context gathered in ${duration}ms: ${sortedLinks.length} unique sources`);

      return sortedLinks.slice(0, 8); // Increased limit for enhanced email context

    } catch (error) {
      const duration = Date.now() - startTime;
      console.warn(`❌ Email context failed after ${duration}ms:`, error);
      return []; // Graceful degradation - continue without email context
    }
  }

  // Calculate email relevance score for prioritization
  private calculateEmailRelevance(intro: any, attendeeEmails: string[]): number {
    let score = 0.5; // Base score

    // Higher score if more meeting attendees are mentioned in the email
    const mentionedAttendees = attendeeEmails.filter(email =>
      intro.participants.some((p: string) =>
        p.toLowerCase().includes(email.toLowerCase().split('@')[0])
      )
    );
    score += mentionedAttendees.length * 0.2;

    // Recent emails are more relevant
    const daysAgo = (Date.now() - intro.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo < 7) score += 0.3;
    else if (daysAgo < 30) score += 0.1;

    // Subject relevance
    if (intro.subject?.toLowerCase().includes('introduce')) score += 0.2;

    return Math.min(score, 1.0); // Cap at 1.0
  }

  // Enhanced email relevance calculation for event-specific search
  private calculateEnhancedEmailRelevance(context: any, attendeeEmails: string[], event?: CalendarEvent): number {
    let score = 0.4; // Base score

    // Participant overlap - highest importance
    const mentionedAttendees = attendeeEmails.filter(email =>
      context.participants.some((p: string) =>
        p.toLowerCase().includes(email.toLowerCase()) ||
        p.toLowerCase().includes(email.toLowerCase().split('@')[0])
      )
    );
    score += mentionedAttendees.length * 0.25;

    // Recency scoring - recent emails more relevant
    const daysAgo = (Date.now() - context.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo < 3) score += 0.25;        // Very recent
    else if (daysAgo < 7) score += 0.20;   // Recent
    else if (daysAgo < 14) score += 0.15;  // Somewhat recent
    else if (daysAgo < 30) score += 0.10;  // Less recent

    // Subject relevance to meeting/event
    const subject = context.subject?.toLowerCase() || '';
    const eventTitle = event?.summary?.toLowerCase() || '';

    // Event title keyword overlap
    if (eventTitle) {
      const eventWords = eventTitle.split(/\s+/).filter(w => w.length > 3);
      const subjectWords = subject.split(/\s+/);
      const overlap = eventWords.filter(ew => subjectWords.some((sw: string) => sw.includes(ew) || ew.includes(sw)));
      score += overlap.length * 0.10;
    }

    // Context type bonuses
    if (subject.includes('introduce') || subject.includes('introduction')) score += 0.15;
    if (subject.includes('meeting') || subject.includes('call')) score += 0.10;
    if (subject.includes('follow up') || subject.includes('followup')) score += 0.10;
    if (subject.includes('agenda') || subject.includes('prep')) score += 0.15;

    // Snippet relevance
    const snippet = context.snippet?.toLowerCase() || '';
    if (snippet.includes('meeting') || snippet.includes('call')) score += 0.05;
    if (snippet.includes('discuss') || snippet.includes('agenda')) score += 0.05;

    return Math.min(score, 1.0); // Cap at 1.0
  }

  // Generate AI-powered brief content using Anthropic Claude
  private async generateAIBrief(context: BriefGenerationContext) {
    const { event, resolvedAttendees, userEmail } = context;

    console.log('🤖 Generating AI brief for:', event.summary);

    try {
      // Prepare attendee profiles for AI analysis
      const attendeeProfiles = resolvedAttendees
        .filter(a => a.person)
        .map(a => ({
          email: a.email,
          displayName: a.displayName || a.person!.name,
          company: a.person!.company?.name,
          title: a.person!.title,
          industry: a.person!.company?.industry,
          confidence: a.confidence
        }));

      // Get user context (simplified for now)
      const userContext = {
        name: userEmail.split('@')[0], // Extract name from email for now
        email: userEmail,
        company: 'Tribe' // Default company - could be enhanced later
      };

      // Generate AI brief using the AI service
      const aiBrief = await aiService.generateMeetingBrief(event, attendeeProfiles, userContext);

      console.log('✅ AI brief generated:', {
        category: aiBrief.meetingCategory,
        confidence: aiBrief.confidenceScore,
        aiEnabled: aiService.isAIEnabled()
      });

      return {
        one_liner: aiBrief.oneLiner,
        why_now: aiBrief.whyNow,
        stakes: aiBrief.stakes,
        likely_goal: aiBrief.likelyGoal,
        tone_recommendation: aiBrief.toneRecommendation,
        confidence_score: aiBrief.confidenceScore,
        model_version: aiService.isAIEnabled() ? 'claude-3-haiku' : 'fallback-logic',
        meeting_category: aiBrief.meetingCategory,
        key_insights: aiBrief.keyInsights
      };

    } catch (error) {
      console.error('AI brief generation failed, using fallback:', error);

      // Fallback to original logic-based generation
      const knownAttendees = resolvedAttendees.filter(a => a.person);
      const unknownAttendees = resolvedAttendees.filter(a => !a.person);

      return {
        one_liner: this.generateOneLiner(event, knownAttendees, unknownAttendees),
        why_now: this.generateWhyNow(event, knownAttendees),
        stakes: this.generateStakes(event, knownAttendees),
        likely_goal: this.generateLikelyGoal(event, knownAttendees),
        tone_recommendation: this.generateToneRecommendation(knownAttendees),
        confidence_score: this.calculateOverallConfidence(resolvedAttendees),
        model_version: 'fallback-v1',
        meeting_category: 'Business Meeting',
        key_insights: ['Fallback analysis - AI service unavailable']
      };
    }
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
    resolvedAttendees: any[],
    provenanceLinks: ProvenanceLink[] = []
  ): Promise<MeetingBrief> {
    const eventId = event.id || `generated_${Date.now()}_${Math.random()}`;
    const briefId = `brief_${eventId}`;
    const now = new Date();

    const brief: MeetingBrief = {
      id: briefId,
      calendar_event_id: eventId,
      user_id: userId,
      one_liner: briefContent.one_liner,
      why_now: briefContent.why_now,
      stakes: briefContent.stakes,
      likely_goal: briefContent.likely_goal,
      tone_recommendation: briefContent.tone_recommendation,
      generated_at: now,
      model_version: briefContent.model_version,
      confidence_score: briefContent.confidence_score,
      source_count: provenanceLinks.length,
      has_email_context: provenanceLinks.some(p => p.source_type === 'email'),
      has_slack_context: provenanceLinks.some(p => p.source_type === 'slack'),
      has_call_context: provenanceLinks.some(p => p.source_type === 'call'),
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
      } as MeetingAttendee)),
      provenance_links: provenanceLinks.map(link => ({
        ...link,
        brief_id: briefId
      }))
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
          eventId,
          userId,
          briefContent.one_liner,
          briefContent.why_now,
          briefContent.stakes,
          briefContent.likely_goal,
          briefContent.tone_recommendation,
          briefContent.model_version,
          briefContent.confidence_score,
          provenanceLinks.length, // source_count
          provenanceLinks.some(p => p.source_type === 'email'), // has_email_context
          provenanceLinks.some(p => p.source_type === 'slack'), // has_slack_context
          provenanceLinks.some(p => p.source_type === 'call')   // has_call_context
        ]);

        const dbBrief = briefResult.rows[0];
        await this.saveAttendees(dbBrief.id, resolvedAttendees);

        // Save provenance links if any
        if (provenanceLinks.length > 0) {
          await this.saveProvenanceLinks(dbBrief.id, provenanceLinks);
        }

        console.log('💾 Brief saved to database with', provenanceLinks.length, 'provenance links');
        return brief;

      } catch (error) {
        console.warn('Database unavailable, using memory store for brief:', error);
        this.useDatabaseFallback = false;
      }
    }

    // Fallback to memory store
    this.briefMemoryStore.set(eventId, brief);
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

  // Save provenance links for a brief
  private async saveProvenanceLinks(briefId: string, provenanceLinks: ProvenanceLink[]) {
    if (!this.useDatabaseFallback) return;

    try {
      // Clear existing provenance links for this brief
      await db.query('DELETE FROM provenance_links WHERE brief_id = $1', [briefId]);

      // Insert new provenance links
      for (const link of provenanceLinks) {
        await db.query(`
          INSERT INTO provenance_links (
            brief_id, source_type, source_url, snippet, source_timestamp,
            confidence
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          briefId,
          link.source_type,
          link.source_url,
          link.snippet,
          link.source_timestamp,
          link.confidence
        ]);
      }

      console.log(`📧 Saved ${provenanceLinks.length} provenance links for brief`);
    } catch (error) {
      console.error('Failed to save provenance links:', error);
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