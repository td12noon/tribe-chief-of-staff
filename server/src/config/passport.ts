import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { userService } from '../services/userService';

// Debug environment variables
console.log('🔐 OAuth Environment Variables:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');

// Configure Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.readonly'
  ]
}, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
  try {
    const userData = {
      google_id: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      avatar_url: profile.photos[0]?.value,
      access_token: accessToken,
      refresh_token: refreshToken
    };

    // Create or update user with OAuth tokens
    const user = await userService.createOrUpdateUser(userData);
    const storageStatus = userService.getStorageStatus();

    console.log('✅ OAuth success:', user.name, user.email);
    console.log('🔑 User stored via', storageStatus.type, 'storage');
    if (storageStatus.type === 'memory') {
      console.log('💾 Memory store has', storageStatus.userCount, 'users');
    }

    return done(null, user);
  } catch (error) {
    console.error('OAuth error:', error);
    return done(error, null);
  }
}));

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await userService.findById(id);
    if (user) {
      done(null, user);
    } else {
      console.warn('⚠️  User not found in deserialize:', id);
      done(new Error('User not found'), null);
    }
  } catch (error) {
    console.error('❌ Error deserializing user:', error);
    done(error, null);
  }
});

export default passport;