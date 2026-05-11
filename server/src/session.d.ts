import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    characterId: number;
    characterName: string;
    oauthState: string;
  }
}
