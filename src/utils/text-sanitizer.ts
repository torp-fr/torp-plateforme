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
 * Sanitize and truncate text for safe storage
 * Maximum content size: 500KB
 */
export function sanitizeAndTruncate(input: string, maxBytes: number = 500000): string {
  if (!input) return '';

  const sanitized = sanitizeText(input);

  // Check byte size (not character count, as UTF-8 chars can be multi-byte)
  const encoded = new TextEncoder().encode(sanitized);
  if (encoded.length > maxBytes) {
    console.warn(
      `[TEXT-SANITIZER] Content too large (${encoded.length} bytes), truncating to ${maxBytes} bytes`
    );
    // Decode back carefully to avoid cutting multi-byte chars
    const truncated = new TextDecoder('utf-8', { fatal: false }).decode(
      encoded.slice(0, maxBytes)
    );
    return truncated;
  }

  return sanitized;
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
