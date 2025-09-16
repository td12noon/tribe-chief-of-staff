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

### Week 1: Project Setup
- [ ] Initialize Node.js/TypeScript project with Express
- [ ] Set up PostgreSQL database with Docker
- [ ] Configure Redis for caching and job queues
- [ ] Set up basic React/Next.js frontend
- [ ] Implement OAuth scaffolding for Google APIs

### Week 2: Google Calendar Integration
- [ ] Google Calendar API integration
- [ ] Calendar event parsing and storage
- [ ] Basic meeting card UI component
- [ ] Simple "Today's meetings" view

### Week 3: Entity Foundation
- [ ] Design person/company profile schema
- [ ] Basic entity resolution (email-based matching)
- [ ] Simple brief generation (meeting title + attendees)

## Phase 2: Core Data Sources (Weeks 4-6)

### Week 4: Gmail Integration
- [ ] Gmail API setup with proper scopes
- [ ] Email thread parsing for introductions
- [ ] Extract intro context and participants
- [ ] Link emails to calendar attendees

### Week 5: Slack Integration
- [ ] Slack API integration
- [ ] Monitor #intros, #sales, #partners channels
- [ ] Parse introduction messages
- [ ] Entity matching with Slack handles

### Week 6: Sybil Integration
- [ ] Sybil API integration
- [ ] Pull call transcripts and metadata
- [ ] Generate clips/timestamps for relevant segments
- [ ] Link call participants to meeting attendees

## Phase 3: Intelligence Layer (Weeks 7-9)

### Week 7: Enhanced Entity Resolution
- [ ] Fuzzy matching algorithm for names/emails
- [ ] Alias detection and management
- [ ] Manual override system (pin/unpin matches)
- [ ] Entity confidence scoring

### Week 8: AI Brief Generation
- [ ] LLM integration (OpenAI/Anthropic)
- [ ] Prompt engineering for brief generation
- [ ] Extract "non-obvious facts" from context
- [ ] Generate stakes, goals, and tone recommendations

### Week 9: Provenance System
- [ ] Track source lineage for all information
- [ ] One-click access to original threads/calls
- [ ] Confidence indicators for each fact
- [ ] Source prioritization logic

## Phase 4: User Experience (Weeks 10-11)

### Week 10: Frontend Polish
- [ ] Meeting card design with all brief components
- [ ] One-liner + notable fact display
- [ ] Provenance links with hover previews
- [ ] Mobile-responsive design

### Week 11: Performance & Automation
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
| Phase 1 | 3 weeks | Basic calendar + simple briefs |
| Phase 2 | 3 weeks | All data source integrations |
| Phase 3 | 3 weeks | AI-powered brief generation |
| Phase 4 | 2 weeks | Production-ready UI/UX |
| **Total** | **11 weeks** | **Full V1 Launch** |

## Next Steps

1. **Week 1 Priority**: Set up development environment and Google Calendar integration
2. **Key Decision Point**: Choose LLM provider (OpenAI vs Anthropic vs local)
3. **Early User Testing**: Get CEO feedback on mockups before Week 8
4. **Beta Launch**: Week 10 with limited feature set for initial feedback