/**
 * Service de recherche dans la base de connaissances
 * Utilise pgvector pour la recherche sémantique
 */

import { generateEmbedding } from './embeddings.ts';

export interface KnowledgeSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  docType: string;
  category: string;
  codeReference: string;
  title: string;
  sectionTitle: string;
  pageNumber: number;
}

export interface KnowledgeSearchOptions {
  query: string;
  docType?: string;       // dtu, norme, reglementation, guide, etc.
  category?: string;      // isolation, chauffage, etc.
  threshold?: number;     // Seuil de similarité (0-1)
  limit?: number;         // Nombre max de résultats
}

/**
 * Recherche sémantique dans la base de connaissances
 */
export async function searchKnowledge(
  supabase: any,
  options: KnowledgeSearchOptions
): Promise<KnowledgeSearchResult[]> {
  const {
    query,
    docType,
    category,
    threshold = 0.7,
    limit = 10
  } = options;

  // Générer l'embedding de la requête
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    console.warn('OPENAI_API_KEY non configurée, recherche désactivée');
    return [];
  }

  try {
    const { embedding } = await generateEmbedding(query, openaiKey);

    // Appeler la fonction RPC de recherche
    const { data, error } = await supabase.rpc('search_knowledge', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      filter_doc_type: docType || null,
      filter_category: category || null
    });

    if (error) {
      console.error('Knowledge search error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      content: row.content,
      similarity: row.similarity,
      docType: row.doc_type,
      category: row.category,
      codeReference: row.code_reference,
      title: row.title,
      sectionTitle: row.section_title,
      pageNumber: row.page_number
    }));

  } catch (error) {
    console.error('Knowledge search failed:', error);
    return [];
  }
}

/**
 * Recherche contextuelle pour un devis
 * Identifie les DTU/normes pertinentes selon les travaux
 */
export async function searchKnowledgeForDevis(
  supabase: any,
  travaux: { type: string; description: string }[]
): Promise<{
  dtu: KnowledgeSearchResult[];
  normes: KnowledgeSearchResult[];
  guides: KnowledgeSearchResult[];
}> {
  const results = {
    dtu: [] as KnowledgeSearchResult[],
    normes: [] as KnowledgeSearchResult[],
    guides: [] as KnowledgeSearchResult[]
  };

  // Construire une requête à partir des travaux
  const travauxDesc = travaux.map(t => `${t.type}: ${t.description}`).join('. ');

  // Rechercher les DTU pertinents
  const dtuQuery = `Règles et normes techniques pour travaux: ${travauxDesc}`;
  results.dtu = await searchKnowledge(supabase, {
    query: dtuQuery,
    docType: 'dtu',
    limit: 5
  });

  // Rechercher les normes
  const normesQuery = `Normes et réglementations applicables: ${travauxDesc}`;
  results.normes = await searchKnowledge(supabase, {
    query: normesQuery,
    docType: 'norme',
    limit: 5
  });

  // Rechercher les guides/bonnes pratiques
  const guidesQuery = `Bonnes pratiques et recommandations: ${travauxDesc}`;
  results.guides = await searchKnowledge(supabase, {
    query: guidesQuery,
    docType: 'guide',
    limit: 5
  });

  return results;
}

/**
 * Génère un contexte enrichi à partir des documents trouvés
 */
export function generateKnowledgeContext(
  results: KnowledgeSearchResult[]
): string {
  if (results.length === 0) {
    return '';
  }

  const sections: string[] = [];

  // Grouper par type de document
  const byType = results.reduce((acc, r) => {
    const type = r.docType || 'autre';
    if (!acc[type]) acc[type] = [];
    acc[type].push(r);
    return acc;
  }, {} as Record<string, KnowledgeSearchResult[]>);

  // Formater chaque groupe
  for (const [type, docs] of Object.entries(byType)) {
    const typeLabel = {
      'dtu': 'DTU (Documents Techniques Unifiés)',
      'norme': 'Normes applicables',
      'reglementation': 'Réglementations',
      'guide': 'Guides et bonnes pratiques',
      'fiche_technique': 'Fiches techniques'
    }[type] || type;

    sections.push(`### ${typeLabel}`);

    docs.forEach((doc, i) => {
      sections.push(`
**${doc.codeReference || doc.title}** (pertinence: ${Math.round(doc.similarity * 100)}%)
${doc.sectionTitle ? `Section: ${doc.sectionTitle}` : ''}
> ${doc.content.substring(0, 500)}${doc.content.length > 500 ? '...' : ''}
`);
    });
  }

  return `
## RÉFÉRENCES TECHNIQUES (Base de connaissances)

${sections.join('\n')}
`;
}

/**
 * Mapping catégories travaux -> mots-clés DTU
 */
export const DTU_MAPPING: Record<string, string[]> = {
  'isolation': [
    'DTU 45.1', 'DTU 45.2', 'DTU 45.10', 'DTU 45.11',
    'isolation thermique', 'résistance thermique', 'pare-vapeur'
  ],
  'chauffage': [
    'DTU 65.10', 'DTU 65.11', 'DTU 65.12', 'DTU 65.14',
    'installation chauffage', 'pompe à chaleur', 'plancher chauffant'
  ],
  'plomberie': [
    'DTU 60.1', 'DTU 60.11', 'DTU 60.31', 'DTU 60.32',
    'plomberie sanitaire', 'évacuation', 'alimentation eau'
  ],
  'electricite': [
    'NF C 15-100', 'DTU 70.1',
    'installation électrique', 'tableau électrique'
  ],
  'menuiserie': [
    'DTU 36.5', 'DTU 37.1', 'DTU 39',
    'fenêtre', 'porte', 'vitrage'
  ],
  'ventilation': [
    'DTU 68.3',
    'VMC', 'ventilation mécanique', 'aération'
  ],
  'toiture': [
    'DTU 40.11', 'DTU 40.21', 'DTU 40.41', 'DTU 43.1',
    'couverture', 'étanchéité toiture', 'tuile', 'ardoise'
  ],
  'maconnerie': [
    'DTU 20.1', 'DTU 21', 'DTU 23.1',
    'maçonnerie', 'béton', 'fondation'
  ],
  'platerie': [
    'DTU 25.1', 'DTU 25.31', 'DTU 25.41',
    'plaque de plâtre', 'cloison', 'doublage'
  ],
  'carrelage': [
    'DTU 52.1', 'DTU 52.2',
    'carrelage', 'faïence', 'revêtement sol'
  ],
  'peinture': [
    'DTU 59.1', 'DTU 59.4',
    'peinture', 'revêtement mural'
  ]
};

/**
 * Identifie les DTU potentiellement applicables selon les travaux
 */
export function identifyApplicableDTU(categories: string[]): string[] {
  const dtus = new Set<string>();

  categories.forEach(cat => {
    const mapping = DTU_MAPPING[cat.toLowerCase()];
    if (mapping) {
      mapping.forEach(dtu => {
        if (dtu.startsWith('DTU') || dtu.startsWith('NF')) {
          dtus.add(dtu);
        }
      });
    }
  });

  return Array.from(dtus);
}
