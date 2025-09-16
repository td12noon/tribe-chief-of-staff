// Multi-signal confidence scoring for enhanced entity resolution

import { Person } from '../types/entities';

export interface ConfidenceSignals {
  emailMatch: boolean;
  nameMatchScore: number;
  domainMatch: boolean;
  aliasMatch: boolean;
  interactionHistory: number; // Number of previous interactions
  manualVerification: boolean;
  timeDecay: number; // How recent the last interaction was (0-1)
  contextualClues: {
    titleMatch: boolean;
    companyMatch: boolean;
    slackHandleMatch: boolean;
  };
}

export interface ConfidenceResult {
  finalScore: number;
  breakdown: {
    identity: number;      // How sure we are this is the right person
    completeness: number;  // How much info we have about them
    freshness: number;     // How recent/relevant the data is
    reliability: number;   // How trustworthy the sources are
  };
  factors: string[];
  riskFlags: string[];
}

// Calculate comprehensive confidence score with detailed breakdown
export function calculateEnhancedConfidence(
  signals: ConfidenceSignals,
  person?: Person
): ConfidenceResult {

  const breakdown = {
    identity: 0,
    completeness: 0,
    freshness: 0,
    reliability: 0
  };

  const factors: string[] = [];
  const riskFlags: string[] = [];

  // IDENTITY CONFIDENCE (0-1): How certain we are this is the right person
  let identityScore = 0;

  if (signals.emailMatch) {
    identityScore += 0.5;
    factors.push('Exact email match');
  } else if (signals.domainMatch) {
    identityScore += 0.3;
    factors.push('Same email domain');
  }

  if (signals.nameMatchScore > 0.9) {
    identityScore += 0.4;
    factors.push('Exact name match');
  } else if (signals.nameMatchScore > 0.7) {
    identityScore += 0.25;
    factors.push('Strong name similarity');
  } else if (signals.nameMatchScore > 0.5) {
    identityScore += 0.1;
    factors.push('Partial name match');
    if (signals.nameMatchScore < 0.6) {
      riskFlags.push('Low name similarity - verify manually');
    }
  }

  if (signals.aliasMatch) {
    identityScore += 0.2;
    factors.push('Known alias match');
  }

  if (signals.contextualClues.titleMatch) {
    identityScore += 0.1;
    factors.push('Job title matches');
  }

  if (signals.contextualClues.companyMatch) {
    identityScore += 0.15;
    factors.push('Company context matches');
  }

  if (signals.contextualClues.slackHandleMatch) {
    identityScore += 0.1;
    factors.push('Slack handle matches');
  }

  if (signals.manualVerification) {
    identityScore = Math.min(1.0, identityScore + 0.3);
    factors.push('Manually verified');
  }

  breakdown.identity = Math.min(1.0, identityScore);

  // COMPLETENESS CONFIDENCE (0-1): How much information we have
  let completenessScore = 0;

  if (person) {
    if (person.emails.length > 1) {
      completenessScore += 0.1;
      factors.push('Multiple email addresses');
    }

    if (person.title) {
      completenessScore += 0.2;
      factors.push('Job title known');
    }

    if (person.company_id) {
      completenessScore += 0.2;
      factors.push('Company affiliation');
    }

    if (person.linkedin_url) {
      completenessScore += 0.15;
      factors.push('LinkedIn profile');
    }

    if (person.slack_handles?.length > 0) {
      completenessScore += 0.1;
      factors.push('Slack handle(s)');
    }

    if (person.notable_facts?.length > 0) {
      completenessScore += 0.15;
      factors.push('Notable facts recorded');
    }

    if (person.aliases?.length > 0) {
      completenessScore += 0.1;
      factors.push('Known aliases');
    }
  }

  // Base completeness for having basic info
  completenessScore += 0.2;

  breakdown.completeness = Math.min(1.0, completenessScore);

  // FRESHNESS CONFIDENCE (0-1): How recent and relevant the data is
  let freshnessScore = 0.5; // Base score

  if (signals.timeDecay > 0.8) {
    freshnessScore += 0.3;
    factors.push('Recent interaction');
  } else if (signals.timeDecay > 0.5) {
    freshnessScore += 0.2;
    factors.push('Moderately recent activity');
  } else if (signals.timeDecay < 0.2) {
    freshnessScore -= 0.2;
    riskFlags.push('Old data - may be outdated');
  }

  if (signals.interactionHistory > 5) {
    freshnessScore += 0.2;
    factors.push('Strong interaction history');
  } else if (signals.interactionHistory > 1) {
    freshnessScore += 0.1;
    factors.push('Some interaction history');
  }

  breakdown.freshness = Math.min(1.0, Math.max(0, freshnessScore));

  // RELIABILITY CONFIDENCE (0-1): How trustworthy our sources are
  let reliabilityScore = 0.4; // Base reliability

  if (signals.manualVerification) {
    reliabilityScore += 0.4;
    factors.push('Human verified');
  }

  if (signals.emailMatch) {
    reliabilityScore += 0.3;
    factors.push('Email verification');
  }

  if (signals.interactionHistory > 0) {
    reliabilityScore += 0.2;
    factors.push('Historical interactions');
  }

  if (signals.contextualClues.companyMatch && signals.domainMatch) {
    reliabilityScore += 0.1;
    factors.push('Company context verified');
  }

  // Penalty for weak signals
  if (!signals.emailMatch && signals.nameMatchScore < 0.7) {
    reliabilityScore -= 0.2;
    riskFlags.push('Weak identification signals');
  }

  breakdown.reliability = Math.min(1.0, Math.max(0, reliabilityScore));

  // FINAL SCORE CALCULATION
  // Weight the different aspects based on importance for meeting briefs
  const weights = {
    identity: 0.4,      // Most important - are we talking about the right person?
    reliability: 0.3,   // Second - can we trust this data?
    completeness: 0.2,  // Third - how much context do we have?
    freshness: 0.1      // Least important - but still matters
  };

  const finalScore = (
    breakdown.identity * weights.identity +
    breakdown.reliability * weights.reliability +
    breakdown.completeness * weights.completeness +
    breakdown.freshness * weights.freshness
  );

  // Add risk flags based on final score
  if (finalScore < 0.3) {
    riskFlags.push('Very low confidence - review needed');
  } else if (finalScore < 0.5) {
    riskFlags.push('Low confidence - verify if possible');
  }

  return {
    finalScore: Math.round(finalScore * 100) / 100, // Round to 2 decimals
    breakdown: {
      identity: Math.round(breakdown.identity * 100) / 100,
      completeness: Math.round(breakdown.completeness * 100) / 100,
      freshness: Math.round(breakdown.freshness * 100) / 100,
      reliability: Math.round(breakdown.reliability * 100) / 100
    },
    factors: [...new Set(factors)], // Remove duplicates
    riskFlags: [...new Set(riskFlags)]
  };
}

