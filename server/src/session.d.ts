import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    characterId: number;
    characterName: string;
    role: 'admin' | 'member' | 'readonly';
    oauthState: string;
  }
}
