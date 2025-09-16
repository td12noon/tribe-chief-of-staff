// Fuzzy matching utilities for enhanced entity resolution

export interface MatchCandidate {
  id: string;
  name: string;
  email?: string;
  aliases?: string[];
  confidence: number;
}

export interface FuzzyMatchResult {
  candidate: MatchCandidate;
  score: number;
  matchType: 'exact_name' | 'exact_email' | 'fuzzy_name' | 'alias' | 'email_domain';
  matchDetails?: string;
}

// Generate fuzzy name tokens for a given name
export function generateFuzzyTokens(name: string): string[] {
  if (!name || typeof name !== 'string') return [];

  const tokens: string[] = [];

  // Clean and normalize the name
  const cleanName = name.toLowerCase().trim().replace(/[^a-zA-Z0-9\s]/g, '');

  if (!cleanName) return tokens;

  // Add full name
  tokens.push(cleanName);

  // Split into parts
  const parts = cleanName.split(/\s+/).filter(part => part.length > 1);

  // Add individual parts
  parts.forEach(part => {
    tokens.push(part);
  });

  // Add first + last initial combinations
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];

    // "john s" and "j smith" patterns
    tokens.push(`${first} ${last.charAt(0)}`);
    tokens.push(`${first.charAt(0)} ${last}`);

    // "j s" pattern
    tokens.push(`${first.charAt(0)} ${last.charAt(0)}`);
  }

  // Add initials-only pattern
  if (parts.length >= 2) {
    const initials = parts.map(part => part.charAt(0)).join(' ');
    tokens.push(initials);
  }

  return [...new Set(tokens)]; // Remove duplicates
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Calculate similarity score between two strings (0-1, higher is better)
function stringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - (distance / maxLength);
}

// Calculate name match score using multiple methods
export function calculateNameMatchScore(inputName: string, candidateName: string, candidateAliases: string[] = []): number {
  if (!inputName || !candidateName) return 0;

  const inputClean = inputName.toLowerCase().trim();
  const candidateClean = candidateName.toLowerCase().trim();

  // Exact match gets perfect score
  if (inputClean === candidateClean) return 1.0;

  // Check aliases for exact match
  for (const alias of candidateAliases) {
    if (inputClean === alias.toLowerCase().trim()) return 0.95;
  }

  // Generate tokens for both names
  const inputTokens = generateFuzzyTokens(inputName);
  const candidateTokens = generateFuzzyTokens(candidateName);

  let bestScore = 0;

  // Compare all token combinations
  for (const inputToken of inputTokens) {
    for (const candidateToken of candidateTokens) {
      const similarity = stringSimilarity(inputToken, candidateToken);
      bestScore = Math.max(bestScore, similarity);
    }
  }

  // Also check tokens against aliases
  for (const alias of candidateAliases) {
    const aliasTokens = generateFuzzyTokens(alias);
    for (const inputToken of inputTokens) {
      for (const aliasToken of aliasTokens) {
        const similarity = stringSimilarity(inputToken, aliasToken);
        bestScore = Math.max(bestScore, similarity);
      }
    }
  }

  // Boost score for partial matches that make sense
  const inputParts = inputClean.split(/\s+/);
  const candidateParts = candidateClean.split(/\s+/);

  if (inputParts.length >= 2 && candidateParts.length >= 2) {
    // Check if first names match and last names are similar
    const firstMatch = stringSimilarity(inputParts[0], candidateParts[0]);
    const lastMatch = stringSimilarity(
      inputParts[inputParts.length - 1],
      candidateParts[candidateParts.length - 1]
    );

    if (firstMatch > 0.8 && lastMatch > 0.6) {
      bestScore = Math.max(bestScore, (firstMatch + lastMatch) / 2);
    }
  }

  return bestScore;
}

// Calculate email domain similarity
export function calculateEmailDomainScore(email1: string, email2: string): number {
  if (!email1 || !email2) return 0;

  const domain1 = email1.split('@')[1]?.toLowerCase();
  const domain2 = email2.split('@')[1]?.toLowerCase();

  if (!domain1 || !domain2) return 0;
  if (domain1 === domain2) return 1.0;

  return stringSimilarity(domain1, domain2);
}

// Extract company name from email domain
export function extractCompanyFromEmailDomain(email: string): string | null {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  // Skip personal email domains
  const personalDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com',
    'fastmail.com', 'hey.com'
  ];

  if (personalDomains.includes(domain)) return null;

  // Extract company name from domain (remove TLD)
  const domainParts = domain.split('.');
  if (domainParts.length >= 2) {
    return domainParts[0]
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return null;
}

// Comprehensive fuzzy matching for person resolution
export function findBestMatches(
  input: { name?: string; email?: string; displayName?: string },
  candidates: MatchCandidate[],
  threshold: number = 0.6
): FuzzyMatchResult[] {

  const results: FuzzyMatchResult[] = [];
  const inputName = input.displayName || input.name || '';
  const inputEmail = input.email || '';

  for (const candidate of candidates) {
    let bestScore = 0;
    let matchType: FuzzyMatchResult['matchType'] = 'fuzzy_name';
    let matchDetails = '';

    // Check exact email match first (highest priority)
    if (inputEmail && candidate.email) {
      if (inputEmail.toLowerCase() === candidate.email.toLowerCase()) {
        bestScore = 1.0;
        matchType = 'exact_email';
        matchDetails = 'Exact email match';
      } else {
        // Check email domain similarity
        const domainScore = calculateEmailDomainScore(inputEmail, candidate.email);
        if (domainScore > 0.8) {
          bestScore = Math.max(bestScore, domainScore * 0.7); // Domain match is good but not perfect
          matchType = 'email_domain';
          matchDetails = 'Same email domain';
        }
      }
    }

    // Check name matching
    if (inputName) {
      // Exact name match
      if (inputName.toLowerCase() === candidate.name.toLowerCase()) {
        bestScore = Math.max(bestScore, 0.95);
        if (bestScore === 0.95) {
          matchType = 'exact_name';
          matchDetails = 'Exact name match';
        }
      }

      // Fuzzy name matching
      const nameScore = calculateNameMatchScore(inputName, candidate.name, candidate.aliases);
      if (nameScore > bestScore) {
        bestScore = nameScore;
        matchType = nameScore > 0.9 ? 'alias' : 'fuzzy_name';
        matchDetails = `Name similarity: ${(nameScore * 100).toFixed(1)}%`;
      }
    }

    // Only include matches above threshold
    if (bestScore >= threshold) {
      results.push({
        candidate,
        score: bestScore,
        matchType,
        matchDetails
      });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}