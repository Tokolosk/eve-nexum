import type { Request } from 'express';

// The minimal identity the map access checks need, resolved from EITHER a
// browser session (cookie) OR an API key (Bearer). Existing routes read these
// off req.session directly; getMapAccess + the role gates now go through
// authUser() so an API-key request — which has no session — resolves to the
// same fields and every existing check works unchanged.
export type Role = 'admin' | 'full' | 'edit' | 'readonly';

export interface AuthUser {
  userId:        number;          // users.id of the acting (bound) character
  characterId:   number;          // that character's EVE character_id
  characterName: string | null;   // for actor attribution (e.g. K162 Discord notice)
  ownerId:       number | null;   // account/owner the maps are scoped to
  role:          Role;
  corpId:        number | null;
  /** Present only for API-key requests; the key's scope. */
  apiScope?:     ApiScope;
}

// Linear capability hierarchy: read ⊂ events ⊂ write. A higher scope implies
// every lower one (a 'write' key can also read and stream).
export type ApiScope = 'read' | 'events' | 'write';

declare module 'express-serve-static-core' {
  interface Request {
    // Set by apiKeyAuth when a valid Bearer key is presented. Absent for
    // cookie-authenticated requests (those fall back to req.session below).
    apiAuth?: AuthUser;
  }
}

// Resolve the acting identity for a request. Prefers an API-key context when
// present, otherwise the browser session. Callers that previously read
// req.session.userId etc. should use this so both auth paths are honoured.
export function authUser(req: Request): AuthUser {
  if (req.apiAuth) return req.apiAuth;
  return {
    userId:        req.session.userId!,
    characterId:   req.session.characterId!,
    characterName: req.session.characterName ?? null,
    ownerId:       req.session.ownerId ?? null,
    role:          req.session.role ?? 'readonly',
    corpId:        req.session.userCorpId ?? null,
  };
}
