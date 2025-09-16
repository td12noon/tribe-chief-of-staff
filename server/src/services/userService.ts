import { db } from '../config/database';

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
  google_calendar_connected: boolean;
  google_gmail_connected: boolean;
  slack_connected: boolean;
  last_login: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  google_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  access_token?: string;
  refresh_token?: string;
}

export interface UpdateUserTokens {
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;
}

class UserService {
  private useDatabaseFallback = true;
  private memoryStore: Map<string, User> = new Map();

  async findByGoogleId(google_id: string): Promise<User | null> {
    if (this.useDatabaseFallback) {
      try {
        const result = await db.query(
          'SELECT * FROM users WHERE google_id = $1',
          [google_id]
        );
        return result.rows[0] || null;
      } catch (error) {
        console.warn('Database unavailable, using memory store:', error);
        this.useDatabaseFallback = false;
      }
    }

    // Fallback to memory store
    for (const [_, user] of this.memoryStore) {
      if (user.google_id === google_id) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    if (this.useDatabaseFallback) {
      try {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
      } catch (error) {
        console.warn('Database unavailable, using memory store:', error);
        this.useDatabaseFallback = false;
      }
    }

    // Fallback to memory store
    return this.memoryStore.get(id) || null;
  }

  async createOrUpdateUser(userData: CreateUserData): Promise<User> {
    if (this.useDatabaseFallback) {
      try {
        const query = `
          INSERT INTO users (google_id, email, name, avatar_url, access_token, refresh_token, google_calendar_connected, last_login)
          VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
          ON CONFLICT (google_id)
          DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            avatar_url = EXCLUDED.avatar_url,
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            google_calendar_connected = true,
            last_login = NOW(),
            updated_at = NOW()
          RETURNING *;
        `;

        const result = await db.query(query, [
          userData.google_id,
          userData.email,
          userData.name,
          userData.avatar_url,
          userData.access_token,
          userData.refresh_token
        ]);

        console.log('✅ User saved to database:', userData.email);
        return result.rows[0];
      } catch (error) {
        console.warn('Database unavailable, using memory store:', error);
        this.useDatabaseFallback = false;
      }
    }

    // Fallback to memory store
    const userId = `user_${userData.google_id}`;
    const user: User = {
      id: userId,
      google_id: userData.google_id,
      email: userData.email,
      name: userData.name,
      avatar_url: userData.avatar_url,
      access_token: userData.access_token,
      refresh_token: userData.refresh_token,
      token_expires_at: undefined,
      google_calendar_connected: true,
      google_gmail_connected: false,
      slack_connected: false,
      last_login: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    this.memoryStore.set(userId, user);
    console.log('⚠️  User saved to memory store:', userData.email);
    return user;
  }

  async updateTokens(userId: string, tokens: UpdateUserTokens): Promise<User | null> {
    if (this.useDatabaseFallback) {
      try {
        const query = `
          UPDATE users
          SET access_token = COALESCE($2, access_token),
              refresh_token = COALESCE($3, refresh_token),
              token_expires_at = COALESCE($4, token_expires_at),
              updated_at = NOW()
          WHERE id = $1
          RETURNING *;
        `;

        const result = await db.query(query, [
          userId,
          tokens.access_token,
          tokens.refresh_token,
          tokens.token_expires_at
        ]);

        return result.rows[0] || null;
      } catch (error) {
        console.warn('Database unavailable for token update:', error);
        this.useDatabaseFallback = false;
      }
    }

    // Fallback to memory store
    const user = this.memoryStore.get(userId);
    if (user) {
      if (tokens.access_token) user.access_token = tokens.access_token;
      if (tokens.refresh_token) user.refresh_token = tokens.refresh_token;
      if (tokens.token_expires_at) user.token_expires_at = tokens.token_expires_at;
      user.updated_at = new Date();

      this.memoryStore.set(userId, user);
      return user;
    }
    return null;
  }

  // Check if database is available
  async isDatabaseAvailable(): Promise<boolean> {
    if (!this.useDatabaseFallback) return false;

    try {
      await db.query('SELECT 1');
      return true;
    } catch (error) {
      this.useDatabaseFallback = false;
      return false;
    }
  }

  // Get storage status for debugging
  getStorageStatus(): { type: 'database' | 'memory', userCount: number } {
    if (this.useDatabaseFallback) {
      return { type: 'database', userCount: -1 }; // Unknown count from DB
    }
    return { type: 'memory', userCount: this.memoryStore.size };
  }
}

export const userService = new UserService();