'use client';

import { useState, useEffect } from 'react';
import { Users, Building, Mail, Clock, Calendar, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';

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

export default function LogbookPage() {
  const [logbookData, setLogbookData] = useState<LogbookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'emails' | 'meetings' | 'lastActivity'>('lastActivity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
    fetchLogbook();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const sortedEntries = logbookData?.entries.sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case 'name':
        aValue = a.person.name.toLowerCase();
        bValue = b.person.name.toLowerCase();
        break;
      case 'emails':
        aValue = a.emailActivity.count;
        bValue = b.emailActivity.count;
        break;
      case 'meetings':
        aValue = a.interactions.meetingCount;
        bValue = b.interactions.meetingCount;
        break;
      case 'lastActivity':
        aValue = a.emailActivity.lastActivity ? new Date(a.emailActivity.lastActivity).getTime() : 0;
        bValue = b.emailActivity.lastActivity ? new Date(b.emailActivity.lastActivity).getTime() : 0;
        break;
      default:
        aValue = 0;
        bValue = 0;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  }) || [];

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: typeof sortBy) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <span className="text-muted-foreground">Loading logbook...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center space-x-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Today</span>
            </Link>
            <div className="h-4 w-px bg-border"></div>
            <div>
              <h1 className="text-3xl font-bold text-card-foreground flex items-center space-x-3">
                <Users className="h-8 w-8" />
                <span>Contact Logbook</span>
              </h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive directory of your professional contacts and interactions
              </p>
            </div>
          </div>
          <button
            onClick={fetchLogbook}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Summary Cards */}
        {logbookData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
                <span className="text-sm font-medium">Total Emails</span>
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

        {/* Table */}
        {logbookData && (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th
                      className="text-left p-4 font-semibold text-card-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Name</span>
                        <span className="text-xs">{getSortIcon('name')}</span>
                      </div>
                    </th>
                    <th className="text-left p-4 font-semibold text-card-foreground">Email</th>
                    <th
                      className="text-left p-4 font-semibold text-card-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => handleSort('emails')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Email Count</span>
                        <span className="text-xs">{getSortIcon('emails')}</span>
                      </div>
                    </th>
                    <th
                      className="text-left p-4 font-semibold text-card-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => handleSort('lastActivity')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Last Email</span>
                        <span className="text-xs">{getSortIcon('lastActivity')}</span>
                      </div>
                    </th>
                    <th
                      className="text-left p-4 font-semibold text-card-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => handleSort('meetings')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Meeting Count</span>
                        <span className="text-xs">{getSortIcon('meetings')}</span>
                      </div>
                    </th>
                    <th className="text-left p-4 font-semibold text-card-foreground">Last Meeting</th>
                    <th className="text-left p-4 font-semibold text-card-foreground">Company</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedEntries.map((entry) => (
                    <tr key={entry.person.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-card-foreground">
                          {entry.person.name}
                        </div>
                        {entry.person.title && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {entry.person.title}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {entry.person.primaryEmail}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-card-foreground">
                            {entry.emailActivity.count}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {formatDate(entry.emailActivity.lastActivity)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-card-foreground">
                            {entry.interactions.meetingCount}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-muted-foreground">
                          {formatDate(entry.interactions.lastMeeting)}
                        </div>
                      </td>
                      <td className="p-4">
                        {entry.person.company ? (
                          <div>
                            <div className="text-sm font-medium text-card-foreground">
                              {entry.person.company.name}
                            </div>
                            {entry.person.company.industry && (
                              <div className="text-xs text-muted-foreground">
                                {entry.person.company.industry}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sortedEntries.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No contacts found yet. Start having meetings to build your logbook!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {logbookData && (
          <div className="text-xs text-muted-foreground text-center pt-8">
            Last updated: {formatDateTime(logbookData.summary.lastUpdated)}
          </div>
        )}
      </div>
    </div>
  );
}