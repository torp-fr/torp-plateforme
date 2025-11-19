/**
 * TORP Analysis Prompts
 * Structured prompts for devis analysis using the TORP methodology
 */

export const TORP_SYSTEM_PROMPT = `Tu es un expert en analyse de devis de construction et rénovation en France.
Tu utilises la méthodologie TORP (Transparence, Optimisation, Risque, Performance) pour évaluer les devis.

Tu es spécialisé dans:
- L'analyse de la fiabilité des entreprises (SIRET, certifications, assurances)
- L'évaluation des prix par rapport au marché français
- La détection des surcoûts et optimisations possibles
- L'identification des risques techniques et réglementaires
- La vérification de la conformité (PLU, normes, RT2012/RE2020)
- L'analyse de la cohérence des délais

Tu fournis des analyses objectives, factuelles et chiffrées.`;

/**
 * Prompt pour l'extraction des données structurées du devis
 */
export const buildExtractionPrompt = (devisText: string): string => {
  return `Analyse ce devis de travaux et extrais les informations suivantes au format JSON strict:

DEVIS:
\`\`\`
${devisText}
\`\`\`

Retourne un JSON avec cette structure exacte:
{
  "entreprise": {
    "nom": "string",
    "siret": "string ou null si non trouvé",
    "adresse": "string",
    "telephone": "string ou null",
    "email": "string ou null",
    "certifications": ["array de certifications trouvées (RGE, Qualibat, etc.)"],
    "assurances": {
      "decennale": "boolean",
      "rcPro": "boolean",
      "numeroPolice": "string ou null"
    }
  },
  "devis": {
    "numero": "string ou null",
    "date": "date ISO ou null",
    "validite": "nombre de jours ou null",
    "montantTotal": "number (montant TTC)",
    "montantHT": "number ou null",
    "tva": "number (taux en %) ou null"
  },
  "client": {
    "nom": "string ou null",
    "adresse": "string ou null"
  },
  "travaux": {
    "type": "string (type de travaux global)",
    "description": "string (description générale)",
    "adresseChantier": "string ou null",
    "surface": "number en m² ou null",
    "postes": [
      {
        "designation": "string",
        "quantite": "number ou null",
        "unite": "string (m², m, u, etc.) ou null",
        "prixUnitaire": "number ou null",
        "total": "number"
      }
    ]
  },
  "delais": {
    "debut": "date ISO ou null",
    "fin": "date ISO ou null",
    "duree": "number de jours ou null",
    "precisions": "string ou null (détails sur planning)"
  },
  "paiement": {
    "modalites": "string",
    "acompte": "number (%) ou null",
    "echeancier": ["array de string décrivant les paiements"],
    "penalites": "boolean (mention de pénalités de retard?)"
  },
  "garanties": {
    "decennale": "boolean",
    "biennale": "boolean",
    "parfaitAchèvement": "boolean",
    "autres": ["array de garanties mentionnées"]
  },
  "mentions": {
    "reglementationThermique": "string ou null (RT2012, RE2020, etc.)",
    "normesRespectees": ["array de normes citées"],
    "conformitePLU": "boolean ou null"
  }
}

IMPORTANT:
- Extrais TOUTES les informations disponibles
- Si une information n'est pas trouvée, utilise null
- Les montants doivent être en nombres (pas de string)
- Sois précis sur les certifications et assurances
- Retourne UNIQUEMENT le JSON, sans commentaires`;
};

/**
 * Prompt pour l'analyse de l'entreprise (250 points)
 */
export const buildEntrepriseAnalysisPrompt = (devisData: string): string => {
  return `Analyse la fiabilité de l'entreprise du devis suivant et attribue un score sur 250 points.

DONNÉES DU DEVIS:
\`\`\`json
${devisData}
\`\`\`

Critères d'évaluation (250 points total):
1. **Fiabilité globale** (60 pts):
   - SIRET valide et trouvable: 30 pts
   - Entreprise active depuis >5 ans: 15 pts
   - Adresse professionnelle complète: 15 pts

2. **Santé financière** (50 pts):
   - Chiffre d'affaires estimé (si disponible)
   - Absence de liquidation/redressement

3. **Assurances** (60 pts):
   - Décennale valide mentionnée: 30 pts
   - RC Pro mentionnée: 20 pts
   - Numéro de police fourni: 10 pts

4. **Certifications** (50 pts):
   - RGE: 25 pts
   - Qualibat/Qualifelec: 15 pts
   - Autres certifications: 10 pts

5. **Réputation** (30 pts):
   - Basé sur les éléments du devis (références, ancienneté, etc.)

Retourne un JSON:
{
  "scoreTotal": number (sur 250),
  "details": {
    "fiabilite": {
      "score": number,
      "commentaire": "string"
    },
    "santeFinnaciere": {
      "score": number,
      "commentaire": "string"
    },
    "assurances": {
      "score": number,
      "details": "string"
    },
    "certifications": {
      "score": number,
      "liste": ["array"],
      "commentaire": "string"
    },
    "reputation": {
      "score": number,
      "commentaire": "string"
    }
  },
  "risques": ["array de risques identifiés"],
  "benefices": ["array de points forts"]
}`;
};

