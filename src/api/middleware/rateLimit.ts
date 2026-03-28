// ─────────────────────────────────────────────────────────────────────────────
// rateLimit.ts — Per-user / per-IP rate limiting — Phase 3B Jalon 1
//
// Uses sliding-window counters stored in-memory (Maps).
// Limits are fetched from the `rate_limits` DB table for authenticated users,
// or use conservative defaults for anonymous requests.
//
// Cleanup runs every 10 minutes to evict expired entries.
// ─────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from './auth.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_LIMITS = {
  authenticated: { minute: 100, hour: 1000, day: 10000 },
  anonymous:     { minute: 10,  hour: 100,  day: 500 },
};

const WINDOW_MS = {
  minute: 60 * 1000,
  hour:   60 * 60 * 1000,
  day:    24 * 60 * 60 * 1000,
};

// ─── In-memory store ──────────────────────────────────────────────────────────

interface WindowEntry {
  timestamps: number[]; // unix ms of each request
}

interface UserWindow {
  minute: WindowEntry;
  hour:   WindowEntry;
  day:    WindowEntry;
  limitsOverride?: { minute: number; hour: number; day: number };
  limitsLastFetched?: number; // timestamp to refresh limits periodically
}

// key: userId (authenticated) or `ip:${req.ip}` (anonymous)
const store = new Map<string, UserWindow>();

// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.minute.timestamps = entry.minute.timestamps.filter(t => now - t < WINDOW_MS.minute);
    entry.hour.timestamps   = entry.hour.timestamps.filter(t => now - t < WINDOW_MS.hour);
    entry.day.timestamps    = entry.day.timestamps.filter(t => now - t < WINDOW_MS.day);

    // Evict entirely idle entries (no requests in the last day)
    if (entry.day.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 10 * 60 * 1000);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreate(key: string): UserWindow {
  if (!store.has(key)) {
    store.set(key, {
      minute: { timestamps: [] },
      hour:   { timestamps: [] },
      day:    { timestamps: [] },
    });
  }
  return store.get(key)!;
}

function countWithin(entry: WindowEntry, windowMs: number, now: number): number {
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
  return entry.timestamps.length;
}

function secondsUntilReset(entry: WindowEntry, windowMs: number, now: number): number {
  if (entry.timestamps.length === 0) return 0;
  const oldest = Math.min(...entry.timestamps);
  return Math.max(0, Math.ceil((oldest + windowMs - now) / 1000));
}

// Fetch per-user limits from DB (with 5-minute in-memory cache)
async function fetchUserLimits(
  userId: string
): Promise<{ minute: number; hour: number; day: number } | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data } = await supabase
      .from('rate_limits')
      .select('requests_per_minute, requests_per_hour, requests_per_day')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data || typeof data.requests_per_minute !== 'number') return null;

    return {
      minute: data.requests_per_minute,
      hour:   data.requests_per_hour,
      day:    data.requests_per_day,
    };
  } catch {
    return null;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function rateLimitMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id;
  const key    = userId ?? `ip:${req.ip ?? 'unknown'}`;
  const now    = Date.now();
  const window = getOrCreate(key);

  // Determine applicable limits
  let limits: { minute: number; hour: number; day: number };

  if (userId) {
    // Refresh DB limits every 5 minutes
    const stale = !window.limitsLastFetched || now - window.limitsLastFetched > 5 * 60 * 1000;
    if (stale) {
      const dbLimits = await fetchUserLimits(userId);
      if (dbLimits) {
        window.limitsOverride    = dbLimits;
        window.limitsLastFetched = now;
      } else if (!window.limitsLastFetched) {
        window.limitsLastFetched = now; // mark as fetched even if DB miss
      }
    }
    limits = window.limitsOverride ?? DEFAULT_LIMITS.authenticated;
  } else {
    limits = DEFAULT_LIMITS.anonymous;
  }

  // Count current usage in each window
  const minuteCount = countWithin(window.minute, WINDOW_MS.minute, now);
  const hourCount   = countWithin(window.hour,   WINDOW_MS.hour,   now);
  const dayCount    = countWithin(window.day,     WINDOW_MS.day,    now);

  // Set response headers (always)
  res.setHeader('X-RateLimit-Limit-Minute',     limits.minute);
  res.setHeader('X-RateLimit-Remaining-Minute',  Math.max(0, limits.minute - minuteCount - 1));
  res.setHeader('X-RateLimit-Limit-Hour',        limits.hour);
  res.setHeader('X-RateLimit-Remaining-Hour',    Math.max(0, limits.hour - hourCount - 1));
  res.setHeader('X-RateLimit-Limit-Day',         limits.day);
  res.setHeader('X-RateLimit-Remaining-Day',     Math.max(0, limits.day - dayCount - 1));
  res.setHeader('X-RateLimit-Reset',             Math.floor((now + WINDOW_MS.minute) / 1000));

  // Check limits (minute → hour → day, first exceeded wins)
  if (minuteCount >= limits.minute) {
    const retryAfter = secondsUntilReset(window.minute, WINDOW_MS.minute, now);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
      limits: {
        minute: { limit: limits.minute, remaining: 0 },
        hour:   { limit: limits.hour,   remaining: Math.max(0, limits.hour - hourCount) },
        day:    { limit: limits.day,    remaining: Math.max(0, limits.day  - dayCount)  },
      },
    });
    return;
  }

  if (hourCount >= limits.hour) {
    const retryAfter = secondsUntilReset(window.hour, WINDOW_MS.hour, now);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
      limits: {
        minute: { limit: limits.minute, remaining: Math.max(0, limits.minute - minuteCount) },
        hour:   { limit: limits.hour,   remaining: 0 },
        day:    { limit: limits.day,    remaining: Math.max(0, limits.day - dayCount) },
      },
    });
    return;
  }

  if (dayCount >= limits.day) {
    const retryAfter = secondsUntilReset(window.day, WINDOW_MS.day, now);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
      limits: {
        minute: { limit: limits.minute, remaining: Math.max(0, limits.minute - minuteCount) },
        hour:   { limit: limits.hour,   remaining: Math.max(0, limits.hour - hourCount) },
        day:    { limit: limits.day,    remaining: 0 },
      },
    });
    return;
  }

  // Record this request
  window.minute.timestamps.push(now);
  window.hour.timestamps.push(now);
  window.day.timestamps.push(now);

  next();
}
