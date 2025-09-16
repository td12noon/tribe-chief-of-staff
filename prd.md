# PRD: Meeting Pre-Briefs (V1)

## 1. Overview
Build an automated system that generates **smart pre-briefs** for every calendar event. Each brief concisely explains **who is attending, why the meeting matters, and the non-obvious context** (e.g., “actually the founder of Insight”). It includes links to the provenance (intro thread, Slack message, or Sybil clip) so the user can validate context in one click.  

This feature reduces “surprise senior” moments and fragmented preparation, while being lightweight enough to ship quickly using **Google Calendar, Gmail, Slack, and Sybil integrations**.  

---

## 2. Goals & Success Criteria

### Goals
- **Arrive prepared**: Every external meeting comes with the one-liner and the “gotcha” detail.  
- **Context with provenance**: Always show where the intro came from (thread, email, call).  
- **Frictionless access**: Open source material in ≤1 click.  

### Success Criteria
- 90% of external meetings surface:  
  1. Correct person/company one-liner.  
  2. Provenance link (intro thread, prior call, or doc).  
  3. ≤120s clip attached (or timestamp link).  
- Pre-brief loads in <2s in the Today view.  

---

## 3. Scope (V1)

### Inputs
- **Google Calendar**: event metadata, attendees.  
- **Gmail**: recent intro threads (last 30–45 days).  
- **Slack**: messages in #intros/#sales/#partners channels.  
- **Sybil**: recent calls mentioning attendee or company, with linkable timestamps/clips.  

### Outputs (per event card)
- **One-liner**: Person/company + notable “non-obvious” fact.  
- **Why now**: Provenance (who intro’d, from which thread/call, with quoted line).  
- **Bullets**:  
  - Stakes.  
  - Likely goal.  
  - Tone/prep recommendation (e.g., “blazer day”).  
- **Links**: Relevant doc + 60–120s call clip (or timestamp link).  

---

## 4. User Stories
- *As Jackie, I open my morning brief and instantly know who I’m meeting, why, and the one non-obvious fact I would have missed.*  
- *As Jackie, I can click once from a pre-brief to the original intro thread or call clip, so I trust the summary without worrying about over-filtering.*  

---

## 5. Technical Notes

### Data Handling
- **Entity Resolution**: Match across email addresses, Slack handles, and calendar attendees. Fuzzy matching to tolerate aliases.  
- **People/Company Profiles**: Maintain a lightweight profile store with roles, funds, and notable facts (updated from Gmail/Slack/Sybil).  

### Processing
- **Precompute**: Generate briefs at 6:30–7:00am daily for all meetings that day.  
- **On-demand Refresh**: Regenerate when a new meeting is added to calendar.  

### Privacy & Permissions
- All integrations are **read-only** in V1.  
- Explicit scopes for each integration; allow toggling per source.  

### Performance
- Target latency <2s for displaying a pre-brief.  
- Provenance graph kept lightweight (simple links, no heavy graph traversal).  

---

## 6. Risks & Mitigations
- **Entity mismatches**: Start with deterministic matching; allow user overrides (pin/unpin).  
- **Over-summarization**: Always include source link/clip.  
- **Integration creep**: Strictly limit V1 to Calendar, Gmail, Slack, and Sybil.  

---

## 7. Future Extensions (post-V1)
- **Executive Review Mode**: Timeline of key calls/decisions.  
- **Unified Action Inbox**: Pull Slack/Gmail tasks into one queue.  
- **Time Insights**: Weekly report on time spent by theme (sales, partnerships, delivery, hiring).  
