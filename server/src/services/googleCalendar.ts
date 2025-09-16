import { google } from 'googleapis';
import { db } from '../config/database';
import type { CalendarEvent } from '../types';

export class GoogleCalendarService {
  private getAuthClient(accessToken: string, refreshToken?: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return oauth2Client;
  }

  async syncCalendarEvents(userId: string): Promise<CalendarEvent[]> {
    try {
      // Get user's tokens from database
      const userResult = await db.query(
        'SELECT access_token, refresh_token FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const { access_token, refresh_token } = userResult.rows[0];
      const authClient = this.getAuthClient(access_token, refresh_token);
      const calendar = google.calendar({ version: 'v3', auth: authClient });

      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Fetch today's events
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      const calendarEvents: CalendarEvent[] = [];

      // Process and store events
      for (const event of events) {
        if (!event.id) continue;

        const calendarEvent: CalendarEvent = {
          id: event.id,
          summary: event.summary || 'Untitled Event',
          description: event.description || undefined,
          start: {
            dateTime: event.start?.dateTime || undefined,
            date: event.start?.date || undefined,
          },
          end: {
            dateTime: event.end?.dateTime || undefined,
            date: event.end?.date || undefined,
          },
          attendees: event.attendees?.map(attendee => ({
            email: attendee.email!,
            displayName: attendee.displayName || undefined,
            responseStatus: attendee.responseStatus || undefined,
          })) || [],
          location: event.location || undefined,
          created: event.created!,
          updated: event.updated!,
        };

        // Store in database
        await this.storeCalendarEvent(calendarEvent);
        calendarEvents.push(calendarEvent);
      }

      return calendarEvents;
    } catch (error) {
      console.error('Error syncing calendar events:', error);
      throw error;
    }
  }

  private async storeCalendarEvent(event: CalendarEvent) {
    try {
      // Store calendar event
      await db.query(
        `INSERT INTO calendar_events (id, summary, description, start_datetime, end_datetime, location, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           summary = EXCLUDED.summary,
           description = EXCLUDED.description,
           start_datetime = EXCLUDED.start_datetime,
           end_datetime = EXCLUDED.end_datetime,
           location = EXCLUDED.location,
           updated_at = NOW()`,
        [
          event.id,
          event.summary,
          event.description,
          event.start.dateTime || event.start.date,
          event.end.dateTime || event.end.date,
          event.location,
        ]
      );

      // Store attendees
      if (event.attendees && event.attendees.length > 0) {
        for (const attendee of event.attendees) {
          // Try to match with existing person
          const personResult = await db.query(
            'SELECT id FROM people WHERE $1 = ANY(emails)',
            [attendee.email]
          );

          let personId;
          if (personResult.rows.length === 0) {
            // Create new person
            const newPerson = await db.query(
              'INSERT INTO people (name, emails, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id',
              [attendee.displayName || attendee.email, [attendee.email]]
            );
            personId = newPerson.rows[0].id;
          } else {
            personId = personResult.rows[0].id;
          }

          // Store event attendee relationship
          await db.query(
            `INSERT INTO event_attendees (event_id, person_id, email, display_name, response_status, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (event_id, person_id) DO UPDATE SET
               display_name = EXCLUDED.display_name,
               response_status = EXCLUDED.response_status`,
            [event.id, personId, attendee.email, attendee.displayName, attendee.responseStatus]
          );
        }
      }
    } catch (error) {
      console.error('Error storing calendar event:', error);
      throw error;
    }
  }

  async getTodaysEvents(): Promise<CalendarEvent[]> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const result = await db.query(
        `SELECT ce.*,
                array_agg(
                  json_build_object(
                    'email', ea.email,
                    'displayName', ea.display_name,
                    'responseStatus', ea.response_status
                  )
                ) as attendees
         FROM calendar_events ce
         LEFT JOIN event_attendees ea ON ce.id = ea.event_id
         WHERE ce.start_datetime >= $1 AND ce.start_datetime < $2
         GROUP BY ce.id
         ORDER BY ce.start_datetime`,
        [startOfDay.toISOString(), endOfDay.toISOString()]
      );

      return result.rows.map(row => ({
        id: row.id,
        summary: row.summary,
        description: row.description,
        start: {
          dateTime: row.start_datetime,
        },
        end: {
          dateTime: row.end_datetime,
        },
        attendees: row.attendees.filter((a: any) => a.email !== null),
        location: row.location,
        created: row.created_at,
        updated: row.updated_at,
      }));
    } catch (error) {
      console.error('Error getting today\'s events:', error);
      throw error;
    }
  }
}