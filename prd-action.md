# Implementation Plan: Meeting Pre-Briefs System

## Architecture Overview

### Tech Stack
- **Backend**: Node.js/Express with TypeScript
- **Database**: PostgreSQL with Redis for caching
- **Frontend**: React/Next.js
- **Authentication**: OAuth 2.0 for all integrations
- **Deployment**: Docker containers on AWS/GCP
- **Message Queue**: Bull/Redis for background processing

### Core Components
1. **Data Ingestion Service**: Pulls from Calendar, Gmail, Slack, Sybil
2. **Entity Resolution Engine**: Matches people/companies across sources
3. **Brief Generation Service**: AI-powered summarization with provenance
4. **Web Interface**: Morning dashboard with meeting cards
5. **Profile Store**: Lightweight person/company database

## Phase 1: Foundation (Weeks 1-3)

### Week 1: Project Setup ✅ COMPLETED
- [x] Initialize Node.js/TypeScript project with Express
- [x] Set up PostgreSQL database with Docker
- [x] Configure Redis for caching and job queues
- [x] Set up basic React/Next.js frontend
- [x] Implement OAuth scaffolding for Google APIs

### Week 2: Google Calendar Integration ✅ COMPLETED
- [x] Google Calendar API integration
- [x] Calendar event parsing and storage
- [x] Basic meeting card UI component
- [x] Simple "Today's meetings" view
- [x] **BONUS**: User authentication with Google OAuth
- [x] **BONUS**: Database-first UserService with memory fallback
- [x] **BONUS**: Real calendar events integration working
- [x] **BONUS**: Dynamic UI showing connection status

### Week 3: Entity Foundation ✅ COMPLETED
- [x] Design person/company profile schema
- [x] Basic entity resolution (email-based matching)
- [x] Simple brief generation (meeting title + attendees)
- [x] **BONUS**: Advanced calendar navigation with date switching
- [x] **BONUS**: Dynamic date headers (Today/Tomorrow/Yesterday/Specific Date)
- [x] **BONUS**: Timezone-aware date handling for accurate calendar data
- [x] **BONUS**: Clickable calendar icon to return to today

## Phase 2: AI Intelligence & LinkedIn (Weeks 4-6)

### Week 4: AI Brief Generation & LLM Integration ✅ COMPLETED
- [x] LLM integration (Anthropic Claude claude-3-haiku-20240307)
- [x] Prompt engineering for intelligent brief generation with contextual analysis
- [x] Generate contextual stakes, goals, and tone recommendations
- [x] Extract key insights and meeting categorization from attendee data
- [x] Smart meeting analysis with confidence scoring
- [x] **BONUS**: Professional Violet Bloom theme integration (TweakCN)
- [x] **BONUS**: Enhanced UX with loading states and smart date navigation
- [x] **BONUS**: Condensed solo meeting cards for improved layout
- [x] **BONUS**: AI-powered meeting insights with fallback logic

### Week 5: LinkedIn Integration & Profile Enrichment ✅ COMPLETED
- [x] LinkedIn API integration for profile data
- [x] Company and person profile enrichment
- [x] Professional background and experience extraction
- [x] Recent activity and post analysis
- [x] Connection mapping and mutual contacts
- [x] **BONUS**: Advanced entity resolution with enhanced fuzzy matching
- [x] **BONUS**: Confidence scoring system with multiple matching strategies
- [x] **BONUS**: Interactive participant detail modal for rich profile display

### Week 6: Enhanced Entity Resolution & Provenance ✅ COMPLETED
- [x] Fuzzy matching algorithm for names/emails
- [x] Alias detection and management
- [x] Manual override system (pin/unpin matches)
- [x] Entity confidence scoring
- [x] Source lineage tracking and confidence indicators
- [x] **BONUS**: Clickable participant detail modal with enhanced entity resolution showcase
- [x] **BONUS**: Complete participant profile system with email matching
- [x] **BONUS**: Advanced confidence scoring with fuzzy matching utilities

## Phase 3: Communication Data Sources (Weeks 7-9)

### Week 7: Gmail Integration
- [ ] Gmail API setup with proper scopes
- [ ] Email thread parsing for introductions
- [ ] Extract intro context and participants
- [ ] Link emails to calendar attendees
- [ ] Integration with AI brief generation

