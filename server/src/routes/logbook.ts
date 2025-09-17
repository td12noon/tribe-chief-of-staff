import { Router } from 'express';
import { enhancedEntityService } from '../services/enhancedEntityService';
import { GmailService } from '../services/gmailService';
import { google } from 'googleapis';
import { db } from '../config/database';

const router = Router();

interface LogbookEntry {
  person: {
    id: string;
    name: string;
    emails: string[];
    primaryEmail: string;
    company?: {
      id: string;
      name: string;
      domain?: string;
      industry?: string;
    };
    title?: string;
    confidence: number;
  };
  emailActivity: {
    count: number;
    lastActivity: Date | null;
    recentEmails: Array<{
      subject: string;
      snippet: string;
      timestamp: Date;
      type: 'sent' | 'received' | 'thread';
      gmailUrl: string;
    }>;
  };
  interactions: {
    meetingCount: number;
    lastMeeting: Date | null;
    emailCount: number;
    totalInteractions: number;
  };
}

interface LogbookResponse {
  entries: LogbookEntry[];
  summary: {
    totalPeople: number;
    totalCompanies: number;
    totalEmails: number;
    lastUpdated: Date;
    coveragePeriod: string;
  };
}

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Helper function to get meeting statistics for a person by email
async function getMeetingStats(email: string): Promise<{count: number, lastMeeting: Date | null}> {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as meeting_count,
        MAX(ce.start_datetime) as last_meeting
      FROM event_attendees ea
      JOIN calendar_events ce ON ea.event_id = ce.id
      WHERE LOWER(ea.email) = LOWER($1)
        AND ce.start_datetime IS NOT NULL
        AND ce.start_datetime < NOW() -- Only count past meetings
    `, [email]);

    return {
      count: parseInt(result.rows[0]?.meeting_count || '0'),
      lastMeeting: result.rows[0]?.last_meeting || null
    };
  } catch (error) {
    // Database not available - return placeholder data
    console.warn(`Database unavailable for meeting stats (${email}), using memory fallback`);
    return { count: 0, lastMeeting: null };
  }
}

// Helper function to check if database is available
async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await db.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
}

// GET /logbook - Get comprehensive user/company/email logbook
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    if (!user.access_token) {
      return res.status(401).json({
        error: 'No Gmail access token available. Please re-authenticate.'
      });
    }

    console.log('📚 Generating comprehensive logbook...');

    // Check database availability
    const dbAvailable = await isDatabaseAvailable();
    console.log(`📚 Database available: ${dbAvailable}`);

    // Set up Gmail service with user's tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: user.access_token,
      refresh_token: user.refresh_token,
    });

    const gmailService = new GmailService(oauth2Client);

    // Get all resolved people from entity service
    const allPeople = await enhancedEntityService.getAllPeople();
    console.log(`📚 Found ${allPeople.length} people in entity database`);

    // Build logbook entries with email activity
    const entries: LogbookEntry[] = [];
    const batchSize = 5; // Process in small batches to avoid overwhelming Gmail API

    for (let i = 0; i < allPeople.length; i += batchSize) {
      const batch = allPeople.slice(i, i + batchSize);
      console.log(`📚 Processing people batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allPeople.length/batchSize)}`);

      const batchPromises = batch.map(async (person) => {
        try {
          // Get email activity and meeting stats for this person
          const [emailActivity, meetingStats] = await Promise.all([
            gmailService.findRecentEmailActivity(person.emails[0]),
            getMeetingStats(person.emails[0])
          ]);

          const entry: LogbookEntry = {
            person: {
              id: person.id,
              name: person.name,
              emails: person.emails,
              primaryEmail: person.emails[0],
              company: person.company,
              title: person.title,
              confidence: person.confidence || 0.8
            },
            emailActivity: {
              count: emailActivity.count,
              lastActivity: emailActivity.lastActivity,
              recentEmails: [] // TODO: Implement recent email details if needed
            },
            interactions: {
              meetingCount: meetingStats.count,
              lastMeeting: meetingStats.lastMeeting,
              emailCount: emailActivity.count,
              totalInteractions: emailActivity.count + meetingStats.count
            }
          };

          return entry;
        } catch (error) {
          console.warn(`Failed to process person ${person.name}:`, error);

          // Try to get meeting stats even if email fails
          let meetingStats: {count: number, lastMeeting: Date | null} = { count: 0, lastMeeting: null };
          try {
            meetingStats = await getMeetingStats(person.emails[0]);
          } catch (meetingError) {
            console.warn(`Also failed to get meeting stats for ${person.name}`);
          }

          // Return basic entry without email activity but with meeting stats
          return {
            person: {
              id: person.id,
              name: person.name,
              emails: person.emails,
              primaryEmail: person.emails[0],
              company: person.company,
              title: person.title,
              confidence: person.confidence || 0.8
            },
            emailActivity: {
              count: 0,
              lastActivity: null,
              recentEmails: []
            },
            interactions: {
              meetingCount: meetingStats.count,
              lastMeeting: meetingStats.lastMeeting,
              emailCount: 0,
              totalInteractions: meetingStats.count
            }
          } as LogbookEntry;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      entries.push(...batchResults);

      // Add a small delay to respect rate limits
      if (i + batchSize < allPeople.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Sort entries by interaction frequency and recency
    const sortedEntries = entries.sort((a, b) => {
      // Primary sort: total interactions
      const interactionDiff = b.interactions.totalInteractions - a.interactions.totalInteractions;
      if (interactionDiff !== 0) return interactionDiff;

      // Secondary sort: recent activity
      const aLastActivity = a.emailActivity.lastActivity?.getTime() || 0;
      const bLastActivity = b.emailActivity.lastActivity?.getTime() || 0;
      return bLastActivity - aLastActivity;
    });

    // Calculate summary statistics
    const totalEmails = entries.reduce((sum, entry) => sum + entry.emailActivity.count, 0);
    const uniqueCompanies = new Set(
      entries
        .map(e => e.person.company?.name)
        .filter(Boolean)
    ).size;

    const response: LogbookResponse = {
      entries: sortedEntries,
      summary: {
        totalPeople: entries.length,
        totalCompanies: uniqueCompanies,
        totalEmails,
        lastUpdated: new Date(),
        coveragePeriod: 'Last 30 days'
      }
    };

    console.log(`📚 Logbook generated: ${entries.length} people, ${uniqueCompanies} companies, ${totalEmails} emails`);
    res.json(response);

  } catch (error) {
    console.error('Error generating logbook:', error);
    res.status(500).json({
      error: 'Failed to generate logbook',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;