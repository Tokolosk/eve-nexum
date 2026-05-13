import type { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';

// Re-verifies admin role against the DB on every call so a freshly-demoted
// admin can't keep using their old session. The session field is kept in
// sync as a side effect.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { rows } = await db.query<{ role: string }>(
    `SELECT role FROM users WHERE id = $1`,
    [req.session.userId],
  );
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'member' && role !== 'readonly') {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  req.session.role = role;
  if (role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
