# Module B2B - État d'avancement et Prochaines Étapes

## 📊 Résumé de l'implémentation

### ✅ Fonctionnalités complètes (100%)

1. **Dashboard B2B** (`/pro/dashboard`)
   - Affichage des statistiques (analyses, score moyen, documents)
   - Liste des analyses récentes
   - Alertes pour les documents expirants
   - Onboarding automatique si pas de profil

2. **Onboarding Entreprise** (`/pro/onboarding`)
   - Formulaire complet de création de profil
   - Vérification SIRET en temps réel avec API Entreprise
   - Auto-remplissage des données (raison sociale, adresse, etc.)
   - Fallback vers mock si pas de clé API

3. **Soumission de Devis** (`/pro/new-analysis`)
   - Upload de fichier PDF (max 10MB)
   - Validation du fichier
   - Création d'analyse en base
   - Déclenchement de l'analyse IA (mock pour l'instant)

4. **Détail d'Analyse** (`/pro/analysis/:id`)
   - Affichage du score TORP /1000
   - Grade visuel (A+, A, B, C, etc.)
   - Scores détaillés par axe (Transparence, Offre, Robustesse, Prix)
   - Recommandations d'amélioration
   - Génération de ticket TORP avec QR code
   - Re-analyse versionnée

5. **Génération Ticket TORP**
   - Génération de code unique (via SQL function)
   - Création de QR code avec librairie `qrcode`
   - Upload du QR code vers Supabase Storage (bucket `tickets-torp`)
   - Tracking des vues de ticket

6. **Page Publique de Ticket** (`/t/:code`)
   - Accessible sans authentification
   - Affichage du badge TORP avec grade et score
   - Scores détaillés par axe
   - Tracking automatique des consultations
   - Design public optimisé

7. **Re-analyse Versionnée**
   - Upload d'un nouveau PDF pour re-analyse
   - Système de versions avec `parent_analysis_id`
   - Historique des versions
   - Navigation entre versions

8. **Vérification SIRET**
   - Intégration API Entreprise (gratuite, gouvernementale)
   - Extraction automatique des données (nom, adresse, NAF, effectif)
   - Fallback vers mock si pas de token configuré

---

## ⚠️ Fonctionnalité à finaliser

### 🔴 PRIORITÉ : Moteur d'analyse de devis (actuellement mock)

**Problème actuel** :
- La fonction `runMockAnalysis()` dans `src/services/api/pro/analysisService.ts` génère des scores aléatoires
- Les recommandations sont génériques et non basées sur le contenu réel du PDF
- L'analyse ne lit pas vraiment le PDF

**Fichier** : `src/services/api/pro/analysisService.ts` (lignes 242-295)

**Solution recommandée** : 3 options selon vos besoins

---

### Option A : Utiliser OpenAI/Claude pour l'analyse (Recommandé)

**Avantages** :
- Analyse sémantique complète du PDF
- Recommandations personnalisées et précises
- Facile à améliorer avec des prompts

**Étapes** :

1. **Installer les dépendances**
```bash
npm install openai pdf-parse
npm install --save-dev @types/pdf-parse
```

2. **Créer le service d'extraction PDF** : `src/services/pdf/pdfExtractor.ts`
```typescript
import pdf from 'pdf-parse';

export async function extractPDFText(fileUrl: string): Promise<string> {
  // Télécharger le PDF depuis Supabase Storage
  const response = await fetch(fileUrl);
  const buffer = await response.arrayBuffer();

  // Extraire le texte
  const data = await pdf(Buffer.from(buffer));
  return data.text;
}
```

3. **Créer le prompt d'analyse B2B** : `src/services/ai/prompts/b2b-analysis.prompts.ts`
```typescript
export function buildB2BAnalysisPrompt(): string {
  return `Tu es un expert en analyse de devis professionnels. Tu dois évaluer un devis selon 4 axes TORP (1000 points au total) :

## 1. TRANSPARENCE (0-250 points)
Évalue :
- Présence du SIRET et informations légales (50pts)
- Détail des postes et quantités (80pts)
- Références des matériaux/produits (60pts)
- Clarté de la description (60pts)

## 2. OFFRE (0-250 points)
Évalue :
- Qualité de la description technique (100pts)
- Conformité aux normes métier (80pts)
- Valeur ajoutée démontrée (70pts)

