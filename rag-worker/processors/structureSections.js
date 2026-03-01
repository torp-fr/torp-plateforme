export function structureSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let currentSection = null;
  let currentLevel = 0;

  const headingPattern = /^(#{1,6}|\*\*|__|===|---|\d+\.|[A-Z][A-Z\s]{2,})\s+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) continue;

    const headingMatch = trimmed.match(headingPattern);

    if (headingMatch) {
      const level = determineHeadingLevel(headingMatch[1]);
      const title = headingMatch[2].trim();

      currentSection = {
        title,
        level,
        content: [],
        start_index: sections.length,
      };

      sections.push(currentSection);
      currentLevel = level;
    } else if (currentSection) {
      currentSection.content.push(trimmed);
    } else {
      // Content before any heading
      if (!sections[0]) {
        sections[0] = {
          title: "Introduction",
          level: 0,
          content: [],
        };
      }
      sections[0].content.push(trimmed);
    }
  }

  return sections.map((section) => ({
    ...section,
    full_content: section.content.join("\n"),
  }));
}

function determineHeadingLevel(marker) {
  if (marker.startsWith("#")) return marker.length - 1;
  if (marker === "===") return 1;
  if (marker === "---") return 2;
  if (marker === "**" || marker === "__") return 3;
  if (marker.match(/^\d+\./)) return 4;
  return 0;
}
