'use client'

import { Calendar, Clock, Users, Link2, FileText, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface User {
  name: string;
  email: string;
  avatarUrl?: string;
}

interface Meeting {
  id: string;
  title: string;
  time: string;
  attendees: string[];
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

          // Fetch today's calendar events
          const calendarResponse = await fetch('http://localhost:3001/api/calendar/today', {
            credentials: 'include'
          });
          const calendarData = await calendarResponse.json();

          if (calendarData.success) {
            setMeetings(calendarData.events);
          }
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

  // Mock data for fallback
  const mockMeetings = [
    {
      id: "1",
      title: "Product Strategy with Insight Partners",
      time: "9:00 AM - 10:00 AM",
      attendees: ["John Doe", "Sarah Chen"],
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
      attendees: ["Mike Johnson", "Lisa Wang"],
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Morning Brief</h1>
              <p className="text-sm text-gray-500 mt-1">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="flex items-center space-x-2 bg-green-50 text-green-800 px-4 py-2 rounded-lg">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Calendar Connected
                  </span>
                  {user && (
                    <span className="text-xs text-green-600">
                      ({user.name})
                    </span>
                  )}
                </div>
              ) : (
                <a
                  href="http://localhost:3001/auth/google"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-block"
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
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Today&apos;s Meetings</h2>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                {meetings.length} meetings
              </span>
              {isAuthenticated && (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                  Live from Google Calendar
                </span>
              )}
            </div>

            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  {/* Meeting Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {meeting.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>{meeting.time}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{meeting.attendees.length > 0 ? meeting.attendees.join(", ") : "No attendees"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* One-liner */}
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-1">Who & What</h4>
                    <p className="text-gray-700">{meeting.oneLiner}</p>
                  </div>

                  {/* Context Grid */}
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Why Now</h4>
                      <p className="text-sm text-gray-600">{meeting.whyNow}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Stakes</h4>
                      <p className="text-sm text-gray-600">{meeting.stakes}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Likely Goal</h4>
                      <p className="text-sm text-gray-600">{meeting.likelyGoal}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Tone</h4>
                      <p className="text-sm text-gray-600">{meeting.toneRecommendation}</p>
                    </div>
                  </div>

                  {/* Provenance Links */}
                  {meeting.provenanceLinks.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Source Material</h4>
                      <div className="space-y-2">
                        {meeting.provenanceLinks.map((link, index) => (
                          <div key={index} className="flex items-start space-x-2 p-2 bg-gray-50 rounded">
                            <div className="flex-shrink-0 mt-0.5">
                              {link.type === 'email' && <FileText className="h-4 w-4 text-blue-500" />}
                              {link.type === 'slack' && <Link2 className="h-4 w-4 text-green-500" />}
                              {link.type === 'call' && <Clock className="h-4 w-4 text-purple-500" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-600 italic">&quot;{link.snippet}&quot;</p>
                              <a href={link.url} className="text-xs text-blue-600 hover:underline capitalize">
                                View {link.type} →
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Empty State (when no meetings) */}
          {meetings.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No meetings today</h3>
              <p className="mt-1 text-sm text-gray-500">
                {isAuthenticated
                  ? "Enjoy your meeting-free day! Your calendar is connected and we're monitoring for new events."
                  : "Connect your calendar to see upcoming meetings and get smart pre-briefs."
                }
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}