## 3. ROBUSTESSE (0-250 points)
Évalue :
- Mentions de garanties (décennale, biennale) (100pts)
- Assurances professionnelles (70pts)
- Certifications (RGE, Qualibat, etc.) (80pts)

## 4. PRIX (0-250 points)
Évalue en mode auto-évaluation :
- Détail des prix unitaires (100pts)
- Transparence TVA/HT/TTC (80pts)
- Conditions de paiement claires (70pts)

Pour chaque axe, fournis :
1. Le score (0-250)
2. 2-3 recommandations concrètes avec impact chiffré
3. Des exemples de formulation

Retourne au format JSON :
{
  "score_details": {
    "transparence": 180,
    "offre": 190,
    "robustesse": 160,
    "prix": 200
  },
  "recommandations": [
    {
      "type": "transparence",
      "message": "Ajoutez les références exactes des matériaux",
      "impact": "+30pts",
      "priority": "high",
      "difficulty": "easy",
      "example": "Ex: Parquet chêne massif 14mm - Réf. OAK-PRE-14"
    }
  ],
  "points_bloquants": []
}`;
}
```

4. **Remplacer `runMockAnalysis` dans `analysisService.ts`**
```typescript
import OpenAI from 'openai';
import { extractPDFText } from '@/services/pdf/pdfExtractor';
import { buildB2BAnalysisPrompt } from '@/services/ai/prompts/b2b-analysis.prompts';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Pour Vite
});

async function runRealAnalysis(analysisId: string): Promise<void> {
  try {
    // 1. Récupérer l'analyse
    const analysis = await getAnalysis(analysisId);
    if (!analysis) throw new Error('Analysis not found');

    // 2. Mettre le statut en PROCESSING
    await supabase
      .from('pro_devis_analyses')
      .update({ status: 'PROCESSING' })
      .eq('id', analysisId);

    // 3. Extraire le texte du PDF
    const pdfText = await extractPDFText(analysis.file_url);

    // 4. Appeler OpenAI pour l'analyse
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: buildB2BAnalysisPrompt() },
        { role: 'user', content: `Analyse ce devis :\n\n${pdfText}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    // 5. Calculer le score total
    const scoreTotal =
      result.score_details.transparence +
      result.score_details.offre +
      result.score_details.robustesse +
      result.score_details.prix;

    // 6. Calculer le grade via SQL
    const { data: gradeData } = await supabase
      .rpc('calculate_grade_from_score', { score: scoreTotal });

    // 7. Mettre à jour l'analyse avec les résultats
    await supabase
      .from('pro_devis_analyses')
      .update({
        status: 'COMPLETED',
        score_total: scoreTotal,
        grade: gradeData || 'B',
        score_details: result.score_details,
        recommandations: result.recommandations,
        points_bloquants: result.points_bloquants || [],
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

  } catch (error) {
    console.error('❌ Erreur analyse:', error);

    // Marquer l'analyse comme échouée
    await supabase
      .from('pro_devis_analyses')
      .update({
        status: 'FAILED',
        metadata: { error: error.message }
      })
      .eq('id', analysisId);
  }
}
```

5. **Remplacer l'appel dans `createAnalysis`** (ligne 232)
```typescript
// Avant :
setTimeout(async () => {
  await runMockAnalysis(analysis.id);
}, 2000);

