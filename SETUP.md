# Meeting Pre-Briefs System - Setup Guide

## Week 1 Foundation - Complete ✅

This system helps generate smart meeting pre-briefs by integrating with Google Calendar, Gmail, Slack, and Sybil to provide context about upcoming meetings.

## Prerequisites

- Node.js 18+ with pnpm
- Docker and Docker Compose
- Google Cloud Console account (for OAuth)

## Quick Start

### 1. Database Setup

Start PostgreSQL and Redis:
```bash
docker-compose up -d
```

### 2. Environment Configuration

Copy and configure environment variables:
```bash
cp .env.example .env
```

Fill in the Google OAuth credentials in `.env` (see Google Setup below).

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run the Application

Development mode (both frontend and backend):
```bash
pnpm dev:all
```

Or run separately:
```bash
# Frontend (Next.js)
pnpm dev

# Backend (Express)
pnpm dev:server
```

## Google Setup (Required)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the following APIs:
   - Google Calendar API
   - Gmail API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3001/auth/google/callback`
5. Add the credentials to your `.env` file:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

## URLs

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Google OAuth**: http://localhost:3001/auth/google

## Database Schema

The system uses PostgreSQL with the following main tables:
- `users` - OAuth user profiles
- `people` - Person/company profiles with entity resolution
- `calendar_events` - Synced calendar events
- `event_attendees` - Meeting participants
- `meeting_briefs` - Generated AI briefs
- `provenance_links` - Source tracking for brief content

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js       │    │   Express API   │    │   PostgreSQL    │
│   Frontend      │◄──►│   Backend       │◄──►│   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Redis Queue   │
                       │   (Bull)        │
                       └─────────────────┘
```

## Current Features (Week 1)

✅ **Foundation Setup**
- Node.js/TypeScript backend with Express
- PostgreSQL database with proper schema
- Redis for job queues and caching
- Next.js frontend with Tailwind CSS
- Google OAuth integration with Calendar/Gmail scopes

✅ **UI Components**
- Meeting dashboard with mock data
- Meeting cards showing brief structure
- Responsive design with Tailwind CSS

✅ **Backend Services**
- OAuth authentication flow
- Google Calendar API integration
- Database models and migrations
- Job queue setup for background processing

## Next Steps (Week 2)

🔄 **Google Calendar Integration**
- Implement real calendar sync
- Parse calendar events and attendees
- Create meeting cards from real data

📧 **Gmail Integration** (Week 2-3)
- Search for introduction emails
- Extract context from email threads
- Link emails to meeting attendees

💬 **Slack Integration** (Week 2-3)
- Monitor introduction channels
- Parse Slack messages for context

🎥 **Sybil Integration** (Week 2-3)
- Pull call transcripts
- Generate relevant clips/timestamps

🤖 **AI Brief Generation** (Week 3-4)
- LLM integration for smart summaries
- Extract "non-obvious facts"
- Generate stakes, goals, and recommendations

## Development Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev:all          # Run both frontend and backend
pnpm dev              # Frontend only
pnpm dev:server       # Backend only

# Database
docker-compose up -d   # Start PostgreSQL and Redis
docker-compose down    # Stop databases

# Build
pnpm build            # Build frontend
pnpm build:server     # Build backend

# Production
pnpm start            # Start frontend
pnpm start:server     # Start backend
```

## Environment Variables

Required variables in `.env`:
```bash
# Google OAuth (Required)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Database (Optional - defaults provided)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tribe_chief_of_staff
DB_USER=postgres
DB_PASSWORD=postgres

# Session (Optional)
SESSION_SECRET=your-secret-key-here
```

## Troubleshooting

**Database Connection Issues:**
- Ensure Docker is running
- Check if ports 5432 and 6379 are available
- Verify environment variables

**OAuth Issues:**
- Check Google Console credentials
- Verify redirect URI matches exactly
- Ensure Calendar and Gmail APIs are enabled

**Build Issues:**
- Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`
- Check TypeScript compilation: `pnpm build:server`