/**
 * Prompt pour l'analyse des prix (300 points)
 */
export const buildPrixAnalysisPrompt = (devisData: string, typeTravaux: string, region: string): string => {
  return `Analyse les prix du devis suivant pour des travaux de ${typeTravaux} en ${region}.

DONNÉES DU DEVIS:
\`\`\`json
${devisData}
\`\`\`

Critères d'évaluation (300 points total):

1. **Comparaison au marché** (100 pts):
   - Prix dans la fourchette basse du marché: 100 pts
   - Prix dans la fourchette moyenne: 70 pts
   - Prix dans la fourchette haute: 40 pts
   - Prix au-dessus du marché: 0-30 pts

2. **Transparence** (80 pts):
   - Détail par poste clair: 40 pts
   - Prix unitaires indiqués: 20 pts
   - Quantités précises: 20 pts

3. **Cohérence** (60 pts):
   - Cohérence entre postes: 30 pts
   - Rapport qualité/prix: 30 pts

4. **Optimisations détectées** (60 pts):
   - Points de négociation identifiés
   - Postes potentiellement surévalués

Utilise tes connaissances des prix moyens 2024 en France pour ${typeTravaux}.

Retourne un JSON:
{
  "scoreTotal": number (sur 300),
  "vsMarche": {
    "score": number,
    "prixMoyenMarche": number,
    "ecartPourcentage": number,
    "positionnement": "string (bas/moyen/haut/excessif)"
  },
  "transparence": {
    "score": number,
    "detailsManquants": ["array"]
  },
  "coherence": {
    "score": number,
    "incohérences": ["array"]
  },
  "optimisations": {
    "economiesPotentielles": number (en €),
    "postesNegociables": [
      {
        "poste": "string",
        "prixActuel": number,
        "prixRecommande": number,
        "economie": number
      }
    ]
  },
  "analyse": "string (analyse détaillée)"
}`;
};

/**
 * Prompt pour l'analyse de la complétude technique (200 points)
 */
export const buildCompletudeAnalysisPrompt = (devisData: string, typeTravaux: string): string => {
  return `Analyse la complétude technique du devis pour ${typeTravaux}.

DONNÉES DU DEVIS:
\`\`\`json
${devisData}
\`\`\`

Critères d'évaluation (200 points total):

1. **Éléments essentiels** (100 pts):
   - Description précise des travaux: 30 pts
   - Matériaux spécifiés (marques, références): 30 pts
   - Techniques de mise en œuvre: 20 pts
   - Plans/schémas annexés: 20 pts

2. **Conformité normes** (60 pts):
   - Normes techniques citées: 30 pts
   - Réglementation thermique (RT2012/RE2020): 20 pts
   - Accessibilité PMR si applicable: 10 pts

3. **Risques techniques** (40 pts):
   - Diagnostic technique préalable: 20 pts
   - Prise en compte contraintes site: 20 pts

Retourne un JSON:
{
  "scoreTotal": number (sur 200),
  "elementsPresents": ["array de ce qui est inclus"],
  "elementsManquants": ["array de ce qui manque"],
  "conformiteNormes": {
    "score": number,
    "normesRespectees": ["array"],
    "normesManquantes": ["array"]
  },
  "risquesTechniques": ["array de risques identifiés"],
  "recommandations": ["array de points à clarifier"]
}`;
};

/**
 * Prompt pour l'analyse de la conformité réglementaire (150 points)
 */
