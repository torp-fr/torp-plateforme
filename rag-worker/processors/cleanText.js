export function cleanText(text) {
  if (!text) return "";

  // [DIAGNOSTIC] paragraph boundary count before normalization
  const before = (text.match(/\n\n/g) || []).length;

  // Normalize horizontal whitespace only — preserve all line breaks (\n).
  // /[^\S\n]+/g matches any whitespace character that is NOT a newline:
  // spaces, tabs, form-feeds, etc. Newlines (\n) are explicitly excluded
  // so that paragraph boundaries (\n\n) survive into the chunker.
  text = text.replace(/[^\S\n]+/g, " ");

  // Collapse 3+ consecutive blank lines to a double newline.
  // Keeps intentional paragraph breaks without allowing runaway whitespace.
  text = text.replace(/\n{3,}/g, "\n\n");

  // Remove C0 control characters and DEL (0x7F).
  // Excludes \n (0x0A) — already handled above and must be kept.
  // \x0B (vertical tab) and \x0C (form feed) are included because they
  // are common PDF extraction artifacts with no semantic value.
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Normalize typographic quotes to ASCII equivalents
  text = text.replace(/[""]/g, '"').replace(/['']/g, "'");

  // Remove zero-width spaces (U+200B) — invisible OCR artifacts
  text = text.replace(/\u200b/g, "");

  text = text.trim();

  // [DIAGNOSTIC] paragraph boundary count after normalization
  const after = (text.match(/\n\n/g) || []).length;
  console.log(`  [cleanText] \\n\\n preserved: ${before} → ${after}`);

  return text;
}

export function removeHeaders(text) {
  const lines = text.split("\n");
  let cleanedLines = [];
  let consecutiveEmptyLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      consecutiveEmptyLines++;
      if (consecutiveEmptyLines <= 2) {
        cleanedLines.push("");
      }
    } else {
      consecutiveEmptyLines = 0;
      cleanedLines.push(line);
    }
  }

  return cleanedLines.join("\n");
}

export function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
