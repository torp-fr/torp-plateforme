// ─────────────────────────────────────────────────────────────────────────────
// validation.utils.ts — Reusable Zod validation middleware — Phase 3B Jalon 2
//
// Usage:
//   router.post('/route', validateBody(MySchema), handler)
//   router.get('/:id',    validateParams(z.object({ id: uuidSchema })), handler)
//   router.get('/list',   validateQuery(paginationSchema), handler)
// ─────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';

// ─── Error response shape ─────────────────────────────────────────────────────

interface ValidationErrorDetail {
  path:    string;
  message: string;
  code:    string;
}

function formatZodError(err: ZodError): ValidationErrorDetail[] {
  return err.issues.map(issue => ({
    path:    issue.path.join('.') || '(root)',
    message: issue.message,
    code:    issue.code,
  }));
}

function sendValidationError(res: Response, details: ValidationErrorDetail[]): void {
  res.status(400).json({
    error:   'Validation Error',
    code:    'VALIDATION_ERROR',
    details,
  });
}

// ─── Middleware factories ─────────────────────────────────────────────────────

/**
 * Validate and transform `req.body` against a Zod schema.
 * On success the parsed (and coerced/defaulted) value replaces `req.body`.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await schema.safeParseAsync(req.body);
    if (!result.success) {
      sendValidationError(res, formatZodError(result.error));
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validate and transform `req.params` against a Zod schema.
 * On success the parsed value replaces `req.params`.
 */
export function validateParams<T extends Record<string, unknown>>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await schema.safeParseAsync(req.params);
    if (!result.success) {
      sendValidationError(res, formatZodError(result.error));
      return;
    }
    // Cast: Express params is Record<string, string> but Zod may transform values
    req.params = result.data as unknown as Record<string, string>;
    next();
  };
}

/**
 * Validate and transform `req.query` against a Zod schema.
 * On success the parsed (and coerced/defaulted) value replaces `req.query`.
 * Always use `z.coerce` for numeric/boolean query params since they arrive as strings.
 */
export function validateQuery<T extends Record<string, unknown>>(schema: ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await schema.safeParseAsync(req.query);
    if (!result.success) {
      sendValidationError(res, formatZodError(result.error));
      return;
    }
    req.query = result.data as unknown as Record<string, string>;
    next();
  };
}
