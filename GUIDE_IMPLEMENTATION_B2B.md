# Module B2B - Guide d'implémentation des services restants

Ce document détaille comment implémenter les services restants pour rendre le module B2B 100% fonctionnel.

## 📋 État actuel

### ✅ Complètement implémenté
- Dashboard B2B avec données réelles
- Onboarding avec formulaire complet
- Upload et soumission de devis
- Affichage détaillé des résultats d'analyse
- Navigation complète sans erreurs 404
- Base de données avec migrations SQL
- Services API (companyService, documentService, analysisService)

### 🔶 Partiellement implémenté (mock)
- Vérification SIRET (mock - à remplacer)
- Analyse de devis (mock - à implémenter)
- Génération ticket TORP (service prêt, UI à faire)
- Re-analyse versionnée (service prêt, UI à faire)

---

## 1️⃣ Vérification SIRET avec API réelle

### Option A : API Entreprise (Gratuite, Officielle)

**Inscription** : https://api.gouv.fr/les-api/api-entreprise

**Fichier** : `src/services/api/pro/companyService.ts`

**Remplacer la fonction `verifySiret`** :

```typescript
export async function verifySiret(siret: string): Promise<VerifySiretResponse> {
  const siretClean = siret.replace(/\s/g, '');

  if (!/^\d{14}$/.test(siretClean)) {
    return {
      valid: false,
      error: 'Format SIRET invalide (14 chiffres requis)',
    };
  }

  // API Entreprise (Gratuite)
  const API_KEY = import.meta.env.VITE_API_ENTREPRISE_TOKEN;

  if (!API_KEY) {
    console.warn('⚠️ VITE_API_ENTREPRISE_TOKEN non configuré, utilisation du mock');
    return await verifySiretMock(siretClean);
  }

  try {
    // API Entreprise - Unité légale
    const response = await fetch(
      `https://entreprise.api.gouv.fr/v3/insee/sirene/unites_legales/${siretClean.substring(0, 9)}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return { valid: false, error: 'SIRET non trouvé ou API indisponible' };
    }

    const data = await response.json();
    const unite = data.data.unite_legale;

    // API Entreprise - Établissement
    const etablissementResponse = await fetch(
      `https://entreprise.api.gouv.fr/v3/insee/sirene/etablissements/${siretClean}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    const etablissementData = etablissementResponse.ok ? await etablissementResponse.json() : null;
    const etablissement = etablissementData?.data?.etablissement;

    return {
      valid: true,
      data: {
        siren: unite.siren,
        siret: siretClean,
        raison_sociale: unite.personne_morale_attributs?.raison_sociale || unite.denomination,
        forme_juridique: unite.forme_juridique?.libelle,
        code_naf: unite.activite_principale,
        adresse: etablissement?.adresse ?
          `${etablissement.adresse.numero_voie || ''} ${etablissement.adresse.type_voie || ''} ${etablissement.adresse.libelle_voie || ''}`.trim()
          : undefined,
        code_postal: etablissement?.adresse?.code_postal,
        ville: etablissement?.adresse?.libelle_commune,
        date_creation: unite.date_creation,
        effectif: etablissement?.tranche_effectifs?.libelle,
      },
    };
  } catch (error) {
    console.error('Erreur API Entreprise:', error);
    return { valid: false, error: 'Erreur lors de la vérification' };
  }
}

// Fonction mock de fallback
async function verifySiretMock(siretClean: string): Promise<VerifySiretResponse> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const siren = siretClean.substring(0, 9);

  return {
    valid: true,
    data: {
      siren,
      siret: siretClean,
      raison_sociale: 'ENTREPRISE TEST MOCK',
      forme_juridique: 'SARL',
      code_naf: '4120A',
      adresse: '123 Rue de Test',
      code_postal: '75001',
      ville: 'Paris',
      date_creation: '2020-01-15',
      effectif: '1-10',
    },
  };
}
```

**Configuration** : Ajouter dans `.env` :
```
VITE_API_ENTREPRISE_TOKEN=votre_token_api_entreprise
```

### Option B : API Pappers (Payante, Plus complète)

```typescript
const response = await fetch(
  `https://api.pappers.fr/v2/entreprise?siret=${siretClean}&api_token=${import.meta.env.VITE_PAPPERS_API_KEY}`
);
```

---

## 2️⃣ Génération Ticket TORP avec QR Code

### Installer les dépendances

```bash
npm install qrcode jspdf
npm install --save-dev @types/qrcode
```

### Implémenter dans `analysisService.ts`

**Remplacer la fonction `generateTicket`** :

```typescript
import QRCode from 'qrcode';

