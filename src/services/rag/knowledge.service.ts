/**
 * TORP Knowledge Service
 * Service de recherche dans la base de connaissances DTU/Normes
 * Utilise pgvector pour la recherche sémantique côté client
 */

import { supabase } from '@/lib/supabase';
import { hybridAIService } from '@/services/ai/hybrid-ai.service';

// =============================================================================
// TYPES
// =============================================================================

export interface KnowledgeSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  docType: 'dtu' | 'norme' | 'reglementation' | 'guide' | 'fiche_technique' | 'autre';
  category: string;
  codeReference: string;
  title: string;
  sectionTitle: string;
  pageNumber: number;
}

export interface KnowledgeSearchOptions {
  query: string;
  docType?: string;
  category?: string;
  threshold?: number;
  limit?: number;
}

export interface DTUReference {
  code: string;
  title: string;
  category: string;
  applicableTo: string[];
  summary?: string;
  keyRequirements?: string[];
}

export interface CCTPEnrichmentContext {
  dtu: KnowledgeSearchResult[];
  normes: KnowledgeSearchResult[];
  guides: KnowledgeSearchResult[];
  applicableDTU: DTUReference[];
  prescriptions: CCTPPrescription[];
}

export interface CCTPPrescription {
  lotCategory: string;
  dtuReferences: string[];
  requirements: string[];
  materials: string[];
  execution: string[];
  controls: string[];
}

// =============================================================================
// MAPPING DTU PAR CATÉGORIE
// =============================================================================

