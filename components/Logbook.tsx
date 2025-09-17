'use client';

import { useState, useEffect } from 'react';
import { Users, Building, Mail, Clock, TrendingUp, User, AlertCircle, RefreshCw } from 'lucide-react';

interface LogbookEntry {
  person: {
    id: string;
    name: string;
    emails: string[];
    primaryEmail: string;
    company?: {
      id: string;
      name: string;
      domain?: string;
      industry?: string;
    };
    title?: string;
    confidence: number;
  };
  emailActivity: {
    count: number;
    lastActivity: string | null;
    recentEmails: Array<{
      subject: string;
      snippet: string;
      timestamp: string;
      type: 'sent' | 'received' | 'thread';
      gmailUrl: string;
    }>;
  };
  interactions: {
    meetingCount: number;
    lastMeeting: string | null;
    emailCount: number;
    totalInteractions: number;
  };
}

interface LogbookData {
  entries: LogbookEntry[];
  summary: {
    totalPeople: number;
    totalCompanies: number;
    totalEmails: number;
    lastUpdated: string;
    coveragePeriod: string;
  };
}

export default function Logbook() {
  const [logbookData, setLogbookData] = useState<LogbookData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchLogbook = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:3001/api/logbook', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch logbook');
      }

      const data = await response.json();
      setLogbookData(data);
    } catch (error) {
      console.error('Error fetching logbook:', error);
      setError('Failed to load logbook');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      fetchLogbook();
    }
  }, [expanded]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-emerald-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getActivityLevel = (interactions: number) => {
    if (interactions >= 10) return { label: 'High', color: 'bg-emerald-100 text-emerald-700' };
    if (interactions >= 5) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' };
    if (interactions >= 1) return { label: 'Low', color: 'bg-blue-100 text-blue-700' };
    return { label: 'None', color: 'bg-gray-100 text-gray-600' };
  };

  return (
    <div className="mt-8 border-t border-border pt-8">
      <div className="mb-6">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center space-x-2 text-lg font-semibold text-card-foreground hover:text-primary transition-colors"
        >
          <Users className="h-5 w-5" />
          <span>Logbook - People & Email Activity</span>
          <div className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </div>
        </button>
        <p className="text-sm text-muted-foreground mt-1">
          Comprehensive mapping of contacts, companies, and email interactions
        </p>
      </div>

      {expanded && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {logbookData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">People</span>
                </div>
                <div className="text-2xl font-bold text-card-foreground mt-1">
                  {logbookData.summary.totalPeople}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Companies</span>
                </div>
                <div className="text-2xl font-bold text-card-foreground mt-1">
                  {logbookData.summary.totalCompanies}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Emails</span>
                </div>
                <div className="text-2xl font-bold text-card-foreground mt-1">
                  {logbookData.summary.totalEmails}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Coverage</span>
                </div>
                <div className="text-sm font-medium text-card-foreground mt-1">
                  {logbookData.summary.coveragePeriod}
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground">Loading comprehensive logbook...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchLogbook}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Logbook Entries */}
          {logbookData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-card-foreground">
                  Contact Directory ({logbookData.entries.length} people)
                </h3>
                <button
                  onClick={fetchLogbook}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center space-x-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {logbookData.entries.map((entry) => {
                  const activity = getActivityLevel(entry.interactions.totalInteractions);

                  return (
                    <div
                      key={entry.person.id}
                      className="bg-muted/50 rounded-lg p-4 border border-border hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="bg-primary/10 rounded-full p-2 mt-1">
                            <User className="h-4 w-4 text-primary" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-card-foreground truncate">
                                  {entry.person.name}
                                </h4>
                                <p className="text-sm text-muted-foreground truncate">
                                  {entry.person.primaryEmail}
                                </p>
                              </div>

                              <div className="ml-3 flex flex-col items-end space-y-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${activity.color}`}>
                                  {activity.label}
                                </span>
                                <span className={`text-xs ${getConfidenceColor(entry.person.confidence)}`}>
                                  {Math.round(entry.person.confidence * 100)}% confidence
                                </span>
                              </div>
                            </div>

                            {entry.person.company && (
                              <div className="mt-2 flex items-center space-x-1">
                                <Building className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm text-muted-foreground truncate">
                                  {entry.person.company.name}
                                  {entry.person.title && ` • ${entry.person.title}`}
                                </span>
                              </div>
                            )}

                            <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                              <div>
                                <span className="block text-card-foreground font-medium">
                                  {entry.emailActivity.count} emails
                                </span>
                                <span>Last: {formatDate(entry.emailActivity.lastActivity)}</span>
                              </div>
                              <div>
                                <span className="block text-card-foreground font-medium">
                                  {entry.interactions.meetingCount} meetings
                                </span>
                                <span>Last: {formatDate(entry.interactions.lastMeeting)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {logbookData.entries.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No contacts found yet. Start having meetings to build your logbook!
                  </p>
                </div>
              )}
            </div>
          )}

          {logbookData && (
            <div className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
              Last updated: {new Date(logbookData.summary.lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}