### Week 8: LinkedIn Integration & Profile Enrichment
- [ ] LinkedIn API integration for profile data
- [ ] Company and person profile enrichment
- [ ] Professional background and experience extraction
- [ ] Recent activity and post analysis
- [ ] Connection mapping and mutual contacts

### Week 9: Slack Integration
- [ ] Slack API integration
- [ ] Monitor #intros, #sales, #partners channels
- [ ] Parse introduction messages
- [ ] Entity matching with Slack handles
- [ ] Feed context into AI brief system

## Phase 4: Advanced Integrations & Polish (Weeks 10-12)

### Week 10: Sybil Integration
- [ ] Sybil API integration
- [ ] Pull call transcripts and metadata
- [ ] Generate clips/timestamps for relevant segments
- [ ] Link call participants to meeting attendees
- [ ] Enhanced AI briefs with call context

### Week 11: Frontend Polish
- [ ] Meeting card design with all brief components
- [ ] One-liner + notable fact display
- [ ] Provenance links with hover previews
- [ ] Mobile-responsive design

### Week 12: Performance & Automation
- [ ] Daily pre-computation at 6:30-7:00 AM
- [ ] On-demand refresh for new meetings
- [ ] <2s load time optimization
- [ ] Background job processing

## Data Models

### Person Profile
```typescript
interface Person {
  id: string;
  emails: string[];
  slackHandles: string[];
  name: string;
  company: string;
  title: string;
  notableFacts: string[];
  aliases: string[];
  confidence: number;
}
```

### Meeting Brief
```typescript
interface MeetingBrief {
  eventId: string;
  oneLiner: string;
  whyNow: string;
  stakes: string;
  likelyGoal: string;
  toneRecommendation: string;
  provenanceLinks: ProvenanceLink[];
  attendees: Person[];
  generatedAt: Date;
}
```

### Provenance Link
```typescript
interface ProvenanceLink {
  type: 'email' | 'slack' | 'call';
  url: string;
  snippet: string;
  timestamp?: Date;
  confidence: number;
}
```

## Integration Specifications

### Google Calendar API
- **Scopes**: `calendar.readonly`
- **Data**: Event metadata, attendees, time, location
- **Frequency**: Real-time webhooks + daily sync

### LinkedIn API
- **Scopes**: `r_liteprofile`, `r_organization_social`, `r_basicprofile`
- **Data**: Professional profiles, company pages, recent posts, connections
- **Processing**: Extract background, experience, company info, recent activity
- **Enrichment**: Enhance person/company entities with professional context

### Gmail API
- **Scopes**: `gmail.readonly`
- **Search**: Threads containing "intro" keywords, recent 30-45 days
- **Processing**: Extract introduction context, participant details

### Slack API
- **Scopes**: `channels:read`, `channels:history`
- **Channels**: #intros, #sales, #partners (configurable)
- **Processing**: Parse introduction messages, extract participant info

### Sybil API
- **Data**: Call transcripts, participant lists, timestamps
- **Processing**: Generate relevant clips (60-120s), extract context
- **Linking**: Match call participants to meeting attendees

## Security & Privacy

### Data Handling
- All integrations read-only in V1
- Explicit OAuth scopes with user consent
- Data retention policy (30-90 days for processed briefs)
- Secure credential storage (AWS Secrets Manager)

### User Controls
- Toggle sources on/off per integration
- Manual entity override system
- Brief regeneration on demand
- Export/delete personal data

## Performance Requirements

### Target Metrics
- Brief generation: <2s response time
- Daily processing: Complete by 7:00 AM
- Entity resolution: 95% accuracy for email matches
- Provenance retrieval: <500ms per link

### Optimization Strategies
- Pre-compute briefs during off-hours
- Cache entity matches for 24h
- Lazy load provenance content
- CDN for static assets

## Deployment Strategy

### Infrastructure
- **App Server**: Docker containers on ECS/GKE
- **Database**: RDS PostgreSQL with read replicas
- **Cache**: ElastiCache Redis cluster
- **Storage**: S3 for clips and attachments
- **Monitoring**: CloudWatch/Datadog