export const DTU_CATALOG: Record<string, DTUReference[]> = {
  demolition: [
    { code: 'DTU 20.1', title: 'Ouvrages en maçonnerie de petits éléments', category: 'demolition', applicableTo: ['murs', 'cloisons'] },
  ],
  gros_oeuvre: [
    { code: 'DTU 20.1', title: 'Ouvrages en maçonnerie de petits éléments', category: 'maconnerie', applicableTo: ['murs', 'fondations'] },
    { code: 'DTU 21', title: 'Exécution des travaux en béton', category: 'beton', applicableTo: ['dalles', 'fondations', 'poteaux'] },
    { code: 'DTU 23.1', title: 'Murs en béton banché', category: 'beton', applicableTo: ['murs'] },
    { code: 'DTU 13.11', title: 'Fondations superficielles', category: 'fondations', applicableTo: ['semelles', 'radiers'] },
    { code: 'DTU 13.12', title: 'Règles de calcul des fondations', category: 'fondations', applicableTo: ['dimensionnement'] },
  ],
  charpente: [
    { code: 'DTU 31.1', title: 'Charpente en bois - Assemblages', category: 'charpente', applicableTo: ['fermes', 'pannes'] },
    { code: 'DTU 31.2', title: 'Construction de maisons à ossature bois', category: 'ossature_bois', applicableTo: ['murs', 'planchers'] },
    { code: 'DTU 31.3', title: 'Charpentes en bois assemblées par goussets', category: 'charpente', applicableTo: ['fermes industrielles'] },
  ],
  couverture: [
    { code: 'DTU 40.11', title: 'Couverture en ardoises', category: 'ardoise', applicableTo: ['toiture'] },
    { code: 'DTU 40.21', title: 'Couverture en tuiles de terre cuite', category: 'tuile', applicableTo: ['toiture'] },
    { code: 'DTU 40.41', title: 'Couverture en plaques ondulées', category: 'fibrociment', applicableTo: ['toiture'] },
    { code: 'DTU 40.44', title: 'Couverture par éléments métalliques', category: 'metal', applicableTo: ['toiture', 'bardage'] },
  ],
  etancheite: [
    { code: 'DTU 43.1', title: 'Étanchéité des toitures-terrasses', category: 'toiture_terrasse', applicableTo: ['terrasse', 'toit plat'] },
    { code: 'DTU 43.3', title: 'Mise en œuvre des toitures en tôles d\'acier', category: 'etancheite', applicableTo: ['bac acier'] },
    { code: 'DTU 43.4', title: 'Toitures en éléments porteurs en bois', category: 'etancheite', applicableTo: ['toiture bois'] },
  ],
  facade: [
    { code: 'DTU 20.1', title: 'Ouvrages en maçonnerie', category: 'facade', applicableTo: ['enduit', 'ravalement'] },
    { code: 'DTU 26.1', title: 'Travaux d\'enduits de mortiers', category: 'enduit', applicableTo: ['facade', 'murs'] },
    { code: 'DTU 41.2', title: 'Revêtements extérieurs en bois', category: 'bardage', applicableTo: ['bardage bois'] },
    { code: 'DTU 55.2', title: 'Revêtements muraux attachés en pierre', category: 'pierre', applicableTo: ['parement'] },
  ],
  menuiserie: [
    { code: 'DTU 36.5', title: 'Mise en œuvre des fenêtres et portes extérieures', category: 'menuiserie_ext', applicableTo: ['fenêtres', 'portes'] },
    { code: 'DTU 37.1', title: 'Menuiseries métalliques', category: 'menuiserie_alu', applicableTo: ['fenêtres alu', 'verandas'] },
    { code: 'DTU 39', title: 'Travaux de miroiterie-vitrerie', category: 'vitrage', applicableTo: ['vitrages', 'double vitrage'] },
  ],
  isolation: [
    { code: 'DTU 45.1', title: 'Isolation thermique des bâtiments frigorifiques', category: 'isolation', applicableTo: ['chambres froides'] },
    { code: 'DTU 45.2', title: 'Isolation thermique des circuits frigorifiques', category: 'isolation', applicableTo: ['tuyauteries'] },
    { code: 'DTU 45.10', title: 'Isolation des combles par soufflage', category: 'isolation_combles', applicableTo: ['combles perdus'] },
    { code: 'DTU 45.11', title: 'Isolation par l\'intérieur', category: 'iti', applicableTo: ['murs', 'doublage'] },
  ],
  cloisons: [
    { code: 'DTU 25.1', title: 'Enduits intérieurs en plâtre', category: 'platre', applicableTo: ['murs', 'plafonds'] },
    { code: 'DTU 25.31', title: 'Ouvrages verticaux de plâtrerie', category: 'cloisons', applicableTo: ['cloisons', 'doublages'] },
    { code: 'DTU 25.41', title: 'Ouvrages en plaques de plâtre', category: 'placo', applicableTo: ['cloisons', 'plafonds'] },
    { code: 'DTU 25.42', title: 'Plafonds suspendus', category: 'faux_plafond', applicableTo: ['plafonds'] },
  ],
  revetement_sol: [
    { code: 'DTU 52.1', title: 'Revêtements de sol scellés', category: 'carrelage_scelle', applicableTo: ['carrelage', 'pierre'] },
    { code: 'DTU 52.2', title: 'Revêtements de sol collés', category: 'carrelage_colle', applicableTo: ['carrelage', 'faience'] },
    { code: 'DTU 53.1', title: 'Revêtements de sol textiles', category: 'moquette', applicableTo: ['moquette', 'tapis'] },
    { code: 'DTU 53.2', title: 'Revêtements de sol PVC', category: 'pvc', applicableTo: ['sol PVC', 'linoleum'] },
    { code: 'DTU 51.1', title: 'Parquets massifs', category: 'parquet', applicableTo: ['parquet massif'] },
    { code: 'DTU 51.2', title: 'Parquets collés', category: 'parquet', applicableTo: ['parquet collé'] },
    { code: 'DTU 51.3', title: 'Planchers en bois ou panneaux', category: 'plancher', applicableTo: ['plancher bois'] },
  ],
  peinture: [
    { code: 'DTU 59.1', title: 'Peinture des bâtiments', category: 'peinture', applicableTo: ['murs', 'plafonds', 'boiseries'] },
    { code: 'DTU 59.2', title: 'Revêtements plastiques épais', category: 'rpe', applicableTo: ['façade', 'enduit décoratif'] },
    { code: 'DTU 59.4', title: 'Mise en œuvre des papiers peints', category: 'papier_peint', applicableTo: ['papier peint', 'toile de verre'] },
  ],
  plomberie: [
    { code: 'DTU 60.1', title: 'Plomberie sanitaire', category: 'plomberie', applicableTo: ['alimentation', 'évacuation'] },
    { code: 'DTU 60.11', title: 'Règles de calcul des installations de plomberie', category: 'plomberie', applicableTo: ['dimensionnement'] },
    { code: 'DTU 60.31', title: 'Canalisations en chlorure de polyvinyle', category: 'pvc', applicableTo: ['évacuation PVC'] },
    { code: 'DTU 60.32', title: 'Canalisations en polychlorure de vinyle', category: 'pvc', applicableTo: ['évacuation'] },
    { code: 'DTU 60.33', title: 'Canalisations en fonte', category: 'fonte', applicableTo: ['évacuation fonte'] },
  ],
  chauffage: [
    { code: 'DTU 65.10', title: 'Canalisations d\'eau chaude sous pression', category: 'chauffage_central', applicableTo: ['radiateurs', 'tuyauteries'] },
    { code: 'DTU 65.11', title: 'Dispositifs de sécurité des installations de chauffage', category: 'securite', applicableTo: ['soupapes', 'vases'] },
    { code: 'DTU 65.12', title: 'Réalisation des planchers chauffants à eau', category: 'plancher_chauffant', applicableTo: ['plancher chauffant eau'] },
    { code: 'DTU 65.14', title: 'Exécution de planchers chauffants électriques', category: 'plancher_chauffant', applicableTo: ['plancher chauffant électrique'] },
  ],
  electricite: [
    { code: 'NF C 15-100', title: 'Installations électriques à basse tension', category: 'electricite', applicableTo: ['tableau', 'prises', 'éclairage'] },
    { code: 'DTU 70.1', title: 'Installations électriques des bâtiments', category: 'electricite', applicableTo: ['câblage', 'protection'] },
  ],
  ventilation: [
    { code: 'DTU 68.3', title: 'Installations de ventilation mécanique', category: 'vmc', applicableTo: ['VMC simple flux', 'VMC double flux'] },
  ],
  energy: [
    { code: 'DTU 65.12', title: 'Planchers chauffants à eau chaude', category: 'plancher_chauffant', applicableTo: ['chauffage sol'] },
    { code: 'RE2020', title: 'Réglementation Environnementale 2020', category: 'performance', applicableTo: ['neuf', 'extension'] },
    { code: 'RT2012', title: 'Réglementation Thermique 2012', category: 'performance', applicableTo: ['renovation'] },
  ],
  amenagement_exterieur: [
    { code: 'DTU 52.1', title: 'Revêtements de sol scellés', category: 'dallage', applicableTo: ['terrasse', 'allée'] },
    { code: 'NF P 98-335', title: 'Mise en œuvre des pavés et dalles', category: 'paves', applicableTo: ['pavés', 'dalles'] },
  ],
};