export async function generateTicket(analysisId: string): Promise<{
  ticket_url: string;
  ticket_code: string;
  qr_code_url: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const analysis = await getAnalysis(analysisId);
  if (!analysis || analysis.status !== 'COMPLETED') {
    throw new Error('Analysis not completed');
  }

  // Générer un code unique via SQL
  const { data: ticketCode, error: codeError } = await supabase
    .rpc('generate_ticket_code');

  if (codeError || !ticketCode) {
    throw new Error('Failed to generate ticket code');
  }

  // Générer le QR code
  const publicUrl = `${window.location.origin}/t/${ticketCode}`;
  const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  // Upload du QR code vers Supabase Storage
  const qrBlob = await fetch(qr CodeDataUrl).then(r => r.blob());
  const qrFileName = `${user.id}/${ticketCode}_qr.png`;

  const { error: uploadError } = await supabase.storage
    .from('tickets-torp')
    .upload(qrFileName, qrBlob, { contentType: 'image/png' });

  if (uploadError) throw uploadError;

  const { data: { publicUrl: qrPublicUrl } } = supabase.storage
    .from('tickets-torp')
    .getPublicUrl(qrFileName);

  // Mettre à jour l'analyse
  await supabase
    .from('pro_devis_analyses')
    .update({
      ticket_genere: true,
      ticket_code: ticketCode,
      ticket_url: publicUrl,
      ticket_generated_at: new Date().toISOString(),
    })
    .eq('id', analysisId);

  return {
    ticket_url: publicUrl,
    ticket_code: ticketCode,
    qr_code_url: qrPublicUrl,
  };
}
```

### Activer le bouton dans `ProAnalysisDetail.tsx`

Remplacer le bouton disabled par :

```typescript
const [generating, setGenerating] = useState(false);

const handleGenerateTicket = async () => {
  try {
    setGenerating(true);
    const ticket = await generateTicket(analysis.id);

    // Recharger l'analyse pour voir le ticket
    await loadAnalysis();

    // Afficher un toast de succès
    toast({
      title: "Ticket généré !",
      description: `Code : ${ticket.ticket_code}`,
    });
  } catch (err: any) {
    toast({
      variant: "destructive",
      title: "Erreur",
      description: err.message,
    });
  } finally {
    setGenerating(false);
  }
};

// Dans le JSX
<Button
  className="w-full"
  size="lg"
  onClick={handleGenerateTicket}
  disabled={generating || analysis.ticket_genere}
>
  {generating ? (
    <>
      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      Génération en cours...
    </>
  ) : analysis.ticket_genere ? (
    <>
      <CheckCircle2 className="w-5 h-5 mr-2" />
      Ticket déjà généré
    </>
  ) : (
    <>
      <QrCode className="w-5 h-5 mr-2" />
      Générer un ticket TORP
    </>
  )}
</Button>
```

### Créer la page publique `/t/:code`

**Fichier** : `src/pages/TicketPublicView.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAnalysisByTicketCode, trackTicketView } from '@/services/api/pro/analysisService';
import type { ProDevisAnalysis } from '@/types/pro';

export default function TicketPublicView() {
  const { code } = useParams<{ code: string }>();
  const [analysis, setAnalysis] = useState<ProDevisAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (code) {
      loadTicket();
    }
  }, [code]);

  const loadTicket = async () => {
    try {
      setLoading(true);
      const data = await getAnalysisByTicketCode(code!);

      if (data) {
        setAnalysis(data);
        // Tracker la vue
        await trackTicketView(code!, 'link_viewed');
      }
    } catch (err) {
      console.error('Erreur chargement ticket:', err);
    } finally {
      setLoading(false);
    }
  };

  // ... Afficher le badge TORP avec score, grade, entreprise
}
```

**Ajouter la route** dans `App.tsx` :

```typescript
import TicketPublicView from "./pages/TicketPublicView";

// Dans les routes
<Route path="/t/:code" element={<TicketPublicView />} />
```

---

## 3️⃣ Re-analyse versionnée

### Activer le bouton dans `ProAnalysisDetail.tsx`

```typescript
const [reanalyzing, setReanalyzing] = useState(false);

