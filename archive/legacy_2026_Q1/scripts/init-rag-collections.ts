/**
 * Script d'initialisation des collections RAG
 * Exécuter avec: npx tsx scripts/init-rag-collections.ts
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// =============================================================================
// COLLECTION DEFINITIONS
// =============================================================================

interface CollectionSeed {
  slug: string;
  name: string;
  description: string;
  category: string;
  sampleDocuments: SampleDocument[];
}

interface SampleDocument {
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

const COLLECTIONS: CollectionSeed[] = [
  {
    slug: 'dtu_normes',
    name: 'DTU et Normes',
    description: 'Documents Techniques Unifiés et normes de construction',
    category: 'dtu',
    sampleDocuments: [
      {
        title: 'DTU 20.1 - Ouvrages en maçonnerie de petits éléments',
        content: `DTU 20.1 - MAÇONNERIE DE PETITS ÉLÉMENTS

DOMAINE D'APPLICATION
Ce DTU s'applique aux ouvrages de maçonnerie de petits éléments (briques, blocs de béton, pierres) hourdés au mortier.

MATÉRIAUX
- Blocs de béton conformes à NF EN 771-3
- Briques conformes à NF EN 771-1
- Mortiers conformes à NF EN 998-2

MISE EN ŒUVRE
- Humidification préalable des éléments
- Joints horizontaux: 10 à 15 mm
- Joints verticaux: 10 à 15 mm
- Chaînages verticaux et horizontaux obligatoires

TOLÉRANCES
- Verticalité: 15 mm sur 3 m
- Planéité: 10 mm sous règle de 2 m
- Alignement: 20 mm sur 10 m`,
        metadata: { dtu_code: 'DTU 20.1', lot: 'gros_oeuvre', year: 2024 },
      },
      {
        title: 'NF C 15-100 - Installations électriques basse tension',
        content: `NF C 15-100 - INSTALLATIONS ÉLECTRIQUES BASSE TENSION

DOMAINE D'APPLICATION
Règles de conception et de réalisation des installations électriques basse tension dans les bâtiments.

PROTECTION DES CIRCUITS
- Disjoncteur différentiel 30 mA obligatoire
- Calibrage des protections selon section des conducteurs
- Sélectivité des protections

EQUIPEMENTS MINIMUM PAR PIÈCE
Séjour: 5 prises, 1 point d'éclairage
Chambre: 3 prises, 1 point d'éclairage
Cuisine: 6 prises, 1 point d'éclairage
Salle de bains: 1 prise hors volume, 1 point d'éclairage

VOLUMES SALLE DE BAINS
- Volume 0: IPX7 minimum
- Volume 1: IPX4 ou IPX5
- Volume 2: IPX4
- Hors volume: pas d'exigence particulière`,
        metadata: { norme_code: 'NF C 15-100', lot: 'electricite', year: 2024 },
      },
    ],
  },
  {
    slug: 'cctp_templates',
    name: 'Modèles CCTP',
    description: 'Modèles et templates de CCTP par lot',
    category: 'cctp',
    sampleDocuments: [
      {
        title: 'Template CCTP - Lot Électricité',
        content: `CAHIER DES CLAUSES TECHNIQUES PARTICULIÈRES
LOT ÉLECTRICITÉ

ARTICLE 1 - ÉTENDUE DES TRAVAUX
Le présent lot comprend:
- Alimentation générale depuis TGBT
- Distribution électrique complète
- Appareillage et prises de courant
- Éclairage intérieur et extérieur
- Mise à la terre et liaisons équipotentielles

ARTICLE 2 - NORMES ET RÈGLEMENTS
Les travaux seront exécutés conformément à:
- NF C 15-100 (édition en vigueur)
- Guide UTE C 15-520
- Consuel

ARTICLE 3 - MATÉRIAUX
- Câbles: série U1000R2V ou équivalent
- Appareillage: gamme complète certifiée NF
- Tableau: XL3 Legrand ou équivalent

ARTICLE 4 - CONTRÔLE ET RÉCEPTION
- Vérification visuelle
- Mesures d'isolement
- Test différentiels
- Attestation CONSUEL`,
        metadata: { lot: 'electricite', template_type: 'cctp', version: '2.0' },
      },
      {
        title: 'Template CCTP - Lot Plomberie Sanitaire',
        content: `CAHIER DES CLAUSES TECHNIQUES PARTICULIÈRES
LOT PLOMBERIE SANITAIRE

ARTICLE 1 - ÉTENDUE DES TRAVAUX
Le présent lot comprend:
- Alimentation eau froide et eau chaude
- Évacuations eaux usées et eaux vannes
- Appareils sanitaires
- Robinetterie
- Production eau chaude sanitaire

ARTICLE 2 - NORMES ET RÈGLEMENTS
Les travaux seront exécutés conformément à:
- DTU 60.1 - Plomberie sanitaire
- DTU 60.11 - Règles de calcul
- DTU 65.10 - Canalisations ECS

ARTICLE 3 - MATÉRIAUX
- Cuivre: NF EN 1057
- PER: NF EN ISO 15875
- PVC: NF EN 1329

ARTICLE 4 - MISE EN ŒUVRE
- Calorifugeage des canalisations
- Pentes d'évacuation: 1 à 3 cm/m
- Essais d'étanchéité sous pression`,
        metadata: { lot: 'plomberie', template_type: 'cctp', version: '2.0' },
      },
    ],
  },
  {
    slug: 'prix_reference',
    name: 'Prix de Référence',
    description: 'Prix de référence des travaux (type Batiprix)',
    category: 'prix',
    sampleDocuments: [
      {
        title: 'Prix Référence - Gros Œuvre 2024',
        content: `PRIX DE RÉFÉRENCE GROS ŒUVRE 2024
Base: France métropolitaine, hors Île-de-France

FONDATIONS
- Semelle filante béton: 85-120 €/ml
- Semelle isolée: 150-250 €/u
- Longrine béton armé: 95-140 €/ml
- Micropieux: 150-250 €/ml

MAÇONNERIE
- Mur parpaing 20cm: 65-85 €/m²
- Mur brique 20cm: 80-110 €/m²
- Mur béton banché: 120-180 €/m²
- Chaînage horizontal: 35-50 €/ml
- Chaînage vertical: 40-60 €/ml

PLANCHERS
- Poutrelles + hourdis 16+4: 70-95 €/m²
- Dalle pleine BA 20cm: 100-140 €/m²
- Prédalle + dalle collaboration: 85-115 €/m²

Note: Prix fourni posé, hors TVA, niveau moyen de finition`,
        metadata: { category: 'gros_oeuvre', year: 2024, region: 'france_hors_idf' },
      },
      {
        title: 'Prix Référence - Second Œuvre 2024',
        content: `PRIX DE RÉFÉRENCE SECOND ŒUVRE 2024
Base: France métropolitaine, hors Île-de-France

ÉLECTRICITÉ
- Point lumineux simple: 80-120 €/u
- Prise de courant: 60-90 €/u
- Tableau électrique 2 rangées: 400-600 €/u
- Mise à la terre: 150-250 €/u

PLOMBERIE
- Point d'eau complet: 350-550 €/u
- WC suspendu posé: 600-900 €/u
- Douche italienne complète: 1200-2000 €/u
- Baignoire posée: 800-1500 €/u

CHAUFFAGE
- Radiateur électrique: 200-400 €/u
- Radiateur eau chaude: 350-600 €/u
- Plancher chauffant eau: 70-100 €/m²
- PAC air/eau: 8000-15000 €/u

Note: Prix fourni posé, hors TVA, niveau moyen de finition`,
        metadata: { category: 'second_oeuvre', year: 2024, region: 'france_hors_idf' },
      },
    ],
  },
  {
    slug: 'aides_financieres',
    name: 'Aides Financières',
    description: 'Documentation sur les aides (MaPrimeRénov, CEE, etc.)',
    category: 'aides',
    sampleDocuments: [
      {
        title: 'MaPrimeRénov 2024 - Barèmes et conditions',
        content: `MAPRIMERENOV 2024 - GUIDE COMPLET

CONDITIONS D'ÉLIGIBILITÉ
- Logement de plus de 15 ans
- Résidence principale
- Propriétaire occupant ou bailleur
- Travaux réalisés par artisan RGE

CATÉGORIES DE REVENUS (Île-de-France)
- Très modestes (bleu): < 23 541 € (1 pers.)
- Modestes (jaune): < 28 657 €
- Intermédiaires (violet): < 40 018 €
- Aisés (rose): > 40 018 €

MONTANTS PAR TRAVAUX (ménages très modestes)
- Isolation murs extérieur: 75 €/m²
- Isolation toiture: 75 €/m²
- PAC air/eau: 5 000 €
- PAC géothermie: 11 000 €
- Chaudière granulés: 10 000 €
- VMC double flux: 2 500 €

PARCOURS ACCOMPAGNÉ (rénovation globale)
- 2 classes DPE: jusqu'à 80% du coût, plafond 63 000 €
- Bonus sortie passoire: +10%
- Accompagnateur Rénov obligatoire`,
        metadata: { aide: 'maprimenov', year: 2024, version: '2.0' },
      },
      {
        title: 'Éco-PTZ 2024 - Prêt à taux zéro',
        content: `ÉCO-PTZ 2024 - GUIDE COMPLET

CONDITIONS D'ÉLIGIBILITÉ
- Logement de plus de 2 ans
- Résidence principale
- Au moins une action éligible
- Artisan RGE obligatoire

MONTANTS ET DURÉES
- 1 action: 15 000 € sur 15 ans
- 2 actions: 25 000 € sur 15 ans
- 3 actions ou plus: 30 000 € sur 15 ans
- Performance globale: 50 000 € sur 20 ans

ACTIONS ÉLIGIBLES
- Isolation thermique toiture
- Isolation murs donnant sur extérieur
- Isolation planchers bas
- Remplacement fenêtres
- Installation chauffage performant
- Installation ECS performante
- Installation ventilation

CUMUL AVEC AUTRES AIDES
- Cumulable avec MaPrimeRénov
- Cumulable avec CEE
- Cumulable avec TVA 5,5%`,
        metadata: { aide: 'ecoptz', year: 2024, version: '1.0' },
      },
    ],
  },
  {
    slug: 'pathologies_btp',
    name: 'Pathologies Bâtiment',
    description: 'Guide des pathologies et désordres du bâtiment',
    category: 'pathologies',
    sampleDocuments: [
      {
        title: 'Guide Pathologies - Fissures',
        content: `PATHOLOGIES DU BÂTIMENT - FISSURES

CLASSIFICATION DES FISSURES
- Microfissures: < 0.2 mm (esthétique)
- Fissures fines: 0.2 à 2 mm (surveillance)
- Fissures larges: > 2 mm (structurel)

CAUSES PRINCIPALES
1. Retrait du béton/mortier
2. Mouvements de terrain (argiles)
3. Défauts de fondations
4. Surcharges structurelles
5. Variations thermiques
6. Vieillissement des matériaux

DIAGNOSTIC
- Mesure avec fissuromètre
- Suivi dans le temps (jauge)
- Étude de sol si nécessaire
- Expertise structure si > 2 mm

TRAITEMENTS
- Microfissures: enduit souple
- Fissures fines: injection résine
- Fissures structurelles: reprise en sous-œuvre
- Fissures actives: traitement spécifique

COÛTS INDICATIFS
- Traitement superficiel: 30-50 €/ml
- Injection: 80-150 €/ml
- Reprise fondations: 500-1500 €/ml`,
        metadata: { pathologie: 'fissures', severity: 'variable' },
      },
      {
        title: 'Guide Pathologies - Humidité',
        content: `PATHOLOGIES DU BÂTIMENT - HUMIDITÉ

TYPES D'HUMIDITÉ
1. Remontées capillaires
2. Infiltrations (toiture, façade)
3. Condensation
4. Fuites (canalisations)

SIGNES VISIBLES
- Taches sombres
- Moisissures
- Salpêtre (efflorescences)
- Peinture qui cloque
- Odeur de moisi

DIAGNOSTIC
- Mesure hygrométrique
- Test à la bombe carbure
- Thermographie infrarouge
- Inspection canalisations

TRAITEMENTS PAR TYPE
Remontées capillaires:
- Injection de résine: 100-200 €/ml
- Drainage périphérique: 150-300 €/ml
- Membrane d'étanchéité

Infiltrations:
- Réfection étanchéité toiture
- Traitement façade hydrofuge
- Reprise zinguerie

Condensation:
- Amélioration ventilation
- Isolation thermique
- VMC hygro ou double flux

PRÉVENTION
- Ventilation adaptée
- Drainage terrain
- Entretien régulier`,
        metadata: { pathologie: 'humidite', severity: 'medium_high' },
      },
    ],
  },
];

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function initCollections() {
  console.log('🚀 Initialisation des collections RAG...\n');

  for (const collection of COLLECTIONS) {
    console.log(`📁 Collection: ${collection.name} (${collection.slug})`);

    // Get or create collection
    const { data: existingCollection, error: fetchError } = await supabase
      .from('knowledge_collections')
      .select('id')
      .eq('slug', collection.slug)
      .single();

    let collectionId: string;

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error(`   ❌ Erreur: ${fetchError.message}`);
      continue;
    }

    if (existingCollection) {
      collectionId = existingCollection.id;
      console.log(`   ✓ Collection existante (${collectionId})`);
    } else {
      const { data: newCollection, error: createError } = await supabase
        .from('knowledge_collections')
        .insert({
          name: collection.name,
          slug: collection.slug,
          description: collection.description,
          category: collection.category,
          is_system: true,
        })
        .select()
        .single();

      if (createError) {
        console.error(`   ❌ Erreur création: ${createError.message}`);
        continue;
      }

      collectionId = newCollection.id;
      console.log(`   ✓ Collection créée (${collectionId})`);
    }

    // Add sample documents
    for (const doc of collection.sampleDocuments) {
      // Check if document exists
      const { data: existingDoc } = await supabase
        .from('knowledge_documents')
        .select('id')
        .eq('title', doc.title)
        .eq('collection_id', collectionId)
        .single();

      if (existingDoc) {
        console.log(`   - Document "${doc.title}" existe déjà`);
        continue;
      }

      // Create document
      const { data: newDoc, error: docError } = await supabase
        .from('knowledge_documents')
        .insert({
          collection_id: collectionId,
          title: doc.title,
          filename: `${collection.slug}/${doc.title.toLowerCase().replace(/\s+/g, '-')}.md`,
          doc_type: collection.category,
          category: collection.category,
          status: 'pending',
          metadata: doc.metadata,
        })
        .select()
        .single();

      if (docError) {
        console.error(`   ❌ Erreur document: ${docError.message}`);
        continue;
      }

      // Create chunk (content)
      const { error: chunkError } = await supabase
        .from('knowledge_chunks')
        .insert({
          document_id: newDoc.id,
          collection_id: collectionId,
          content: doc.content,
          page_number: 1,
          section_title: doc.title,
          metadata: doc.metadata,
        });

      if (chunkError) {
        console.error(`   ❌ Erreur chunk: ${chunkError.message}`);
        continue;
      }

      console.log(`   + Document ajouté: "${doc.title}"`);

      // Generate embedding via Edge Function
      try {
        const { error: embeddingError } = await supabase.functions.invoke(
          'generate-embedding',
          {
            body: {
              text: doc.content,
              documentId: newDoc.id,
            },
          }
        );

        if (embeddingError) {
          console.log(`   ⚠ Embedding non généré (Edge Function non disponible)`);
        } else {
          // Update document status
          await supabase
            .from('knowledge_documents')
            .update({ status: 'indexed' })
            .eq('id', newDoc.id);
          console.log(`   ✓ Embedding généré`);
        }
      } catch {
        console.log(`   ⚠ Embedding sera généré ultérieurement`);
      }
    }

    console.log('');
  }

  // Print summary
  console.log('📊 Résumé des collections:');
  const { data: stats } = await supabase
    .from('knowledge_collections')
    .select('name, slug, document_count, chunk_count');

  if (stats) {
    stats.forEach((col) => {
      console.log(`   - ${col.name}: ${col.document_count || 0} docs, ${col.chunk_count || 0} chunks`);
    });
  }

  console.log('\n✅ Initialisation terminée!');
}

// Run
initCollections().catch(console.error);
