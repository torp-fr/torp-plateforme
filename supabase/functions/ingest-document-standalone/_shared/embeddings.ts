/**
 * Service d'embeddings pour la base de connaissances
 */

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions, moins cher

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

/**
 * Génère un embedding pour un texte
 */
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<EmbeddingResult> {
  const response = await fetch(OPENAI_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      model: OPENAI_EMBEDDING_MODEL
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Embedding error: ${error}`);
  }

  const data = await response.json();
  return {
    embedding: data.data[0].embedding,
    tokens: data.usage.total_tokens
  };
}

/**
 * Génère des embeddings en batch (plus efficace)
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  apiKey: string
): Promise<EmbeddingResult[]> {
  // OpenAI limite à 2048 inputs par requête
  const BATCH_SIZE = 100;
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(OPENAI_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: batch,
        model: OPENAI_EMBEDDING_MODEL
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embedding error: ${error}`);
    }

    const data = await response.json();
    const batchResults = data.data.map((item: any, idx: number) => ({
      embedding: item.embedding,
      tokens: Math.floor(data.usage.total_tokens / batch.length)
    }));

    results.push(...batchResults);

    // Petit délai pour éviter le rate limiting
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

/**
 * Découpe un texte en chunks
 */
export interface ChunkOptions {
  maxLength?: number;      // Taille max d'un chunk (caractères)
  overlap?: number;        // Chevauchement entre chunks
  preserveParagraphs?: boolean;
}

export interface TextChunk {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
  pageNumber?: number;
  sectionTitle?: string;
}

export function chunkText(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const {
    maxLength = 1500,
    overlap = 200,
    preserveParagraphs = true
  } = options;

  const chunks: TextChunk[] = [];

  if (preserveParagraphs) {
    // Découpage intelligent par paragraphes
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;
    let charPos = 0;

    for (const para of paragraphs) {
      const paraWithBreak = para + '\n\n';

      if (currentChunk.length + paraWithBreak.length > maxLength && currentChunk.length > 0) {
        // Sauvegarder le chunk actuel
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex++,
          startChar: currentStart,
          endChar: charPos
        });

        // Commencer nouveau chunk avec overlap
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + paraWithBreak;
        currentStart = charPos - overlap;
      } else {
        currentChunk += paraWithBreak;
      }

      charPos += paraWithBreak.length;
    }

    // Dernier chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
        startChar: currentStart,
        endChar: charPos
      });
    }
  } else {
    // Découpage simple par taille fixe
    let start = 0;
    let index = 0;

    while (start < text.length) {
      const end = Math.min(start + maxLength, text.length);
      chunks.push({
        content: text.slice(start, end),
        index: index++,
        startChar: start,
        endChar: end
      });
      start = end - overlap;
    }
  }

  return chunks;
}

/**
 * Extrait les sections d'un document technique
 */
export function extractSections(text: string): { title: string; content: string; level: number }[] {
  const sections: { title: string; content: string; level: number }[] = [];

  // Patterns pour détecter les titres de sections
  const sectionPatterns = [
    /^(#{1,3})\s+(.+)$/gm,                    // Markdown
    /^(\d+\.)+\s+(.+)$/gm,                    // Numérotation (1.2.3)
    /^(CHAPITRE|ARTICLE|SECTION|PARTIE)\s+/gmi,  // Mots-clés
    /^([A-Z][A-Z\s]+)$/gm                     // Titres en majuscules
  ];

  // Pour simplifier, on découpe par lignes qui ressemblent à des titres
  const lines = text.split('\n');
  let currentSection = { title: 'Introduction', content: '', level: 0 };

  for (const line of lines) {
    const trimmed = line.trim();

    // Détection de titre
    const isTitle = (
      /^\d+\./.test(trimmed) ||                    // Commence par numéro
      /^[A-Z][A-Z\s]{5,}$/.test(trimmed) ||        // Majuscules
      /^(CHAPITRE|ARTICLE|SECTION)/i.test(trimmed)
    );

    if (isTitle && trimmed.length < 200) {
      // Sauvegarder section précédente
      if (currentSection.content.trim()) {
        sections.push({ ...currentSection });
      }

      // Nouvelle section
      const level = (trimmed.match(/\./g) || []).length + 1;
      currentSection = { title: trimmed, content: '', level };
    } else {
      currentSection.content += line + '\n';
    }
  }

  // Dernière section
  if (currentSection.content.trim()) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Nettoie le texte extrait d'un PDF
 */
export function cleanExtractedText(text: string): string {
  return text
    // Supprimer les caractères de contrôle
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    // Normaliser les espaces
    .replace(/[ \t]+/g, ' ')
    // Normaliser les sauts de ligne
    .replace(/\n{3,}/g, '\n\n')
    // Supprimer les en-têtes/pieds de page répétitifs (heuristique)
    .replace(/^.{0,50}Page \d+.{0,50}$/gm, '')
    // Trim
    .trim();
}
