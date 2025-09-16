# Tribe Chief of Staff - Meeting Pre-Brief System

An AI-powered executive assistant that generates intelligent meeting briefs by analyzing calendar events, attendee data, and contextual information to help CEOs prepare for meetings with rich background and strategic insights.

## 🎯 Project Overview

This system automatically pulls calendar events, resolves attendee identities, and generates comprehensive meeting briefs that include:
- **One-liner summaries** with attendee context
- **Strategic stakes** and why the meeting matters now
- **Likely meeting goals** based on event analysis
- **Tone recommendations** for optimal engagement
- **AI-powered insights** with confidence scoring

## ✨ Current Features (Phase 1 & 2 Complete)

### 🗓️ Calendar Integration
- **Google Calendar API** integration with OAuth authentication
- **Real-time calendar synchronization** with any date navigation
- **Timezone-aware date handling** for accurate event display
- **Advanced date navigation** with previous/next day arrows
- **Smart date headers** (Today/Tomorrow/Yesterday/Specific Date)
- **Calendar icon quick-return** to today's view

### 🤖 AI-Powered Brief Generation
- **Anthropic Claude integration** (claude-3-haiku-20240307)
- **Intelligent prompt engineering** for contextual meeting analysis
- **Meeting categorization** and strategic insights
- **Confidence scoring** for brief reliability
- **Fallback logic** when AI is unavailable
- **Key insights extraction** from attendee and event data

### 👥 Entity Resolution System
- **Email-based attendee matching** with confidence scoring
- **Company domain resolution** for automatic company association
- **Person/company profile database** with TypeScript interfaces
- **Database-first architecture** with memory store fallback
- **Real-time attendee analysis** and profile enrichment

### 🎨 Professional UI/UX
- **Violet Bloom theme** integration (TweakCN) with modern color palette
- **Loading states** with smooth date navigation transitions
- **Condensed solo meeting cards** for events without attendees
- **Responsive design** with shadcn/ui components
- **Professional typography** (Plus Jakarta Sans, Lora, IBM Plex Mono)
- **Dark mode support** with oklch color space

## 🏗️ Technical Architecture

### Frontend
- **Next.js 14** with React and TypeScript
- **Tailwind CSS** with custom design tokens
- **shadcn/ui** component library
- **Modern CSS** with oklch color definitions and custom variants

### Backend
- **Express.js** with TypeScript
- **PostgreSQL** database with Redis caching
- **Google OAuth 2.0** for calendar and Gmail access
- **Anthropic Claude API** for AI brief generation
- **Database migrations** and schema management

### Key Components
- **AI Service** (`aiService.ts`) - Anthropic Claude integration
- **Brief Service** (`briefService.ts`) - Meeting brief orchestration
- **Entity Service** (`entityService.ts`) - Attendee resolution
- **Calendar Service** (`calendarService.ts`) - Google Calendar integration
- **User Service** (`userService.ts`) - Authentication management

## 📊 Development Status

### ✅ Phase 1: Foundation (Weeks 1-3) - COMPLETE
- [x] Full-stack application setup (Next.js + Express.js)
- [x] PostgreSQL database with Redis caching
- [x] Google OAuth with Calendar API integration
- [x] Basic entity resolution and meeting brief generation
- [x] Advanced calendar navigation and timezone handling

### ✅ Phase 2: AI Intelligence (Week 4) - COMPLETE
- [x] Anthropic Claude LLM integration
- [x] Intelligent brief generation with contextual analysis
- [x] Meeting categorization and confidence scoring
- [x] Professional Violet Bloom theme integration
- [x] Enhanced UX with loading states and smart layouts

### 🎯 Phase 2: LinkedIn Integration (Week 5) - NEXT
- [ ] LinkedIn API integration for profile data
- [ ] Professional background and experience extraction
- [ ] Company and person profile enrichment
- [ ] Recent activity and connection analysis

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and pnpm
- PostgreSQL database
- Redis server
- Google Cloud Console project with Calendar API
- Anthropic API key

### Environment Setup

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd tribe-chief-of-staff
pnpm install
```

2. **Configure environment variables**:
```bash
# Copy example environment files
cp server/.env.example server/.env
cp .env.example .env.local

# Add your API keys to server/.env:
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
ANTHROPIC_API_KEY=your_anthropic_api_key
```

3. **Start services**:
```bash
# Start database and Redis (using Docker Compose)
docker-compose up -d postgres redis

# Run database migrations
cd server && pnpm run migrate

# Start development servers
pnpm run dev:all
```

4. **Access the application**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Development Commands

```bash
# Start all services
pnpm run dev:all

# Individual services
pnpm run dev:frontend  # Next.js on :3000
pnpm run dev:server    # Express.js on :3001

# Database operations
cd server
pnpm run migrate       # Run migrations
pnpm run db:reset      # Reset database
```

## 🔧 Configuration

### Google Calendar Setup
1. Create a Google Cloud Console project
2. Enable the Google Calendar API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs:
   - `http://localhost:3001/auth/google/callback`

### Database Schema
The system uses a comprehensive PostgreSQL schema with tables for:
- `users` - User authentication and profiles
- `people` - Individual contact profiles
- `companies` - Company information and metadata
- `meeting_briefs` - AI-generated meeting summaries
- `meeting_attendees` - Attendee resolution data
- `provenance_links` - Source attribution (future)

## 🎨 Design System

### Theme: Violet Bloom
- **Primary Color**: `oklch(0.5393 0.2713 286.7462)` - Professional purple
- **Typography**: Plus Jakarta Sans (headings), Lora (serif), IBM Plex Mono
- **Radius**: 1.4rem for modern rounded corners
- **Shadows**: Multi-layered with configurable opacity
- **Dark Mode**: Comprehensive dark theme support

### Component Architecture
- **shadcn/ui** foundation with custom styling
- **Tailwind CSS** with design tokens
- **Custom CSS variables** for consistent theming
- **Responsive design** patterns

## 📈 Upcoming Features (Phase 3-4)

### Communication Integration
- **Gmail API** for email context and introductions
- **Slack API** for team communication analysis
- **Sybil integration** for call transcript context

### Enhanced Intelligence
- **Advanced entity resolution** with fuzzy matching
- **Provenance tracking** with source attribution
- **Manual override system** for entity relationships
- **Predictive briefing** for recurring contacts

## 🤝 Contributing

This is a private project for CEO meeting preparation. Development follows the roadmap outlined in `prd-action.md`.

## 📚 Documentation

- **PRD & Roadmap**: `prd-action.md` - Complete project requirements and development timeline
- **API Documentation**: Available at `/api/docs` when server is running
- **Database Schema**: `server/migrations/` directory

---

*Last updated: September 2024 - Week 4 AI Integration Complete*