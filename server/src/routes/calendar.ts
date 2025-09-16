import { Router } from 'express';
import { google } from 'googleapis';

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Get today's calendar events
router.get('/today', requireAuth, async (req: any, res) => {
  try {
    const user = req.user;
    console.log('📊 User data in /today route:', JSON.stringify(user, null, 2));

    // Verify user has tokens
    if (!user.access_token) {
      console.error('❌ User has no access_token:', user);
      return res.status(401).json({
        error: 'No access token available. Please re-authenticate.',
        user: user
      });
    }

    // Set up OAuth client with user's tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    console.log('🔑 Setting credentials with tokens:', {
      hasAccessToken: !!user.access_token,
      hasRefreshToken: !!user.refresh_token
    });

    oauth2Client.setCredentials({
      access_token: user.access_token,
      refresh_token: user.refresh_token,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    console.log(`📅 Fetching calendar events for ${startOfDay.toDateString()}`);

    // Fetch today's events
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    console.log(`📋 Found ${events.length} events for today`);

    // Transform events to our format
    const transformedEvents = events.map(event => {
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;

      // Format time for display
      const formatTime = (timeStr: string) => {
        try {
          const date = new Date(timeStr);
          return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        } catch (e) {
          return timeStr;
        }
      };

      const timeRange = startTime && endTime ?
        `${formatTime(startTime)} - ${formatTime(endTime)}` :
        'All day';

      return {
        id: event.id,
        title: event.summary || 'Untitled Meeting',
        time: timeRange,
        attendees: (event.attendees || [])
          .filter(attendee => attendee.email !== user.email) // Exclude the user
          .map(attendee => attendee.displayName || attendee.email?.split('@')[0] || 'Unknown')
          .slice(0, 3), // Limit to first 3 attendees
        location: event.location,
        description: event.description,
        // Placeholder brief data - will be enhanced with AI later
        oneLiner: `Meeting with ${(event.attendees || []).length} attendees`,
        whyNow: 'Calendar event - context to be generated',
        stakes: 'To be determined based on meeting context',
        likelyGoal: 'Meeting objective to be analyzed',
        toneRecommendation: 'Professional',
        provenanceLinks: []
      };
    });

    res.json({
      success: true,
      events: transformedEvents,
      count: transformedEvents.length
    });

  } catch (error) {
    console.error('Calendar API error:', error);
    res.status(500).json({
      error: 'Failed to fetch calendar events',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get authentication status
router.get('/auth-status', (req: any, res) => {
  if (req.isAuthenticated()) {
    const user = req.user;
    console.log('📊 User data in /auth-status:', JSON.stringify(user, null, 2));

    // Check if user has the required tokens
    if (!user.access_token) {
      console.warn('⚠️  User authenticated but missing access tokens - need re-auth');
      return res.json({
        authenticated: false,
        needsReauth: true,
        message: 'Session found but missing tokens. Please re-authenticate.'
      });
    }

    res.json({
      authenticated: true,
      user: {
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url
      }
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

export default router;