// =============================================================================
// SERVICE
// =============================================================================

export class KnowledgeService {
  /**
   * Recherche sémantique dans la base de connaissances
   */
  static async search(options: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
    const {
      query,
      docType,
      category,
      threshold = 0.65,
      limit = 10
    } = options;

    try {
      // Générer l'embedding via l'API
      const embedding = await this.generateEmbedding(query);

      if (!embedding) {
        console.warn('[Knowledge] Impossible de générer l\'embedding');
        return [];
      }

      // Appeler la fonction RPC de recherche
      const { data, error } = await supabase.rpc('search_knowledge', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
        filter_doc_type: docType || null,
        filter_category: category || null
      });

      if (error) {
        console.error('[Knowledge] Search error:', error);
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
      console.error('[Knowledge] Search failed:', error);
      return [];
    }
  }

  /**
   * Génère l'embedding d'une requête
   */
  private static async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      // Utiliser l'API OpenAI pour les embeddings
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small'
        })
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('[Knowledge] Embedding generation failed:', error);
      return null;
    }
  }

  /**
   * Enrichit le contexte CCTP avec les références DTU pertinentes
   */
  static async enrichCCTPContext(
    lotCategories: string[],
    workDescription: string
  ): Promise<CCTPEnrichmentContext> {
    const context: CCTPEnrichmentContext = {
      dtu: [],
      normes: [],
      guides: [],
      applicableDTU: [],
      prescriptions: []
    };

    // 1. Identifier les DTU applicables depuis le catalogue local
    lotCategories.forEach(category => {
      const dtuRefs = DTU_CATALOG[category.toLowerCase()] || [];
      context.applicableDTU.push(...dtuRefs);
    });

    // 2. Rechercher dans la base de connaissances
    const searchQuery = `Prescriptions techniques pour travaux: ${lotCategories.join(', ')}. ${workDescription}`;

    try {
      // Recherche parallèle DTU, normes et guides
      const [dtuResults, normesResults, guidesResults] = await Promise.all([
        this.search({ query: searchQuery, docType: 'dtu', limit: 8 }),
        this.search({ query: searchQuery, docType: 'norme', limit: 5 }),
        this.search({ query: searchQuery, docType: 'guide', limit: 3 })
      ]);

      context.dtu = dtuResults;
      context.normes = normesResults;
      context.guides = guidesResults;

      // 3. Générer les prescriptions par lot
      context.prescriptions = await this.generatePrescriptions(lotCategories, context);

    } catch (error) {
      console.error('[Knowledge] CCTP enrichment failed:', error);
    }

    return context;
  }

  /**
   * Génère les prescriptions techniques par lot
   */
  private static async generatePrescriptions(
    lotCategories: string[],
    context: CCTPEnrichmentContext
  ): Promise<CCTPPrescription[]> {
    const prescriptions: CCTPPrescription[] = [];

    for (const category of lotCategories) {
      const dtuRefs = DTU_CATALOG[category.toLowerCase()] || [];
      const relevantDTU = context.dtu.filter(d =>
        d.category?.toLowerCase() === category.toLowerCase() ||
        dtuRefs.some(ref => d.codeReference?.includes(ref.code))
      );

      // Extraire les exigences des résultats de recherche
      const requirements: string[] = [];
      const materials: string[] = [];
      const execution: string[] = [];
      const controls: string[] = [];

      relevantDTU.forEach(dtu => {
        const content = dtu.content.toLowerCase();

        // Classifier le contenu
        if (content.includes('doit') || content.includes('obligatoire') || content.includes('exigence')) {
          requirements.push(dtu.content.substring(0, 300));
        }
        if (content.includes('matériau') || content.includes('produit') || content.includes('certification')) {
          materials.push(dtu.content.substring(0, 300));
        }
        if (content.includes('mise en œuvre') || content.includes('pose') || content.includes('exécution')) {
          execution.push(dtu.content.substring(0, 300));
        }
        if (content.includes('contrôle') || content.includes('vérification') || content.includes('essai')) {
          controls.push(dtu.content.substring(0, 300));
        }
      });

      prescriptions.push({
        lotCategory: category,
        dtuReferences: dtuRefs.map(d => d.code),
        requirements: requirements.slice(0, 5),
        materials: materials.slice(0, 3),
        execution: execution.slice(0, 5),
        controls: controls.slice(0, 3)
      });
    }

    return prescriptions;
  }

  /**
   * Génère un texte de prescriptions pour un lot de CCTP
   */
  static async generateCCTPLotText(
    lotCategory: string,
    lotDescription: string,
    projectContext: { type: string; location?: string; surface?: number }
  ): Promise<string> {
    // Récupérer les DTU applicables
    const dtuRefs = DTU_CATALOG[lotCategory.toLowerCase()] || [];

    // Rechercher le contexte technique
    const searchQuery = `Prescriptions CCTP ${lotCategory} ${lotDescription}`;
    const results = await this.search({ query: searchQuery, limit: 5 });

    // Construire le prompt pour génération IA
    const dtuContext = dtuRefs.map(d => `- ${d.code}: ${d.title}`).join('\n');
    const knowledgeContext = results.map(r => r.content.substring(0, 500)).join('\n---\n');

    const prompt = `Tu es un expert en rédaction de CCTP BTP. Génère les prescriptions techniques pour le lot "${lotCategory}" dans le cadre d'un projet de ${projectContext.type}.

CONTEXTE:
- Type de travaux: ${lotDescription}
- Surface approximative: ${projectContext.surface || 'Non spécifiée'} m²
- Localisation: ${projectContext.location || 'France métropolitaine'}

DTU APPLICABLES:
${dtuContext}

RÉFÉRENCES TECHNIQUES:
${knowledgeContext}

Génère un texte de CCTP structuré avec:
1. PRESCRIPTIONS GÉNÉRALES
2. MATÉRIAUX ET PRODUITS
3. MODE D'EXÉCUTION
4. CONTRÔLES ET RÉCEPTION

Format: texte professionnel, précis, conforme aux DTU mentionnés.`;

    try {
      const { data } = await hybridAIService.generateText(prompt, {
        systemPrompt: 'Tu es un expert en rédaction de Cahiers des Clauses Techniques Particulières (CCTP) pour le bâtiment. Rédige de manière professionnelle et conforme aux normes DTU.',
        temperature: 0.3
      });

      return data || this.generateDefaultPrescriptions(lotCategory, dtuRefs);
    } catch (error) {
      console.error('[Knowledge] CCTP generation failed:', error);
      return this.generateDefaultPrescriptions(lotCategory, dtuRefs);
    }
  }

  /**
   * Génère des prescriptions par défaut si l'IA n'est pas disponible
   */
  private static generateDefaultPrescriptions(lotCategory: string, dtuRefs: DTUReference[]): string {
    const dtuList = dtuRefs.map(d => `- ${d.code}: ${d.title}`).join('\n');

    return `### ${lotCategory.toUpperCase()}

#### 1. PRESCRIPTIONS GÉNÉRALES
Les travaux seront exécutés conformément aux règles de l'art et aux Documents Techniques Unifiés (DTU) suivants:
${dtuList || '- DTU applicables selon la nature des travaux'}

L'entreprise devra respecter l'ensemble des réglementations en vigueur, notamment:
- La réglementation thermique applicable
- Les normes de sécurité incendie
- Les règles d'accessibilité si applicables

#### 2. MATÉRIAUX ET PRODUITS
Tous les matériaux et produits mis en œuvre devront:
- Être conformes aux normes NF ou équivalentes
- Disposer des certifications requises (marquage CE, Avis Technique, etc.)
- Être adaptés à l'usage prévu et aux conditions d'exposition

#### 3. MODE D'EXÉCUTION
Les travaux seront réalisés selon les prescriptions des DTU mentionnés ci-dessus.
L'entreprise devra:
- Respecter les conditions de mise en œuvre préconisées par les fabricants
- Assurer la protection des ouvrages existants
- Coordonner ses interventions avec les autres corps d'état

#### 4. CONTRÔLES ET RÉCEPTION
Avant réception, l'entreprise procédera aux vérifications et essais nécessaires.
Les contrôles porteront notamment sur:
- La conformité des matériaux mis en œuvre
- Le respect des règles de mise en œuvre
- Les performances attendues (thermiques, acoustiques, etc.)
`;
  }

  /**
   * Récupère les statistiques de la base de connaissances
   */
  static async getStats(): Promise<{
    docTypes: { type: string; count: number }[];
    totalDocuments: number;
    totalChunks: number;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_knowledge_stats');

      if (error) {
        console.error('[Knowledge] Stats error:', error);
        return { docTypes: [], totalDocuments: 0, totalChunks: 0 };
      }

      const docTypes = (data || []).map((row: any) => ({
        type: row.doc_type,
        count: parseInt(row.doc_count)
      }));

      return {
        docTypes,
        totalDocuments: docTypes.reduce((sum, d) => sum + d.count, 0),
        totalChunks: (data || []).reduce((sum: number, d: any) => sum + parseInt(d.chunks_count || 0), 0)
      };
    } catch (error) {
      console.error('[Knowledge] Stats failed:', error);
      return { docTypes: [], totalDocuments: 0, totalChunks: 0 };
    }
  }
}

export default KnowledgeService;