const handleReanalyze = async () => {
  // Ouvrir un dialog pour uploader le nouveau fichier
  navigate(`/pro/reanalyze/${analysis.id}`);
};

// Ou avec un file input
<input
  type="file"
  accept=".pdf"
  onChange={async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setReanalyzing(true);
      const newAnalysis = await reanalyzeDevis(analysis.id, file);
      navigate(`/pro/analysis/${newAnalysis.id}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setReanalyzing(false);
    }
  }}
/>
```

---

## 4️⃣ Moteur d'analyse avec vos critères

### Option A : Utiliser le système B2C existant (adapté au B2B)

Le fichier `src/services/ai/prompts/torp-analysis.prompts.ts` contient une méthodologie complète de 1000 points.

**Pour le B2B, adapter les 4 axes TORP** :
- **Transparence** (250 pts) ← Reprendre critères "Complétude" + "Transparence prix"
- **Offre** (250 pts) ← Reprendre critères techniques + valeur ajoutée
- **Robustesse** (250 pts) ← Reprendre critères "Entreprise" + "Conformité"
- **Prix** (250 pts) ← Reprendre critères "Prix" en mode auto-évaluation

### Option B : Créer un service d'analyse avec OpenAI/Claude

**Fichier** : `src/services/ai/analysisService.ts`

```typescript
import OpenAI from 'openai';
import { buildB2BAnalysisPrompt } from './prompts/b2b-analysis.prompts';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Pour Vite
});

export async function analyzeDevisB2B(fileUrl: string): Promise<AnalysisResult> {
  // 1. Extraire le texte du PDF
  const pdfText = await extractPDFText(fileUrl);

  // 2. Appeler OpenAI pour l'analyse
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: buildB2BAnalysisPrompt() },
      { role: 'user', content: pdfText }
    ],
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

### Option C : Version simplifiée (règles métier)

Créer un fichier `src/services/analysis/b2bCriteria.ts` avec vos propres règles :

```typescript
export function analyzeTransparence(devis: DevisData): ScoreResult {
  let score = 0;
  const recommandations: Recommendation[] = [];

  // Vérifier présence SIRET
  if (devis.siret) {
    score += 30;
  } else {
    recommandations.push({
      type: 'transparence',
      message: 'Ajoutez votre numéro SIRET',
      impact: '+30pts',
      priority: 'high',
      difficulty: 'easy'
    });
  }

  // Vérifier détail des postes
  if (devis.postes.length > 5) {
    score += 40;
  } else if (devis.postes.length > 2) {
    score += 20;
    recommandations.push({
      type: 'transparence',
      message: 'Détaillez davantage les postes de votre devis',
      impact: '+20pts',
      priority: 'medium',
      difficulty: 'medium'
    });
  }

  // ... autres critères

  return { score, recommandations };
}
```

---

## 🚀 Ordre d'implémentation recommandé

1. **SIRET réel** (1h) - Simple, impact immédiat
2. **Ticket TORP** (3h) - Fonctionnalité clé du B2B
3. **Re-analyse** (1h) - Complète le cycle d'amélioration
4. **Moteur d'analyse** (variable) - Selon votre approche (IA vs règles)

---

## 📝 Variables d'environnement à ajouter

```env
# API Entreprise (gratuite)
VITE_API_ENTREPRISE_TOKEN=votre_token

# OU Pappers (payante)
VITE_PAPPERS_API_KEY=votre_clé

# Pour l'analyse IA (optionnel)
VITE_OPENAI_API_KEY=sk-...
# OU
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

---

## ✅ Checklist avant mise en production

- [ ] Migration SQL 011 appliquée (email nullable)
- [ ] Token API Entreprise configuré
- [ ] Buckets Supabase Storage créés (company-documents, devis-analyses, tickets-torp)
- [ ] Policies Storage appliquées
- [ ] QR code et génération ticket testés
- [ ] Page publique `/t/:code` testée
- [ ] Re-analyse versionnée testée
- [ ] Moteur d'analyse implémenté ou documenté

---

## 📚 Ressources

- [API Entreprise](https://api.gouv.fr/les-api/api-entreprise)
- [API Pappers](https://www.pappers.fr/api)
- [QRCode.js](https://github.com/soldair/node-qrcode)
- [jsPDF](https://github.com/parallax/jsPDF)
- [Supabase Storage](https://supabase.com/docs/guides/storage)

Bon développement ! 🎉
