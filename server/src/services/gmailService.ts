import { google } from 'googleapis';

export interface EmailThread {
  threadId: string;
  snippet: string;
  participants: string[];
  subject: string;
  timestamp: Date;
  relevanceScore: number;
}

export interface IntroductionContext {
  threadId: string;
  snippet: string;
  participants: string[];
  introducerEmail: string;
  introducedParties: string[];
  subject: string;
  timestamp: Date;
  gmailUrl: string;
}

class GmailService {
  private gmail: any;

  constructor(oauth2Client: any) {
    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Search for introduction emails with performance optimizations:
   * - Limit to last 45 days to reduce data volume
   * - Use specific search queries to target relevant emails
   * - Fetch minimal fields to reduce response size
   * - Process in batches to avoid timeouts
   */
  async findIntroductionEmails(userEmail: string, targetEmails: string[]): Promise<IntroductionContext[]> {
    const introductions: IntroductionContext[] = [];

    // Performance: Limit search scope to last 45 days
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    const dateFilter = `after:${this.formatGmailDate(fortyFiveDaysAgo)}`;

    // Performance: Use targeted search queries to reduce data volume
    const searchQueries = [
      `(intro OR introduce OR introduction OR meet OR connect) ${dateFilter}`,
      `("I'd like to introduce" OR "let me introduce" OR "want to introduce") ${dateFilter}`,
      `("connecting you" OR "putting you in touch") ${dateFilter}`
    ];

    console.log('📧 Searching Gmail for introductions in last 45 days...');

    for (const query of searchQueries) {
      try {
        // Performance: Limit to 50 most recent results per query
        const response = await this.gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 50 // Performance: Limit results to keep response fast
        });

        const messages = response.data.messages || [];
        console.log(`📧 Found ${messages.length} messages for query: "${query.split(' ')[0]}..."`);

        // Performance: Process in batches of 10 to avoid timeout
        const batchSize = 10;
        for (let i = 0; i < messages.length; i += batchSize) {
          const batch = messages.slice(i, i + batchSize);
          const batchIntros = await this.processBatch(batch, targetEmails, userEmail);
          introductions.push(...batchIntros);
        }

      } catch (error) {
        console.error(`❌ Error searching Gmail with query "${query}":`, error);
        // Performance: Continue with other queries if one fails
        continue;
      }
    }

