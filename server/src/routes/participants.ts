import { Router } from 'express';
import { enhancedEntityService } from '../services/enhancedEntityService';
import { db } from '../config/database';

const router = Router();

interface ParticipantDetails {
  person?: {
    id: string;
    name: string;
    emails: string[];
    primaryEmail: string;
    company?: {
      id: string;
      name: string;
      domain?: string;
      industry?: string;
      companyType: string;
    };
    title?: string;
    confidence: number;
    lastInteraction?: Date;
    interactionCount: number;
    notableFacts: string[];
  };
  aliases: Array<{
    id: string;
    aliasName: string;
    aliasEmail?: string;
    context: string;
    confidence: number;
    verified: boolean;
  }>;
  entityResolution: {
    method: string;
    confidence: number;
    confidenceBreakdown?: {
      identity: number;
      completeness: number;
      freshness: number;
      reliability: number;
    };
    riskFlags: string[];
  };
  recentInteractions: Array<{
    date: Date;
    type: 'meeting' | 'email' | 'slack';
    context: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    role?: string;
    isActive: boolean;
  }>;
}

// GET /participants/:email - Get detailed participant information
router.get('/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`📊 Fetching participant details for: ${email}`);

    // Use real entity resolution service
    const resolution = await enhancedEntityService.resolveAttendee(email);

    if (!resolution.person) {
      // Return minimal info when person not resolved
      return res.json({
        person: null,
        aliases: [],
        entityResolution: {
          method: resolution.method,
          confidence: resolution.confidence,
          riskFlags: []
        },
        recentInteractions: [],
        projects: []
      });
    }

    // Build response from real entity data
    const participantDetails: ParticipantDetails = {
      person: {
        id: resolution.person.id,
        name: resolution.person.name,
        emails: resolution.person.emails,
        primaryEmail: resolution.person.emails[0] || email,
        company: resolution.person.company ? {
          id: resolution.person.company.id,
          name: resolution.person.company.name,
          domain: resolution.person.company.domain,
          industry: resolution.person.company.industry,
          companyType: 'external' as string // Type assertion for compatibility
        } : undefined,
        title: resolution.person.title,
        confidence: resolution.confidence,
        interactionCount: 0, // TODO: Calculate from database
        notableFacts: resolution.person.notable_facts || []
      },
      aliases: [], // TODO: Fetch from database
      entityResolution: {
        method: resolution.method,
        confidence: resolution.confidence,
        riskFlags: []
      },
      recentInteractions: [], // TODO: Fetch from database
      projects: [] // TODO: Fetch from database
    };

    console.log(`✅ Retrieved real participant details for ${resolution.person.name}: confidence ${resolution.confidence}`);
    return res.json(participantDetails);

  } catch (error) {
    console.error('Error fetching participant details:', error);
    res.status(500).json({ error: 'Failed to fetch participant details' });
  }
});

export default router;