export const buildConformiteAnalysisPrompt = (devisData: string, typeProjet: string): string => {
  return `Analyse la conformité réglementaire du devis pour ${typeProjet}.

DONNÉES DU DEVIS:
\`\`\`json
${devisData}
\`\`\`

Critères d'évaluation (150 points total):

1. **Assurances obligatoires** (50 pts):
   - Décennale mentionnée: 30 pts
   - RC Pro mentionnée: 20 pts

2. **Conformité urbanisme** (40 pts):
   - Respect PLU mentionné: 20 pts
   - Permis/déclaration si nécessaire: 20 pts

3. **Normes construction** (40 pts):
   - RT2012/RE2020 pour neuf/extension: 20 pts
   - DTU applicables: 20 pts

4. **Accessibilité & sécurité** (20 pts):
   - Normes PMR si applicable: 10 pts
   - Sécurité chantier: 10 pts

Retourne un JSON:
{
  "scoreTotal": number (sur 150),
  "assurances": {
    "score": number,
    "decennale": boolean,
    "rcPro": boolean,
    "conforme": boolean
  },
  "plu": {
    "score": number,
    "mentionné": boolean,
    "conforme": boolean or null
  },
  "normes": {
    "score": number,
    "respectees": ["array"],
    "manquantes": ["array"]
  },
  "accessibilite": {
    "score": number,
    "conforme": boolean or null
  },
  "defauts": ["array de non-conformités détectées"],
  "recommandations": ["array d'actions correctives"]
}`;
};

/**
 * Prompt pour l'analyse des délais (100 points)
 */
export const buildDelaisAnalysisPrompt = (devisData: string, typeTravaux: string): string => {
  return `Analyse les délais proposés dans le devis pour ${typeTravaux}.

DONNÉES DU DEVIS:
\`\`\`json
${devisData}
\`\`\`

Critères d'évaluation (100 points total):

1. **Réalisme des délais** (50 pts):
   - Délais cohérents avec le type de travaux: 30 pts
   - Prise en compte des contraintes (météo, fournitures, etc.): 20 pts

2. **Comparaison au marché** (30 pts):
   - Délais dans la moyenne du secteur: 30 pts
   - Délais plus courts: bonus ou suspect?
   - Délais plus longs: pénalisant

3. **Planning détaillé** (10 pts):
   - Phasage des travaux: 5 pts
   - Dates précises: 5 pts

4. **Pénalités de retard** (10 pts):
   - Clause de pénalités mentionnée: 10 pts

Utilise tes connaissances des durées moyennes de chantier en France.

Retourne un JSON:
{
  "scoreTotal": number (sur 100),
  "realisme": {
    "score": number,
    "dureeProposee": number (jours),
    "dureeMoyenneMarche": number (jours),
    "ecart": number (jours),
    "appreciation": "string (réaliste/optimiste/pessimiste)"
  },
  "planning": {
    "score": number,
    "detaille": boolean,
    "phases": ["array de phases si présentes"]
  },
  "penalites": {
    "score": number,
    "mentionnees": boolean,
    "details": "string ou null"
  },
  "risquesDelais": ["array de risques de retard identifiés"],
  "recommandations": ["array"]
}`;
};

/**
 * Prompt pour la synthèse et les recommandations finales
 */
export const buildSynthesisPrompt = (
  scoreEntreprise: number,
  scorePrix: number,
  scoreCompletude: number,
  scoreConformite: number,
  scoreDelais: number,
  allAnalyses: string
): string => {
  const scoreTotal = scoreEntreprise + scorePrix + scoreCompletude + scoreConformite + scoreDelais;

  return `Génère une synthèse et des recommandations basées sur l'analyse TORP complète.

SCORES OBTENUS:
- Entreprise: ${scoreEntreprise}/250
- Prix: ${scorePrix}/300
- Complétude: ${scoreCompletude}/200
- Conformité: ${scoreConformite}/150
- Délais: ${scoreDelais}/100
- **TOTAL: ${scoreTotal}/1000**

ANALYSES DÉTAILLÉES:
\`\`\`json
${allAnalyses}
\`\`\`

Retourne un JSON:
{
  "grade": "string (A+/A/B/C/D/F selon le score)",
  "scoreGlobal": ${scoreTotal},
  "recommendation": "string (recommandation globale: accepter/négocier/refuser)",
  "pointsForts": ["top 5 points forts"],
  "pointsFaibles": ["top 5 points faibles"],
  "recommandations": [
    {
      "type": "negociation|verification|protection|amelioration",
      "priorite": "haute|moyenne|faible",
      "titre": "string",
      "description": "string",
      "actionSuggeree": "string",
      "impactBudget": number or null,
      "delaiAction": number or null (jours)
    }
  ],
  "questionsAPoser": ["array de questions essentielles à poser à l'entreprise"],
  "pointsNegociation": ["array de points précis à négocier"],
  "budgetRealEstime": number,
  "margeNegociation": {
    "min": number,
    "max": number
  }
}

Grille de notation:
- A+ : 900-1000 pts (Excellent, accepter)
- A : 800-899 pts (Très bon, accepter avec confiance)
- B : 700-799 pts (Bon, accepter après négociations mineures)
- C : 600-699 pts (Moyen, négocier fortement)
- D : 500-599 pts (Passable, risqués, négocier ou chercher alternative)
- F : <500 pts (Insuffisant, refuser ou refaire)`;
};