    // Performance: Sort by timestamp and return most relevant
    return introductions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20); // Performance: Limit to top 20 most recent introductions
  }

  /**
   * Process a batch of messages efficiently
   */
  private async processBatch(
    messages: any[],
    targetEmails: string[],
    userEmail: string
  ): Promise<IntroductionContext[]> {
    const introductions: IntroductionContext[] = [];

    for (const message of messages) {
      try {
        // Performance: Fetch only essential fields to reduce response size
        const response = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date'] // Only fetch needed headers
        });

        const emailData = response.data;
        const headers = this.parseHeaders(emailData.payload?.headers || []);
        const participants = this.extractParticipants(headers, userEmail);

        // Performance: Quick relevance check before expensive processing
        const hasTargetEmail = targetEmails.some(email =>
          participants.some(p => p.toLowerCase().includes(email.toLowerCase().split('@')[0]))
        );

        if (hasTargetEmail && this.isLikelyIntroduction(headers.subject, emailData.snippet)) {
          const intro: IntroductionContext = {
            threadId: emailData.threadId,
            snippet: this.cleanSnippet(emailData.snippet || ''),
            participants,
            introducerEmail: this.extractIntroducerEmail(headers, userEmail),
            introducedParties: this.findIntroducedParties(participants, userEmail),
            subject: headers.subject || '',
            timestamp: new Date(headers.date || emailData.internalDate),
            gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${message.id}`
          };

          introductions.push(intro);
        }

      } catch (error) {
        console.error(`❌ Error processing message ${message.id}:`, error);
        // Performance: Continue processing other messages if one fails
        continue;
      }
    }

    return introductions;
  }

  /**
   * Get email thread context for a specific thread (for provenance)
   */
  async getThreadContext(threadId: string): Promise<{ snippet: string; url: string } | null> {
    try {
      // Performance: Fetch minimal thread data
      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'metadata',
        metadataHeaders: ['Subject'] // Only need subject for context
      });

      const thread = response.data;
      const firstMessage = thread.messages?.[0];

      return {
        snippet: this.cleanSnippet(firstMessage?.snippet || ''),
        url: `https://mail.google.com/mail/u/0/#inbox/${threadId}`
      };
    } catch (error) {
      console.error(`❌ Error fetching thread ${threadId}:`, error);
      return null;
    }
  }

  // Helper methods for processing email data
  private parseHeaders(headers: any[]): { [key: string]: string } {
    const headerMap: { [key: string]: string } = {};
    headers.forEach(header => {
      headerMap[header.name?.toLowerCase()] = header.value || '';
    });
    return headerMap;
  }

  private extractParticipants(headers: { [key: string]: string }, userEmail: string): string[] {
    const participants = new Set<string>();

    ['from', 'to', 'cc'].forEach(field => {
      if (headers[field]) {
        const emails = this.extractEmailsFromString(headers[field]);
        emails.forEach(email => {
          if (email !== userEmail) { // Exclude self
            participants.add(email);
          }
        });
      }
    });

    return Array.from(participants);
  }

  private extractEmailsFromString(str: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return str.match(emailRegex) || [];
  }

  private extractIntroducerEmail(headers: { [key: string]: string }, userEmail: string): string {
    const fromEmail = this.extractEmailsFromString(headers.from || '')[0];
    return fromEmail === userEmail ? '' : fromEmail || '';
  }

  private findIntroducedParties(participants: string[], userEmail: string): string[] {
    return participants.filter(email => email !== userEmail);
  }

  private isLikelyIntroduction(subject: string = '', snippet: string = ''): boolean {
    const introKeywords = [
      'introduce', 'introduction', 'meet', 'connect', 'connecting',
      'putting you in touch', 'want you to meet', 'should meet'
    ];

    const text = `${subject} ${snippet}`.toLowerCase();
    return introKeywords.some(keyword => text.includes(keyword));
  }

  private cleanSnippet(snippet: string): string {
    return snippet
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 200); // Limit length for performance
  }

  private formatGmailDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  /**
   * Search for emails related to a specific event/meeting
   * Looks for subject similarity, participant correspondence, and temporal relevance
   */
  async findEventRelatedEmails(
    eventTitle: string,
    participants: string[],
    eventDate: Date,
    userEmail: string
  ): Promise<IntroductionContext[]> {
    const eventEmails: IntroductionContext[] = [];

    try {
      console.log(`📧 Searching event-related emails for: "${eventTitle}" with ${participants.length} participants`);

      // Search window: 30 days before event
      const thirtyDaysAgo = new Date(eventDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateFilter = `after:${this.formatGmailDate(thirtyDaysAgo)}`;

      // Extract keywords from event title for search
      const eventKeywords = this.extractSearchKeywords(eventTitle);

      // Build search queries
      const searchQueries = [
        // Search by event title keywords
        ...eventKeywords.map(keyword => `subject:(${keyword}) ${dateFilter}`),
        // Search by participant emails with event keywords
        ...participants.map(email =>
          eventKeywords.length > 0
            ? `(from:${email} OR to:${email}) subject:(${eventKeywords.join(' OR ')}) ${dateFilter}`
            : `(from:${email} OR to:${email}) ${dateFilter}`
        )
      ];

      // Process searches
      for (const query of searchQueries.slice(0, 5)) { // Limit to top 5 queries for performance
        try {
          const response = await this.gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 5 // Limit per query
          });

          const messages = response.data.messages || [];
          console.log(`📧 Found ${messages.length} messages for query: "${query.substring(0, 50)}..."`);

          // Process messages
          for (const message of messages) {
            const emailContext = await this.processEventEmail(message, participants, userEmail, eventTitle);
            if (emailContext) {
              eventEmails.push(emailContext);
            }
          }
        } catch (error) {
          console.warn(`Warning processing event email query: ${error}`);
          continue;
        }
      }

      // Sort by relevance and recency
      return eventEmails
        .sort((a, b) => {
          // Primary sort: temporal proximity to event
          const aProximity = Math.abs(eventDate.getTime() - a.timestamp.getTime());
          const bProximity = Math.abs(eventDate.getTime() - b.timestamp.getTime());
          return aProximity - bProximity;
        })
        .slice(0, 10); // Return top 10 most relevant

    } catch (error) {
      console.error(`❌ Error searching event-related emails:`, error);
      return [];
    }
  }

  /**
   * Search for direct correspondence with meeting participants
   * Focus on recent back-and-forth emails
   */
  async findDirectCorrespondence(
    userEmail: string,
    participantEmails: string[],
    days: number = 30
  ): Promise<IntroductionContext[]> {
    const correspondence: IntroductionContext[] = [];

    try {
      console.log(`📧 Searching direct correspondence with ${participantEmails.length} participants over ${days} days`);

      const dateFilter = `after:${this.formatGmailDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000))}`;

      for (const participantEmail of participantEmails) {
        try {
          // Search for emails between user and participant
          const query = `(from:${participantEmail} OR to:${participantEmail}) ${dateFilter}`;

          const response = await this.gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 8 // Limit per participant
          });

          const messages = response.data.messages || [];
          console.log(`📧 Found ${messages.length} correspondence messages with ${participantEmail}`);

          for (const message of messages) {
            const emailContext = await this.processCorrespondenceEmail(message, participantEmail, userEmail);
            if (emailContext) {
              correspondence.push(emailContext);
            }
          }
        } catch (error) {
          console.warn(`Warning processing correspondence with ${participantEmail}: ${error}`);
          continue;
        }
      }

      return correspondence
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) // Most recent first
        .slice(0, 15); // Limit total results

    } catch (error) {
      console.error(`❌ Error searching direct correspondence:`, error);
      return [];
    }
  }

  /**
   * Search for recent email activity with a specific person
   * Performance: Limited to last 30 days and 10 results
   */
  async findRecentEmailActivity(personEmail: string): Promise<{ count: number; lastActivity: Date | null }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateFilter = `after:${this.formatGmailDate(thirtyDaysAgo)}`;

      const query = `(from:${personEmail} OR to:${personEmail}) ${dateFilter}`;

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 10 // Performance: Just need count and recent activity
      });

      const messages = response.data.messages || [];
      let lastActivity: Date | null = null;

      if (messages.length > 0) {
        // Get timestamp of most recent message
        const recentMessage = await this.gmail.users.messages.get({
          userId: 'me',
          id: messages[0].id,
          format: 'minimal'
        });
        lastActivity = new Date(parseInt(recentMessage.data.internalDate));
      }

      return {
        count: messages.length,
        lastActivity
      };

    } catch (error) {
      console.error(`❌ Error finding email activity for ${personEmail}:`, error);
      return { count: 0, lastActivity: null };
    }
  }

  /**
   * Extract search keywords from event title
   */
  private extractSearchKeywords(eventTitle: string): string[] {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];

    return eventTitle
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 5); // Limit to top 5 keywords for performance
  }

  /**
   * Process an event-related email message
   */
  private async processEventEmail(
    message: any,
    participants: string[],
    userEmail: string,
    eventTitle: string
  ): Promise<IntroductionContext | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date']
      });

      const emailData = response.data;
      const headers = this.parseHeaders(emailData.payload?.headers || []);
      const emailParticipants = this.extractParticipants(headers, userEmail);

      // Check if email involves event participants
      const hasEventParticipant = participants.some(eventEmail =>
        emailParticipants.some(emailAddr => emailAddr.toLowerCase() === eventEmail.toLowerCase())
      );

      if (hasEventParticipant) {
        return {
          threadId: emailData.threadId,
          snippet: this.cleanSnippet(emailData.snippet || ''),
          participants: emailParticipants,
          introducerEmail: this.extractIntroducerEmail(headers, userEmail),
          introducedParties: this.findIntroducedParties(emailParticipants, userEmail),
          subject: headers.subject || '',
          timestamp: new Date(headers.date || emailData.internalDate),
          gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${message.id}`
        };
      }

      return null;
    } catch (error) {
      console.error(`Error processing event email ${message.id}:`, error);
      return null;
    }
  }

  /**
   * Process a direct correspondence email message
   */
  private async processCorrespondenceEmail(
    message: any,
    participantEmail: string,
    userEmail: string
  ): Promise<IntroductionContext | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date']
      });

      const emailData = response.data;
      const headers = this.parseHeaders(emailData.payload?.headers || []);
      const emailParticipants = this.extractParticipants(headers, userEmail);

      return {
        threadId: emailData.threadId,
        snippet: this.cleanSnippet(emailData.snippet || ''),
        participants: emailParticipants,
        introducerEmail: this.extractIntroducerEmail(headers, userEmail),
        introducedParties: this.findIntroducedParties(emailParticipants, userEmail),
        subject: headers.subject || '',
        timestamp: new Date(headers.date || emailData.internalDate),
        gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${message.id}`
      };
    } catch (error) {
      console.error(`Error processing correspondence email ${message.id}:`, error);
      return null;
    }
  }
}

export { GmailService };