### CI/CD Pipeline
1. GitHub Actions for testing
2. Automated security scanning
3. Staging environment for testing
4. Blue-green deployment for production
5. Database migration scripts

## Risk Mitigation

### Technical Risks
- **API Rate Limits**: Implement exponential backoff, request batching
- **Entity Mismatches**: Start with conservative matching, user feedback loop
- **Data Privacy**: Audit all data access, implement data minimization
- **Integration Failures**: Circuit breakers, graceful degradation

### Business Risks
- **Over-summarization**: Always preserve source links
- **Context Loss**: Include quoted snippets with summaries
- **User Adoption**: Start with power user, iterate based on feedback
- **Scope Creep**: Strict V1 feature freeze after Phase 4

## Success Metrics

### Launch Criteria
- [ ] 90% of external meetings have person/company one-liner
- [ ] 90% have provenance link to source
- [ ] 80% have relevant call clip or timestamp
- [ ] <2s brief loading time
- [ ] Zero security incidents in beta testing

### Post-Launch KPIs
- Daily active usage by CEO
- Time saved per morning (target: 10-15 minutes)
- Accuracy feedback on generated briefs
- Click-through rate on provenance links
- User satisfaction score (target: 8/10)

## Future Roadmap (Post-V1)

### Phase 5: Advanced Features
- Executive review mode with decision timelines
- Unified action inbox from Slack/Gmail
- Time insights and meeting analytics
- Custom brief templates by meeting type

### Phase 6: Scale & Intelligence
- Multi-user support for executive teams
- Advanced NLP for better context extraction
- Predictive briefing for recurring contacts
- Integration with CRM systems (Salesforce, HubSpot)

## Development Timeline Summary

| Phase | Duration | Key Deliverable |
|-------|----------|-----------------|
| Phase 1 | 3 weeks | Foundation + advanced calendar navigation ✅ |
| Phase 2 | 3 weeks | AI briefs + entity resolution system ✅ |
| Phase 3 | 3 weeks | Gmail/LinkedIn/Slack data source integrations |
| Phase 4 | 3 weeks | Sybil integration + production-ready UI/UX |
| **Total** | **12 weeks** | **Full V1 Launch** |

## Current Status & Next Steps

### ✅ **COMPLETED (Weeks 1-6) - PHASE 2 COMPLETE!**
We've successfully completed Phase 1 and Phase 2 ahead of schedule! The system now includes:

**Phase 1 - Foundation & Calendar (Weeks 1-3):**
- Full-stack application with Next.js frontend and Express.js backend
- Working Google OAuth with Calendar and Gmail scopes
- Live calendar integration pulling real events
- Database-first user management with memory fallback
- Complete database schema for people, companies, and meeting briefs
- Email-based entity resolution with company domain matching
- AI-powered brief generation with contextual insights
- Advanced UI features: date navigation, dynamic headers, timezone handling

**Phase 2 - AI Intelligence & Entity Resolution (Weeks 4-6):**
- LLM integration with Anthropic Claude for intelligent brief generation
- Advanced entity resolution with fuzzy matching algorithms
- Confidence scoring system with multiple matching strategies
- Interactive participant detail modal with enhanced profiles
- Alias detection and management system
- Source lineage tracking and confidence indicators
- Professional Violet Bloom theme integration

**Key Features Delivered:**
- Advanced calendar navigation with real-time data fetching
- AI-powered meeting insights with contextual analysis
- Clickable participant profiles with detailed entity resolution
- Smart date handling with timezone awareness
- Enhanced entity matching with confidence scoring
- Modern UI with loading states and responsive design

### 🎯 **CURRENT PRIORITY: Phase 3 - Week 7 Gmail Integration**
Entity resolution system complete! Ready to add Gmail integration for introduction context and provenance.

### 📋 **Immediate Next Steps**
1. **Week 7 Priority**: Gmail API integration for email thread parsing and introduction context
2. **Strategic Focus**: Extract intro context from email threads and link to meeting attendees
3. **Week 8 Target**: LinkedIn API integration for professional profile enrichment
4. **Week 9 Goal**: Slack integration for monitoring introduction channels
5. **User Impact**: CEO gets comprehensive meeting context from all communication sources
6. **Technical Advantage**: Robust entity resolution ready for multi-source data enrichment