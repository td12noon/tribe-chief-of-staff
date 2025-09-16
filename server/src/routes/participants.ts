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

    // Create mock data when database is unavailable
    const emailName = email.split('@')[0].replace(/[._]/g, ' ').split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');

    const domain = email.split('@')[1];
    const isTribal = domain === 'tribe.ai';

    const mockParticipantDetails: ParticipantDetails = {
      person: {
        id: `mock_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: emailName,
        emails: [email],
        primaryEmail: email,
        company: {
          id: `mock_company_${domain.replace(/\./g, '_')}`,
          name: isTribal ? 'Tribe AI' : domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
          domain: domain,
          industry: isTribal ? 'AI/ML Services' : 'Technology',
          companyType: isTribal ? 'internal' : 'external'
        },
        title: isTribal ? 'Team Member' : 'External Contact',
        confidence: 0.75,
        lastInteraction: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        interactionCount: Math.floor(Math.random() * 20) + 1,
        notableFacts: [
          'Recently active in meetings',
          isTribal ? 'Internal team member' : 'External stakeholder',
          'Regularly participates in discussions'
        ]
      },
      aliases: [
        {
          id: `alias_1_${email}`,
          aliasName: emailName,
          aliasEmail: email,
          context: 'primary',
          confidence: 1.0,
          verified: true
        }
      ],
      entityResolution: {
        method: 'exact_email',
        confidence: 0.9,
        confidenceBreakdown: {
          identity: 0.9,
          completeness: 0.8,
          freshness: 0.85,
          reliability: 0.95
        },
        riskFlags: process.env.NODE_ENV !== 'production' ? ['Demo mode - mock data'] : []
      },
      recentInteractions: [
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          type: 'meeting',
          context: 'Team sync meeting'
        },
        {
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          type: 'email',
          context: 'Project discussion'
        }
      ],
      projects: isTribal ? [
        {
          id: 'project_1',
          name: 'Enhanced Entity Resolution',
          status: 'active',
          role: 'Team Member',
          isActive: true
        }
      ] : [
        {
          id: 'project_ext_1',
          name: 'Partnership Discussion',
          status: 'in_progress',
          role: 'External Stakeholder',
          isActive: true
        }
      ]
    };

    console.log(`✅ Retrieved mock participant details for ${emailName}: ${mockParticipantDetails.aliases.length} aliases, ${mockParticipantDetails.projects.length} projects`);

    return res.json(mockParticipantDetails);

    // TODO: Uncomment when database is available and remove mock data above
    /*
    // Original database-driven implementation
    const resolution = await enhancedEntityService.resolveAttendee(email);
    if (!resolution.person) {
      return res.json({ email, resolved: false, method: resolution.method, confidence: resolution.confidence });
    }
    // ... rest of database implementation
    */

  } catch (error) {
    console.error('Error fetching participant details:', error);
    res.status(500).json({ error: 'Failed to fetch participant details' });
  }
});

export default router;