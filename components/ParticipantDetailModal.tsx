'use client';

import { useState, useEffect } from 'react';
import { X, User, Building, Mail, Calendar, AlertTriangle, CheckCircle, Eye, Briefcase } from 'lucide-react';

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
    lastInteraction?: string;
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
    date: string;
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

interface ParticipantDetailModalProps {
  email: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ParticipantDetailModal({
  email,
  isOpen,
  onClose
}: ParticipantDetailModalProps) {
  const [details, setDetails] = useState<ParticipantDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && email) {
      fetchParticipantDetails();
    }
  }, [isOpen, email]);

  const fetchParticipantDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/participants/${encodeURIComponent(email)}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch participant details');
      }

      const data = await response.json();
      setDetails(data);
    } catch (error) {
      console.error('Error fetching participant details:', error);
      setError('Failed to load participant details');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'exact_email': 'Exact Email Match',
      'fuzzy_name': 'Name Similarity',
      'alias_match': 'Known Alias',
      'domain_match': 'Company Domain',
      'manual_override': 'Manual Override',
      'internal_inference': 'Internal Detection'
    };
    return labels[method] || method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4 text-center sm:p-0">
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

        <div className="relative w-full max-w-4xl mx-auto bg-card rounded-lg shadow-2xl border border-border">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-muted-foreground" />
              <div>
                <h2 className="text-xl font-semibold text-card-foreground">
                  {details?.person?.name || 'Loading...'}
                </h2>
                <p className="text-sm text-muted-foreground">{email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-card-foreground transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-96 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600">{error}</p>
                <button
                  onClick={fetchParticipantDetails}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {details && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Basic Information */}
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <h3 className="font-medium text-card-foreground mb-3 flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Basic Information
                    </h3>

                    {details.person ? (
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Name:</span>
                          <span className="ml-2 font-medium">{details.person.name}</span>
                        </div>

                        {details.person.title && (
                          <div>
                            <span className="text-muted-foreground">Title:</span>
                            <span className="ml-2">{details.person.title}</span>
                          </div>
                        )}

                        {details.person.company && (
                          <div className="flex items-center">
                            <Building className="h-3 w-3 text-muted-foreground mr-1" />
                            <span className="text-muted-foreground">Company:</span>
                            <span className="ml-2">{details.person.company.name}</span>
                            {details.person.company.industry && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({details.person.company.industry})
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center">
                          <Mail className="h-3 w-3 text-muted-foreground mr-1" />
                          <span className="text-muted-foreground">Emails:</span>
                          <div className="ml-2">
                            {details.person.emails.map((email, index) => (
                              <div key={email} className={index === 0 ? 'font-medium' : 'text-xs text-muted-foreground'}>
                                {email} {index === 0 && '(primary)'}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 text-muted-foreground mr-1" />
                          <span className="text-muted-foreground">Interactions:</span>
                          <span className="ml-2">{details.person.interactionCount} meetings</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">Person not resolved in database</p>
                    )}
                  </div>

                  {/* Entity Resolution */}
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <h3 className="font-medium text-card-foreground mb-3 flex items-center">
                      <Eye className="h-4 w-4 mr-2" />
                      Entity Resolution
                    </h3>

                    <div className="space-y-3">
                      <div className={`px-3 py-2 rounded-lg border text-sm ${getConfidenceColor(details.entityResolution.confidence)}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {getConfidenceLabel(details.entityResolution.confidence)}
                          </span>
                          <span className="text-xs">
                            {(details.entityResolution.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <div>Method: {getMethodLabel(details.entityResolution.method)}</div>

                        {details.entityResolution.confidenceBreakdown && (
                          <div className="mt-2 space-y-1">
                            <div>Identity: {(details.entityResolution.confidenceBreakdown.identity * 100).toFixed(0)}%</div>
                            <div>Completeness: {(details.entityResolution.confidenceBreakdown.completeness * 100).toFixed(0)}%</div>
                            <div>Reliability: {(details.entityResolution.confidenceBreakdown.reliability * 100).toFixed(0)}%</div>
                          </div>
                        )}
                      </div>

                      {details.entityResolution.riskFlags.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-yellow-600 mb-1">Risk Flags:</div>
                          {details.entityResolution.riskFlags.map((flag, index) => (
                            <div key={index} className="text-xs text-yellow-600">• {flag}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Extended Information */}
                <div className="space-y-4">

                  {/* Aliases */}
                  {details.aliases.length > 0 && (
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <h3 className="font-medium text-card-foreground mb-3">Known Aliases</h3>
                      <div className="space-y-2">
                        {details.aliases.map((alias) => (
                          <div key={alias.id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">{alias.aliasName}</div>
                              {alias.aliasEmail && (
                                <div className="text-xs text-muted-foreground">{alias.aliasEmail}</div>
                              )}
                              <div className="text-xs text-muted-foreground capitalize">
                                {alias.context} • {(alias.confidence * 100).toFixed(0)}% confidence
                              </div>
                            </div>
                            {alias.verified && (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Projects */}
                  {details.projects.length > 0 && (
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <h3 className="font-medium text-card-foreground mb-3 flex items-center">
                        <Briefcase className="h-4 w-4 mr-2" />
                        Projects
                      </h3>
                      <div className="space-y-2">
                        {details.projects.map((project) => (
                          <div key={project.id} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{project.name}</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                project.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {project.status}
                              </span>
                            </div>
                            {project.role && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Role: {project.role}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notable Facts */}
                  {details.person?.notableFacts && details.person.notableFacts.length > 0 && (
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <h3 className="font-medium text-card-foreground mb-3">Notable Facts</h3>
                      <div className="space-y-1">
                        {details.person.notableFacts.map((fact, index) => (
                          <div key={index} className="text-sm text-muted-foreground">
                            • {fact}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Interactions */}
                  {details.recentInteractions.length > 0 && (
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <h3 className="font-medium text-card-foreground mb-3">Recent Activity</h3>
                      <div className="space-y-2">
                        {details.recentInteractions.slice(0, 5).map((interaction, index) => (
                          <div key={index} className="text-sm">
                            <div className="flex items-center justify-between">
                              <span className="capitalize">{interaction.type}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(interaction.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {interaction.context}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}