// Calculate time decay factor based on last interaction
export function calculateTimeDecay(lastInteractionDate?: Date): number {
  if (!lastInteractionDate) return 0.3; // No interaction history

  const now = new Date();
  const daysSince = (now.getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince <= 7) return 1.0;      // Within a week
  if (daysSince <= 30) return 0.8;     // Within a month
  if (daysSince <= 90) return 0.6;     // Within 3 months
  if (daysSince <= 180) return 0.4;    // Within 6 months
  if (daysSince <= 365) return 0.2;    // Within a year
  return 0.1; // Older than a year
}

// Generate confidence summary for UI display
export function generateConfidenceSummary(result: ConfidenceResult): string {
  const score = result.finalScore;

  if (score >= 0.9) {
    return `Very High (${(score * 100).toFixed(0)}%) - ${result.factors.slice(0, 2).join(', ')}`;
  } else if (score >= 0.7) {
    return `High (${(score * 100).toFixed(0)}%) - ${result.factors.slice(0, 2).join(', ')}`;
  } else if (score >= 0.5) {
    return `Medium (${(score * 100).toFixed(0)}%) - ${result.factors.slice(0, 1).join('')}`;
  } else if (score >= 0.3) {
    return `Low (${(score * 100).toFixed(0)}%) - Limited verification`;
  } else {
    return `Very Low (${(score * 100).toFixed(0)}%) - Requires review`;
  }
}

// Check if confidence is sufficient for different use cases
export function isConfidenceSufficient(
  score: number,
  useCase: 'brief_generation' | 'ai_analysis' | 'contact_merge' | 'display_only'
): boolean {
  const thresholds = {
    brief_generation: 0.6,  // Medium confidence needed for brief generation
    ai_analysis: 0.5,       // Lower threshold for AI analysis (can handle uncertainty)
    contact_merge: 0.8,     // High confidence needed for merging contacts
    display_only: 0.3       // Low threshold for just displaying information
  };

  return score >= thresholds[useCase];
}