// Après :
setTimeout(async () => {
  await runRealAnalysis(analysis.id);
}, 2000);
```

6. **Ajouter la variable d'environnement** dans `.env`
```
VITE_OPENAI_API_KEY=sk-...
```

**Coût estimé** : ~$0.05-0.10 par analyse (avec GPT-4)

---

### Option B : Adapter le système B2C existant

Le fichier `src/services/ai/prompts/torp-analysis.prompts.ts` contient déjà une méthodologie complète de 1000 points pour le B2C.

**Avantages** :
- Système déjà éprouvé
- Prompts détaillés et précis

**Adaptations nécessaires** :
1. Renommer les 5 axes B2C en 4 axes B2B :
   - ✅ **Entreprise** (250pts) → **Robustesse** (250pts)
   - ✅ **Prix** (300pts) → **Prix** (250pts) - réduire le poids
   - ✅ **Complétude** (200pts) → **Transparence** (250pts) - augmenter le poids
   - ❌ **Conformité** (150pts) → Intégrer dans **Robustesse**
   - ❌ **Délais** (100pts) → Supprimer (moins pertinent en B2B)
   - ✅ Ajouter **Offre** (250pts) - nouvel axe sur la valeur technique

2. Créer un nouveau fichier `b2b-torp-analysis.prompts.ts` basé sur le B2C
3. Utiliser le même système d'extraction et d'analyse

---

### Option C : Système de règles simples (sans IA)

**Avantages** :
- Pas de coût d'API
- Prévisible et rapide

**Inconvénients** :
- Moins précis et flexible
- Pas d'analyse sémantique

**Exemple** : `src/services/analysis/b2bCriteria.ts`
```typescript
export function analyzeTransparence(pdfText: string): {
  score: number;
  recommandations: Recommendation[];
} {
  let score = 0;
  const recommandations: Recommendation[] = [];

  // Vérifier présence SIRET
  if (/\d{14}/.test(pdfText)) {
    score += 50;
  } else {
    recommandations.push({
      type: 'transparence',
      message: 'Ajoutez votre numéro SIRET',
      impact: '+50pts',
      priority: 'high',
      difficulty: 'easy'
    });
  }

  // Compter les lignes de détail
  const lignes = pdfText.split('\n').filter(l => /\d+[.,]\d{2}/.test(l));
  if (lignes.length > 10) {
    score += 80;
  } else if (lignes.length > 5) {
    score += 40;
    recommandations.push({
      type: 'transparence',
      message: 'Détaillez davantage les postes',
      impact: '+40pts',
      priority: 'medium',
      difficulty: 'medium'
    });
  }

  // ... autres règles

  return { score, recommandations };
}

// Appeler les 4 fonctions d'analyse
export async function analyzeDevisB2B(pdfText: string) {
  const transparence = analyzeTransparence(pdfText);
  const offre = analyzeOffre(pdfText);
  const robustesse = analyzeRobustesse(pdfText);
  const prix = analyzePrix(pdfText);

  return {
    score_details: {
      transparence: transparence.score,
      offre: offre.score,
      robustesse: robustesse.score,
      prix: prix.score
    },
    recommandations: [
      ...transparence.recommandations,
      ...offre.recommandations,
      ...robustesse.recommandations,
      ...prix.recommandations
    ]
  };
}
```

---

## 🚀 Ordre d'implémentation recommandé

1. **Option A (IA) - Recommandé** : La plus précise et flexible (1-2 jours)
2. **Option B (B2C adapté)** : Si vous voulez réutiliser le système existant (1 jour)
3. **Option C (Règles)** : Si vous voulez éviter les coûts d'API (1 jour)

---

## 📝 Variables d'environnement requises

```env
# API Entreprise (pour SIRET - CONFIGURÉ ✅)
VITE_API_ENTREPRISE_TOKEN=votre_token

# OpenAI (pour analyse - À CONFIGURER)
VITE_OPENAI_API_KEY=sk-...

# OU Claude (alternative)
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

---

## ✅ Checklist de mise en production

- [x] Migration SQL 011 appliquée (email nullable)
- [x] Token API Entreprise configuré (ou mock accepté)
- [x] Buckets Supabase Storage créés et configurés
  - [x] company-documents
  - [x] devis-analyses
  - [x] tickets-torp
- [x] Policies Storage appliquées
- [x] QR code et génération ticket testés
- [x] Page publique `/t/:code` testée
- [x] Re-analyse versionnée testée
- [ ] **Moteur d'analyse IA implémenté** (RESTE À FAIRE)
- [ ] Tests avec vrais devis PDF
- [ ] Validation des scores avec des professionnels

---

## 📚 Ressources

- [API Entreprise](https://api.gouv.fr/les-api/api-entreprise) - Vérification SIRET (gratuit)
- [OpenAI API](https://platform.openai.com/docs) - Analyse IA de devis
- [QRCode.js](https://github.com/soldair/node-qrcode) - Génération QR codes
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) - Extraction texte PDF
- [Supabase Storage](https://supabase.com/docs/guides/storage) - Stockage fichiers

---

## 🎉 Conclusion

Le module B2B est **90% fonctionnel** !

**Implémenté** :
- ✅ Toute l'infrastructure (DB, API, UI)
- ✅ Vérification SIRET réelle
- ✅ Génération de tickets avec QR codes
- ✅ Système de versions
- ✅ Page publique de consultation

**Reste à faire** :
- ⚠️ Remplacer l'analyse mock par une vraie analyse IA (Option A recommandée)

**Temps estimé pour finaliser** : 1-2 jours avec l'Option A (IA)
