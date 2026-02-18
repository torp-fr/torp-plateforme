/**
 * PHASE 36.6: Unicode Text Sanitizer
 * Cleans text content before database insertion
 * Handles PDF binary, control characters, invalid Unicode sequences
 */

/**
 * Sanitize text content for safe PostgreSQL insertion
 * Removes:
 * - Null bytes
 * - Invalid Unicode surrogate pairs
 * - Control characters (except tab, newline, carriage return)
 * - Non-printable Unicode sequences
 */
export function sanitizeText(input: string): string {
  if (!input) return '';

  return input
    // Remove null bytes
    .replace(/\u0000/g, '')
    // Remove invalid surrogate pairs (common in PDF binary)
    .replace(/[\uD800-\uDFFF]/g, '')
    // Remove control characters except: tab (09), newline (0A), carriage return (0D)
    // Keep printable ASCII (20-7E) and Latin extended (À-ÿ)
    .replace(/[^\x09\x0A\x0D\x20-\x7EÀ-ÿ]/g, '')
    // Normalize to NFC form (canonical decomposition)
    .normalize('NFC');
}


/**
 * Get sanitization statistics
 */
export function getSanitizationStats(original: string, sanitized: string) {
  return {
    original_length: original.length,
    original_bytes: new TextEncoder().encode(original).length,
    sanitized_length: sanitized.length,
    sanitized_bytes: new TextEncoder().encode(sanitized).length,
    removed_chars: original.length - sanitized.length,
    removed_bytes:
      new TextEncoder().encode(original).length - new TextEncoder().encode(sanitized).length,
  };
}
