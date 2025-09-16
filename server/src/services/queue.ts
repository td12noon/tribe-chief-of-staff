import Bull from 'bull';
import { redis } from '../config/database';

// Job queue for processing meeting briefs
export const briefQueue = new Bull('brief processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
});

// Job types
export interface BriefGenerationJob {
  eventId: string;
  attendeeEmails: string[];
  eventSummary: string;
  eventStart: string;
}

export interface DailyBriefJob {
  date: string;
  eventIds: string[];
}

// Process brief generation jobs
briefQueue.process('generate-brief', async (job) => {
  const { eventId, attendeeEmails, eventSummary, eventStart }: BriefGenerationJob = job.data;

  console.log(`Processing brief generation for event ${eventId}`);

  // TODO: Implement actual brief generation logic
  // This will integrate with Gmail, Slack, and Sybil APIs

  return {
    eventId,
    status: 'completed',
    processedAt: new Date().toISOString(),
  };
});

// Process daily brief generation jobs
briefQueue.process('daily-briefs', async (job) => {
  const { date, eventIds }: DailyBriefJob = job.data;

  console.log(`Processing daily briefs for ${date} (${eventIds.length} events)`);

  // TODO: Generate briefs for all events for the day

  return {
    date,
    processedEvents: eventIds.length,
    completedAt: new Date().toISOString(),
  };
});

// Schedule daily brief generation at 6:30 AM
export const scheduleDailyBriefs = () => {
  briefQueue.add('daily-briefs',
    {
      date: new Date().toISOString().split('T')[0],
      eventIds: [] // Will be populated from calendar
    },
    {
      repeat: { cron: '30 6 * * *' }, // 6:30 AM daily
      removeOnComplete: 10,
      removeOnFail: 5,
    }
  );
};

// Queue event handlers
briefQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

briefQueue.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err);
});

briefQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled`);
});

export default briefQueue;