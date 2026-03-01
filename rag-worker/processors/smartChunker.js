export function smartChunkText(text, sections, chunkSize = 1000) {
  const chunks = [];
  let globalIndex = 0;

  if (!sections || sections.length === 0) {
    // Fallback: simple character-based chunking
    return simpleChunking(text, chunkSize);
  }

  for (const section of sections) {
    const sectionText = section.full_content || "";

    if (sectionText.length === 0) continue;

    // If section fits in one chunk
    if (sectionText.length <= chunkSize) {
      chunks.push({
        content: sectionText,
        section_title: section.title,
        section_level: section.level,
        chunk_index: chunks.length,
        global_index: globalIndex,
        metadata: {
          section: section.title,
          level: section.level,
          is_complete_section: true,
        },
      });
      globalIndex++;
      continue;
    }

    // Split large sections into sub-chunks
    const sentences = sectionText.match(/[^.!?]+[.!?]+/g) || [sectionText];
    let currentChunk = "";

    for (const sentence of sentences) {
      const candidateChunk = currentChunk + sentence.trim();

      if (candidateChunk.length <= chunkSize) {
        currentChunk = candidateChunk + " ";
      } else {
        if (currentChunk.trim().length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            section_title: section.title,
            section_level: section.level,
            chunk_index: chunks.length,
            global_index: globalIndex,
            metadata: {
              section: section.title,
              level: section.level,
              is_complete_section: false,
            },
          });
          globalIndex++;
        }
        currentChunk = sentence.trim() + " ";
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        section_title: section.title,
        section_level: section.level,
        chunk_index: chunks.length,
        global_index: globalIndex,
        metadata: {
          section: section.title,
          level: section.level,
          is_complete_section: false,
        },
      });
      globalIndex++;
    }
  }

  return chunks;
}

function simpleChunking(text, chunkSize) {
  const chunks = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push({
      content: text.substring(i, i + chunkSize),
      section_title: "Unstructured",
      section_level: 0,
      chunk_index: chunks.length,
      global_index: chunks.length,
      metadata: {
        section: "Unstructured",
        is_complete_section: false,
      },
    });
  }

  return chunks;
}
