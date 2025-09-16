'use client'

import { Calendar, Clock, Users, Link2, FileText, CheckCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import ParticipantDetailModal from "../components/ParticipantDetailModal";

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
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateLoading, setDateLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedParticipantEmail, setSelectedParticipantEmail] = useState<string | null>(null);
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);

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
      setMeetings(mockMeetings);
      setDateLoading(false);
      return;
    }

    try {
      // Format date as YYYY-MM-DD in local timezone (avoid UTC conversion)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      const calendarResponse = await fetch(`http://localhost:3001/api/calendar/today?date=${dateString}`, {
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
        const authResponse = await fetch('http://localhost:3001/api/calendar/auth-status', {
          credentials: 'include'
        });
        const authData = await authResponse.json();

        if (authData.authenticated) {
          setIsAuthenticated(true);
          setUser(authData.user);

          // Fetch calendar events for current date
          await fetchMeetingsForDate(currentDate, true);
        } else {
          setIsAuthenticated(false);
          // Use mock data when not authenticated
          setMeetings(mockMeetings);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to mock data on error
        setMeetings(mockMeetings);
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

  // Mock data for fallback
  const mockMeetings = [
    {
      id: "1",
      title: "Product Strategy with Insight Partners",
      time: "9:00 AM - 10:00 AM",
      attendees: [
        { name: "John Doe", email: "john@example.com" },
        { name: "Sarah Chen", email: "sarah@insightpartners.com" }
      ],
      oneLiner: "Leading VC firm specializing in growth-stage software companies",
      whyNow: "Warm intro from Alex Thompson (mutual connection at Scale Venture)",
      stakes: "Series B funding opportunity ($15M-$25M range)",
      likelyGoal: "Initial partnership discussion and portfolio fit assessment",
      toneRecommendation: "Professional but engaging - this is relationship building",
      provenanceLinks: [
        { type: "email", snippet: "I'd love to introduce you to Sarah at Insight...", url: "#" },
        { type: "slack", snippet: "FYI - meeting with Insight tomorrow", url: "#" }
      ]
    },
    {
      id: "2",
      title: "Customer Success Review",
      time: "2:00 PM - 3:00 PM",
      attendees: [
        { name: "Mike Johnson", email: "mike@tribe.ai" },
        { name: "Lisa Wang", email: "lisa@tribe.ai" }
      ],
      oneLiner: "Q4 customer health review with enterprise accounts team",
      whyNow: "Quarterly business review cycle",
      stakes: "Customer retention and expansion opportunities",
      likelyGoal: "Review churn risks and identify expansion opportunities",
      toneRecommendation: "Data-focused, solution-oriented",
      provenanceLinks: [
        { type: "call", snippet: "Last call discussed Q4 retention targets...", url: "#" }
      ]
    }
  ];

  // Participant click handler
  const handleParticipantClick = (email: string) => {
    setSelectedParticipantEmail(email);
    setIsParticipantModalOpen(true);
  };

  const handleCloseParticipantModal = () => {
    setIsParticipantModalOpen(false);
    setSelectedParticipantEmail(null);
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
                <div className="flex items-center space-x-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Calendar Connected
                  </span>
                  {user && (
                    <span className="text-xs text-muted-foreground">
                      ({user.name})
                    </span>
                  )}
                </div>
              ) : (
                <a
                  href="http://localhost:3001/auth/google"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors inline-block"
                >
                  Connect Calendar
                </a>
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

                      {/* One-liner */}
                      <div className="mb-4">
                        <h4 className="font-medium text-card-foreground mb-1">Who & What</h4>
                        <p className="text-muted-foreground">{meeting.oneLiner}</p>
                      </div>

                      {/* Context Grid */}
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <h4 className="font-medium text-card-foreground mb-1">Why Now</h4>
                          <p className="text-sm text-muted-foreground">{meeting.whyNow}</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-card-foreground mb-1">Stakes</h4>
                          <p className="text-sm text-muted-foreground">{meeting.stakes}</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-card-foreground mb-1">Likely Goal</h4>
                          <p className="text-sm text-muted-foreground">{meeting.likelyGoal}</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-card-foreground mb-1">Tone</h4>
                          <p className="text-sm text-muted-foreground">{meeting.toneRecommendation}</p>
                        </div>
                      </div>

                      {/* Provenance Links */}
                      {meeting.provenanceLinks.length > 0 && (
                        <div>
                          <h4 className="font-medium text-card-foreground mb-2">Source Material</h4>
                          <div className="space-y-2">
                            {meeting.provenanceLinks.map((link, index) => (
                              <div key={index} className="flex items-start space-x-2 p-2 bg-muted rounded">
                                <div className="flex-shrink-0 mt-0.5">
                                  {link.type === 'email' && <FileText className="h-4 w-4 text-primary" />}
                                  {link.type === 'slack' && <Link2 className="h-4 w-4 text-accent-foreground" />}
                                  {link.type === 'call' && <Clock className="h-4 w-4 text-primary" />}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-muted-foreground italic">&quot;{link.snippet}&quot;</p>
                                  <a href={link.url} className="text-xs text-primary hover:underline capitalize">
                                    View {link.type} →
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
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
                        ? "Enjoy your meeting-free day! Your calendar is connected and we're monitoring for new events."
                        : "Connect your calendar to see upcoming meetings and get smart pre-briefs."
                      }
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

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