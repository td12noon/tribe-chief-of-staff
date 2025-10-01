'use client'

import { Calendar, Clock, Users, Link2, FileText, CheckCircle, ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import ParticipantDetailModal from "../components/ParticipantDetailModal";
import Link from 'next/link';

interface User {
  name: string;
  email: string;
  avatarUrl?: string;
}


interface Meeting {
  id: string;
  title: string;
  time: string;
  attendees: Array<{
    name: string;
    email: string;
  }>;
  oneLiner: string;
  whyNow: string;
  stakes: string;
  likelyGoal: string;
  toneRecommendation: string;
  provenanceLinks: Array<{
    type: string;
    snippet: string;
    url: string;
  }>;
}

export default function MeetingDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [, setConnections] = useState<{calendar: boolean, gmail: boolean}>({calendar: false, gmail: false});
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateLoading, setDateLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedParticipantEmail, setSelectedParticipantEmail] = useState<string | null>(null);
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  const [expandedEmailContext, setExpandedEmailContext] = useState<{[key: string]: boolean}>({});

  // Helper function to check if a date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Helper function to format date for display
  const formatDateHeader = (date: Date) => {
    if (isToday(date)) {
      return "Today's Meetings";
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow's Meetings";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday's Meetings";
    } else {
      return `${date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      })} Meetings`;
    }
  };

  // Function to return to today
  const returnToToday = () => {
    setCurrentDate(new Date());
  };

  // Function to fetch meetings for a specific date
  const fetchMeetingsForDate = async (date: Date, authenticated: boolean, showDateLoading = false) => {
    if (showDateLoading) {
      setDateLoading(true);
    }

    if (!authenticated) {
      setMeetings([]);
      setDateLoading(false);
      return;
    }

    try {
      // Format date as YYYY-MM-DD in local timezone (avoid UTC conversion)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      const calendarResponse = await fetch(`/api/calendar/today?date=${dateString}`, {
        credentials: 'include'
      });
      const calendarData = await calendarResponse.json();

      if (calendarData.success) {
        setMeetings(calendarData.events);
      } else {
        setMeetings([]);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setMeetings([]);
    } finally {
      setDateLoading(false);
    }
  };

  // Check authentication status and fetch data
  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        // Check authentication status
        const authResponse = await fetch('/api/calendar/auth-status', {
          credentials: 'include'
        });
        const authData = await authResponse.json();

        if (authData.authenticated) {
          setIsAuthenticated(true);
          setUser(authData.user);
          setConnections(authData.connections || {calendar: false, gmail: false});

          // Fetch calendar events for current date
          await fetchMeetingsForDate(currentDate, true);
        } else {
          setIsAuthenticated(false);
          setConnections({calendar: false, gmail: false});
          // Show empty state when not authenticated
          setMeetings([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // Show empty state on error
        setMeetings([]);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetchData();
  }, []);

  // Fetch meetings when date changes (only if authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      fetchMeetingsForDate(currentDate, true, true);
    }
  }, [currentDate, isAuthenticated]);

  // Re-check auth status when returning from OAuth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      // Remove the auth parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);

      // Re-check authentication status after OAuth success
      const recheckAuth = async () => {
        setLoading(true);
        try {
          const authResponse = await fetch('http://localhost:3001/api/calendar/auth-status', {
            credentials: 'include'
          });
          const authData = await authResponse.json();

          if (authData.authenticated) {
            setIsAuthenticated(true);
            setUser(authData.user);
            setConnections(authData.connections || {calendar: false, gmail: false});

            // Fetch calendar events for current date
            await fetchMeetingsForDate(currentDate, true);
          }
        } catch (error) {
          console.error('Error re-checking auth:', error);
        } finally {
          setLoading(false);
        }
      };

      recheckAuth();
    }
  }, []);

  // No mock data - show empty state when not connected

  // Participant click handler
  const handleParticipantClick = (email: string) => {
    setSelectedParticipantEmail(email);
    setIsParticipantModalOpen(true);
  };

  const handleCloseParticipantModal = () => {
    setIsParticipantModalOpen(false);
    setSelectedParticipantEmail(null);
  };

  const toggleEmailContext = (meetingId: string) => {
    setExpandedEmailContext(prev => ({
      ...prev,
      [meetingId]: !prev[meetingId]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Morning Brief</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {currentDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg">
                    <CheckCircle className="h-4 w-4" />
                    <div className="text-sm">
                      <div className="font-medium">
                        Calendar + Gmail Connected
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Email scanning enabled for meeting context
                      </div>
                    </div>
                  </div>
                  {user && (
                    <span className="text-sm text-muted-foreground">
                      {user.name}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-right">
                  <a
                    href="http://localhost:3001/auth/google"
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors inline-block"
                  >
                    Connect Calendar + Gmail
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connects calendar + scans emails for meeting context
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Today's Meetings */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={returnToToday}
                  className="p-1 rounded-lg hover:bg-accent transition-colors"
                  title="Return to today"
                >
                  <Calendar className="h-6 w-6 text-primary hover:text-primary/80" />
                </button>
                <h2 className="text-xl font-semibold text-foreground">{formatDateHeader(currentDate)}</h2>
                <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                  {meetings.length} meetings
                </span>
                {isAuthenticated && (
                  <span className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full">
                    Live from Google Calendar
                  </span>
                )}
              </div>
              {/* Day Navigation Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const prevDay = new Date(currentDate);
                    prevDay.setDate(prevDay.getDate() - 1);
                    setCurrentDate(prevDay);
                  }}
                  className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                  title="Previous day"
                >
                  <ChevronLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </button>
                <button
                  onClick={() => {
                    const nextDay = new Date(currentDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    setCurrentDate(nextDay);
                  }}
                  className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                  title="Next day"
                >
                  <ChevronRight className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>

            {/* Loading State for Date Navigation */}
            {dateLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-3 text-sm text-muted-foreground">Loading meetings...</p>
              </div>
            )}

            {/* Meetings List */}
            {!dateLoading && (
              <div className="space-y-4">
                {meetings.map((meeting) => {
                  const isSoloMeeting = meeting.attendees.length === 0;

                  return isSoloMeeting ? (
                    // Condensed view for solo meetings
                    <div key={meeting.id} className="bg-card rounded-lg shadow-sm border border-border p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-medium text-card-foreground flex-1">
                          {meeting.title}
                        </h3>
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground ml-4">
                          <Clock className="h-4 w-4" />
                          <span>{meeting.time}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Full view for meetings with other attendees
                    <div key={meeting.id} className="bg-card rounded-lg shadow-sm border border-border p-6">
                      {/* Meeting Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-card-foreground mb-1">
                            {meeting.title}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{meeting.time}</span>
                            </div>
                            {meeting.attendees.length > 0 && (
                              <div className="flex items-center space-x-1">
                                <Users className="h-4 w-4" />
                                <span>{meeting.attendees.map(a => a.name).join(", ")}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Attendees */}
                      {meeting.attendees.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-medium text-card-foreground mb-2">Meeting with</h4>
                          <div className="flex flex-wrap gap-2">
                            {meeting.attendees.map((attendee, index) => (
                              <button
                                key={index}
                                onClick={() => handleParticipantClick(attendee.email)}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors cursor-pointer"
                              >
                                <Users className="h-3 w-3 mr-1" />
                                {attendee.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Meeting Brief */}
                      <div className="mb-4">
                        <h4 className="font-medium text-card-foreground mb-2">Meeting Brief</h4>
                        <div className="space-y-2">
                          <p className="text-muted-foreground">{meeting.oneLiner}</p>
                          <p className="text-muted-foreground">{meeting.whyNow} {meeting.likelyGoal && `Their likely goal: ${meeting.likelyGoal.toLowerCase()}.`}</p>
                        </div>
                      </div>

                      {/* Condensed Email Context */}
                      {meeting.provenanceLinks.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-card-foreground">Email Context</h4>
                            <button
                              onClick={() => toggleEmailContext(meeting.id)}
                              className="flex items-center space-x-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              <span>{meeting.provenanceLinks.length} source{meeting.provenanceLinks.length !== 1 ? 's' : ''}</span>
                              {expandedEmailContext[meeting.id] ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Recent email exchanges show {meeting.provenanceLinks.length > 1 ? 'ongoing correspondence' : 'prior discussion'} about {meeting.provenanceLinks[0].snippet.toLowerCase().slice(0, 50)}...
                          </p>

                          {expandedEmailContext[meeting.id] && (
                            <div className="space-y-2 border-t border-border pt-3">
                              {meeting.provenanceLinks.map((link, index) => (
                                <div key={index} className="flex items-start space-x-2 p-3 bg-muted/60 rounded-lg border-l-2 border-primary">
                                  <div className="flex-shrink-0 mt-0.5">
                                    {link.type === 'email' && <FileText className="h-4 w-4 text-primary" />}
                                    {link.type === 'slack' && <Link2 className="h-4 w-4 text-accent-foreground" />}
                                    {link.type === 'call' && <Clock className="h-4 w-4 text-primary" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-muted-foreground italic leading-relaxed">
                                      &quot;{link.snippet}&quot;
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                                      <a href={link.url} className="text-xs text-primary hover:underline font-medium capitalize">
                                        View {link.type} correspondence →
                                      </a>
                                      <span className="text-xs text-muted-foreground">
                                        Enhanced Gmail search
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <div className="text-xs text-muted-foreground text-center pt-2">
                                📧 Includes introductions, event-related emails, and direct correspondence
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Enhanced Context Indicator */}
                      {meeting.provenanceLinks.length === 0 && (
                        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border-l-2 border-muted-foreground/20">
                          💡 No recent email context found. AI analysis based on calendar data and participant insights.
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty State (when no meetings and not loading) */}
                {meetings.length === 0 && (
                  <div className="text-center py-12">
                    <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-medium text-foreground">No meetings today</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isAuthenticated
                        ? "Enjoy your meeting-free day! Your calendar and Gmail are connected and we're monitoring for new events."
                        : "Connect your Calendar + Gmail to see upcoming meetings with smart pre-briefs and email context."
                      }
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Logbook Section */}
          {isAuthenticated && (
            <div className="mt-8 border-t border-border pt-8">
              <div className="mb-6">
                <Link
                  href="/logbook"
                  className="flex items-center space-x-2 text-lg font-semibold text-card-foreground hover:text-primary transition-colors"
                >
                  <Users className="h-5 w-5" />
                  <span>Contact Logbook</span>
                  <div className="transform transition-transform hover:translate-x-1">
                    →
                  </div>
                </Link>
                <p className="text-sm text-muted-foreground mt-1">
                  View comprehensive directory of your professional contacts and interactions
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Participant Detail Modal */}
      {selectedParticipantEmail && (
        <ParticipantDetailModal
          email={selectedParticipantEmail}
          isOpen={isParticipantModalOpen}
          onClose={handleCloseParticipantModal}
        />
      )}
    </div>
  );
}