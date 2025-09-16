import Anthropic from '@anthropic-ai/sdk';

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

interface AttendeeProfile {
  email: string;
  displayName?: string;
  company?: string;
  title?: string;
  industry?: string;
  confidence: number;
}

interface AIBriefResult {
  oneLiner: string;
  whyNow: string;
  stakes: string;
  likelyGoal: string;
  toneRecommendation: string;
  meetingCategory: string;
  keyInsights: string[];
  confidenceScore: number;
}

class AIService {
  private anthropic: Anthropic | null = null;
  private isEnabled: boolean;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.isEnabled = !!apiKey && apiKey.trim() !== '';

    if (this.isEnabled) {
      this.anthropic = new Anthropic({
        apiKey: apiKey!
      });
      console.log('✅ Anthropic Claude API initialized');
    } else {
      console.log('⚠️  Anthropic API key not provided - using fallback mode');
    }
  }

  async generateMeetingBrief(
    event: CalendarEvent,
    attendeeProfiles: AttendeeProfile[],
    userContext: { name: string; email: string; company?: string }
  ): Promise<AIBriefResult> {
    if (!this.isEnabled || !this.anthropic) {
      return this.generateFallbackBrief(event, attendeeProfiles);
    }

    try {
      const prompt = this.buildBriefPrompt(event, attendeeProfiles, userContext);

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      return this.parseBriefResponse(content.text);

    } catch (error) {
      console.error('AI brief generation failed:', error);
      return this.generateFallbackBrief(event, attendeeProfiles);
    }
  }

  private buildBriefPrompt(
    event: CalendarEvent,
    attendeeProfiles: AttendeeProfile[],
    userContext: { name: string; email: string; company?: string }
  ): string {
    const meetingTitle = event.summary || 'Untitled Meeting';
    const meetingDescription = event.description || '';
    const meetingLocation = event.location || '';

    // Format attendee information
    const attendeeInfo = attendeeProfiles.map(profile => {
      const parts = [profile.displayName || profile.email];
      if (profile.company) parts.push(`from ${profile.company}`);
      if (profile.title) parts.push(`(${profile.title})`);
      if (profile.industry) parts.push(`in ${profile.industry}`);
      return parts.join(' ');
    }).join('\n- ');

    const attendeeCount = attendeeProfiles.length;
    const hasExternalAttendees = attendeeProfiles.some(p =>
      p.company && p.company !== userContext.company
    );

    return `You are an AI executive assistant preparing a meeting brief. Analyze this meeting and provide strategic insights.

MEETING DETAILS:
Title: ${meetingTitle}
Description: ${meetingDescription}
Location: ${meetingLocation}
Attendee Count: ${attendeeCount}

ATTENDEES:
- ${attendeeInfo || 'No attendee information available'}

USER CONTEXT:
- You are preparing this brief for ${userContext.name} (${userContext.email})
${userContext.company ? `- User's company: ${userContext.company}` : ''}

ANALYSIS INSTRUCTIONS:
1. Create a compelling one-liner that captures who these people are and what this meeting represents
2. Determine "why now" - what triggered this meeting at this time
3. Assess the stakes - what's important about this meeting and what could be gained or lost
4. Predict the likely goal - what do the attendees want to accomplish
5. Recommend the appropriate tone and approach
6. Categorize the meeting type (e.g., "Partnership Discussion", "Sales Call", "Team Sync", "Investor Meeting")
7. Extract 2-3 key insights that might not be obvious from the surface details

IMPORTANT GUIDELINES:
- Be concise but insightful
- Focus on strategic value and context
- Consider power dynamics and business relationships
- Avoid generic statements
- If information is limited, acknowledge it but still provide useful analysis
- Consider the user's perspective and what they need to know

RESPONSE FORMAT (JSON):
{
  "oneLiner": "One compelling sentence that captures the essence of this meeting",
  "whyNow": "Why this meeting is happening at this particular time",
  "stakes": "What's at stake - what could be gained or lost",
  "likelyGoal": "What the attendees likely want to accomplish",
  "toneRecommendation": "Recommended approach and tone for the meeting",
  "meetingCategory": "Category/type of meeting",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "confidenceScore": 0.85
}

Provide your analysis as valid JSON only, no other text.`;
  }

  private parseBriefResponse(response: string): AIBriefResult {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        oneLiner: parsed.oneLiner || 'AI-generated meeting brief',
        whyNow: parsed.whyNow || 'Meeting context analysis',
        stakes: parsed.stakes || 'Strategic meeting importance',
        likelyGoal: parsed.likelyGoal || 'Meeting objectives',
        toneRecommendation: parsed.toneRecommendation || 'Professional approach',
        meetingCategory: parsed.meetingCategory || 'Business Meeting',
        keyInsights: parsed.keyInsights || ['AI-powered insights available'],
        confidenceScore: parsed.confidenceScore || 0.7
      };

    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.log('Raw response:', response);

      // Return a structured fallback
      return {
        oneLiner: 'Strategic meeting requiring preparation',
        whyNow: 'Scheduled business discussion',
        stakes: 'Professional relationship and business outcomes',
        likelyGoal: 'Advance business objectives and build relationships',
        toneRecommendation: 'Professional and well-prepared',
        meetingCategory: 'Business Meeting',
        keyInsights: ['AI analysis temporarily unavailable'],
        confidenceScore: 0.5
      };
    }
  }

  private generateFallbackBrief(event: CalendarEvent, attendeeProfiles: AttendeeProfile[]): AIBriefResult {
    const meetingTitle = event.summary || 'Untitled Meeting';
    const attendeeCount = attendeeProfiles.length;

    // Simple logic-based brief generation
    const hasExternalCompanies = attendeeProfiles.some(p => p.company);
    const companies = [...new Set(attendeeProfiles.map(p => p.company).filter(Boolean))];

    let oneLiner = `Meeting with ${attendeeCount} participants`;
    if (companies.length === 1) {
      oneLiner = `${companies[0]} team meeting`;
    } else if (companies.length > 1) {
      oneLiner = `Multi-company meeting with ${companies.join(', ')}`;
    }

    let category = 'Team Meeting';
    if (meetingTitle.toLowerCase().includes('intro')) category = 'Introduction';
    else if (meetingTitle.toLowerCase().includes('sales')) category = 'Sales Discussion';
    else if (meetingTitle.toLowerCase().includes('partner')) category = 'Partnership Meeting';
    else if (hasExternalCompanies) category = 'External Meeting';

    return {
      oneLiner,
      whyNow: 'Scheduled business meeting',
      stakes: hasExternalCompanies ? 'External business relationship development' : 'Internal team alignment',
      likelyGoal: category === 'Introduction' ? 'Establish new business relationship' : 'Advance business objectives',
      toneRecommendation: hasExternalCompanies ? 'Professional and relationship-focused' : 'Collaborative and productive',
      meetingCategory: category,
      keyInsights: [
        `${attendeeCount} participants scheduled`,
        hasExternalCompanies ? 'External stakeholders involved' : 'Internal team meeting',
        'AI-powered analysis available with API key'
      ],
      confidenceScore: 0.6
    };
  }

  // Category detection based on meeting characteristics
  private categorizeMeeting(event: CalendarEvent, attendeeProfiles: AttendeeProfile[]): string {
    const title = (event.summary || '').toLowerCase();
    const description = (event.description || '').toLowerCase();

    // Check for keywords
    if (title.includes('intro') || title.includes('introduction')) return 'Introduction';
    if (title.includes('sales') || title.includes('demo')) return 'Sales Call';
    if (title.includes('partner') || title.includes('partnership')) return 'Partnership Discussion';
    if (title.includes('investor') || title.includes('funding')) return 'Investor Meeting';
    if (title.includes('sync') || title.includes('standup')) return 'Team Sync';
    if (title.includes('interview')) return 'Interview';
    if (title.includes('review')) return 'Review Meeting';

    // Check attendee patterns
    const externalCompanies = [...new Set(attendeeProfiles.map(p => p.company).filter(Boolean))];
    if (externalCompanies.length > 1) return 'Multi-Company Meeting';
    if (externalCompanies.length === 1) return 'External Meeting';

    return 'Business Meeting';
  }

  // Check if AI service is available
  isAIEnabled(): boolean {
    return this.isEnabled;
  }

  // Get AI service status for debugging
  getStatus(): { enabled: boolean; model: string } {
    return {
      enabled: this.isEnabled,
      model: this.isEnabled ? 'claude-3-haiku-20240307' : 'fallback-logic'
    };
  }
}

export const aiService = new AIService();