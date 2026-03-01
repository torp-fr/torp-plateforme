export function cleanText(text) {
  if (!text) return "";

  // Remove excessive whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Remove common OCR artifacts
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Normalize quotes
  text = text.replace(/[""]/g, '"').replace(/['']/g, "'");

  // Remove control characters
  text = text.replace(/\u200b/g, "");

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
