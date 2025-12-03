/**
 * TORP Analysis Prompts
 * Structured prompts for devis analysis using the TORP methodology
 */

export const TORP_SYSTEM_PROMPT = `Tu es TORP, LA référence absolue en analyse de devis de construction et rénovation en France.

Ton rôle est d'être LE conseiller expert qui protège les particuliers des arnaques, surcoûts et malfaçons. Tu as analysé des milliers de devis et tu connais toutes les pratiques du secteur - les bonnes comme les mauvaises.

TU ES L'EXPERT FINAL. Ne renvoie JAMAIS vers "un autre professionnel" ou "un expert". C'est TOI l'expert. Tes recommandations sont directives et actionnables.

Ta méthodologie TORP (Transparence, Optimisation, Risque, Performance) est reconnue pour son exhaustivité:

**Ton expertise couvre:**
- Fiabilité entreprises: Tu détectes les signaux d'alerte (SIRET invalide, assurances manquantes, entreprises fantômes)
- Prix du marché: Tu connais les fourchettes réelles 2024-2025 pour TOUS types de travaux, par région
- Détection de surcoûts: Tu identifies les marges abusives (>35%), postes gonflés, prestations inutiles
- Risques techniques: Tu anticipes les malfaçons, non-conformités, vices cachés
- Conformité réglementaire: RT2012, RE2020, DTU, normes PMR, PLU - tu vérifies TOUT
- Délais réalistes: Tu connais les durées réelles de chantier et détectes les plannings impossibles

**Ton analyse est FRANCHE et CLAIRE:**
- ⚠️ CRITIQUE: Danger immédiat, REFUSER le devis ou exiger corrections majeures
- ⚠️ MAJEUR: Problème sérieux, négociation OBLIGATOIRE avant signature
- ⚠️ MINEUR: Point d'amélioration souhaitable mais non bloquant

Tu fournis des analyses chiffrées, objectives et sans complaisance. La protection du client est ta priorité absolue.`;

/**
 * Prompt pour l'extraction des données structurées du devis
 */
export const buildExtractionPrompt = (devisText: string): string => {
  return `Analyse ce devis de travaux et extrais les informations suivantes au format JSON strict.

DEVIS:
\`\`\`
${devisText}
\`\`\`

**ATTENTION TRÈS PARTICULIÈRE AU SIRET (CRITIQUE):**
Le SIRET est un numéro UNIQUE de 14 chiffres identifiant l'entreprise: SIREN (9 chiffres) + NIC (5 chiffres).

**OÙ LE CHERCHER:**
- En-tête du devis (partie supérieure gauche, sous/près du logo)
- Bloc coordonnées entreprise (avec adresse, téléphone, email)
- Parfois en pied de page ou mentions légales
- Près de mentions comme: N° TVA, RCS, APE/NAF

**FORMATS POSSIBLES (tous correspondent à 14 chiffres):**
- Complet sans espace: "49294200010016"
- Avec espaces par groupes: "492 942 000 100 16" ou "492 942 000 10016"
- Format SIREN + NIC: "492942000 10016" ou "SIREN 492942000 NIC 10016"
- Avec tirets/points: "492.942.000.10016" ou "492-942-000-10016"
- Sur plusieurs lignes: le SIREN peut être sur une ligne, le NIC sur la suivante

**RÈGLES D'EXTRACTION:**
1. Cherche d'abord la mention explicite "SIRET" puis lis les 14 chiffres qui suivent
2. Si tu vois un numéro à 9 chiffres (SIREN), cherche les 5 chiffres du NIC à proximité
3. Le NIC (5 chiffres) commence souvent par 000 pour le siège (ex: 00010, 00015, 00025)
4. Extrais TOUS les 14 chiffres, sans espace ni ponctuation
5. **NE RETOURNE JAMAIS un numéro de 10, 11, 12 ou 13 chiffres - c'est incomplet!**

**EXEMPLE:** "SIRET: 492 942 000 100 16" → extrais "49294200010016"

Retourne un JSON avec cette structure exacte:
{
  "entreprise": {
    "nom": "string",
    "siret": "string de 14 chiffres ou null si vraiment non trouvé",
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
  return `ANALYSE APPROFONDIE DE LA FIABILITÉ ENTREPRISE - Tu es l'expert qui protège le client.

DONNÉES DU DEVIS:
\`\`\`json
${devisData}
\`\`\`

**CRITÈRES D'ÉVALUATION DÉTAILLÉS (250 points):**

**1. FIABILITÉ GLOBALE (60 pts) - CRITÈRES ESSENTIELS:**
   - SIRET présent et valide (14 chiffres): 30 pts
     * ⚠️ CRITIQUE si absent: entreprise potentiellement illégale
     * Vérifie la cohérence: SIRET doit correspondre à l'adresse

   - Ancienneté de l'entreprise: 15 pts
     * <1 an: 0 pts - ⚠️ MAJEUR risque de défaillance (30% échouent en 1ère année)
     * 1-3 ans: 5 pts - Encore fragile
     * 3-5 ans: 10 pts - Stabilité correcte
     * >5 ans: 15 pts - Solidité avérée

   - Adresse professionnelle: 15 pts
     * Complète (rue, CP, ville): 15 pts
     * ⚠️ MAJEUR si adresse type "domicile particulier" ou boîte postale
     * ⚠️ CRITIQUE si adresse absente: probable arnaque

**2. SANTÉ FINANCIÈRE (50 pts) - INDICATEURS DE SOLIDITÉ:**
   - Capital social:
     * >50K€: 15 pts - Solidité financière
     * 10-50K€: 10 pts - Correct
     * <10K€: 5 pts - ⚠️ MINEUR faible assise financière
     * 1€: 0 pts - ⚠️ MAJEUR risque de défaillance

   - Chiffre d'affaires annuel (si disponible):
     * >500K€: 20 pts - Entreprise solide
     * 100-500K€: 15 pts - Taille correcte
     * <100K€: 10 pts - Petite structure, surveiller

   - Résultat net positif: 15 pts
     * ⚠️ MAJEUR si pertes répétées: risque liquidation

**3. ASSURANCES OBLIGATOIRES (60 pts) - NON NÉGOCIABLE:**
   - Assurance Décennale: 30 pts
     * ⚠️ CRITIQUE si absente: ILLÉGAL et risque financier majeur pour le client
     * Exiger attestation datée de moins de 3 mois
     * Vérifier couverture du type de travaux concerné

   - RC Professionnelle: 20 pts
     * ⚠️ MAJEUR si absente: pas de recours en cas de dommages

   - Numéro de police fourni: 10 pts
     * ⚠️ MAJEUR si refusé: entreprise probablement non assurée

**4. CERTIFICATIONS PROFESSIONNELLES (50 pts):**
   - RGE (Reconnu Garant Environnement): 25 pts
     * OBLIGATOIRE pour travaux éligibles aides (MaPrimeRénov, CEE)
     * ⚠️ CRITIQUE si absent sur travaux isolation/chauffage: client perd les aides

   - Qualibat/Qualifelec: 15 pts
     * Gage de compétence technique
     * Vérifie que la qualification correspond aux travaux (ex: Qualibat 8621 pour ravalement)

   - Autres (Handibat, Eco-Artisan, etc.): 10 pts

**5. ÉLÉMENTS DE RÉPUTATION (30 pts):**
   - Références chantiers: 10 pts
   - Appartenance réseau professionnel (FFB, CAPEB): 10 pts
   - Labellisation qualité: 10 pts

**SIGNAUX D'ALERTE À DÉTECTER (⚠️ CRITIQUE):**
- Absence de SIRET ou SIRET invalide
- Aucune mention d'assurance décennale
- Coordonnées incomplètes ou suspectes (pas de tel fixe, email générique)
- Devis sans cachet/signature de l'entreprise
- Entreprise très récente (<6 mois) avec gros chantier
- Pression commerciale excessive ("offre valable 48h seulement")
- Demande d'acompte >30% (légal max: 30%)

Retourne un JSON avec ton analyse FRANCHE et DIRECTIVE:
{
  "scoreTotal": number (sur 250),
  "details": {
    "fiabilite": {
      "score": number,
      "commentaire": "Analyse détaillée avec niveau de gravité (CRITIQUE/MAJEUR/MINEUR)",
      "siretValide": boolean,
      "anciennete": "string (ex: '8 ans - solidité avérée')",
      "signauxAlerte": ["array des problèmes détectés avec leur gravité"]
    },
    "santeFinnaciere": {
      "score": number,
      "commentaire": "Évaluation détaillée de la solidité financière",
      "capitalSocial": number or null,
      "chiffreAffaires": number or null,
      "analyse": "string (ton expert sur la santé financière)"
    },
    "assurances": {
      "score": number,
      "details": "Analyse PRÉCISE des assurances - avec niveau de risque",
      "decennale": boolean,
      "rcPro": boolean,
      "numeroPolice": boolean,
      "conformiteLegale": boolean,
      "recommandationAction": "string (action concrète à faire)"
    },
    "certifications": {
      "score": number,
      "liste": ["array des certifications trouvées"],
      "commentaire": "Analyse de la pertinence des certifications pour ce projet",
      "certifManquantes": ["certifications attendues mais absentes"]
    },
    "reputation": {
      "score": number,
      "commentaire": "Analyse des éléments de confiance"
    }
  },
  "risques": [
    {
      "niveau": "CRITIQUE|MAJEUR|MINEUR",
      "categorie": "string",
      "description": "string (explication claire)",
      "consequence": "string (ce qui peut arriver)",
      "actionRequise": "string (ce que le client DOIT faire)"
    }
  ],
  "benefices": ["Points forts concrets de cette entreprise"]
}`;
};

/**
 * Prompt pour l'analyse des prix (300 points)
 */
export const buildPrixAnalysisPrompt = (devisData: string, typeTravaux: string, region: string): string => {
  return `ANALYSE EXPERTE DES PRIX - Tu connais le marché 2024-2025 sur le bout des doigts.

DONNÉES DU DEVIS:
\`\`\`json
${devisData}
\`\`\`

TYPE: ${typeTravaux} | RÉGION: ${region}

**FOURCHETTES DE PRIX MARCHÉ 2024-2025 (RÉFÉRENCES):**

**ISOLATION:**
- Isolation combles perdus: 20-40€/m²
- Isolation rampants: 40-80€/m²
- Isolation murs extérieur (ITE): 120-180€/m²
- Isolation murs intérieur: 40-70€/m²
  * ⚠️ CRITIQUE si >200€/m² ITE ou >90€/m² ITI: arnaque probable

**CHAUFFAGE:**
- Pompe à chaleur air/eau: 10 000-16 000€ (hors aides)
- Chaudière gaz condensation: 3 000-6 000€
- Poêle à granulés: 4 000-8 000€
- Radiateurs électriques: 300-800€/unité
  * ⚠️ CRITIQUE si PAC >20 000€ ou chaudière >8 000€

**MENUISERIES:**
- Fenêtre PVC double vitrage: 400-800€/fenêtre posée
- Fenêtre ALU: 600-1 200€/fenêtre
- Porte d'entrée: 1 500-3 500€
  * ⚠️ MAJEUR si >1 200€/fenêtre PVC: marge excessive

**RÉNOVATION:**
- Peinture intérieure: 20-40€/m²
- Carrelage sol: 40-80€/m² (fourniture + pose)
- Parquet flottant: 35-60€/m²
- Salle de bain complète: 8 000-15 000€
  * ⚠️ MAJEUR si peinture >50€/m² ou carrelage >100€/m²

**ÉLECTRICITÉ/PLOMBERIE:**
- Réfection électrique complète: 80-120€/m²
- Installation VMC: 1 500-3 500€
- Plomberie salle de bain: 2 000-5 000€
  * ⚠️ CRITIQUE si élec >150€/m²: gonflage abusif

**GROS ŒUVRE:**
- Extension bois: 1 200-1 800€/m²
- Extension maçonnerie: 1 500-2 500€/m²
- Surélévation: 1 800-2 800€/m²
- Ravalement façade: 40-100€/m²

**MARGES NORMALES VS ABUSIVES:**
- Marge artisan normale: 15-25%
- Marge acceptable: 25-30%
- ⚠️ MAJEUR: 30-40% (négociation OBLIGATOIRE)
- ⚠️ CRITIQUE: >40% (refuser ou renégocier totalement)

**CRITÈRES D'ÉVALUATION (300 points):**

**1. COMPARAISON MARCHÉ (100 pts):**
   - Prix fourchette basse (-10% du marché): 100 pts
   - Prix fourchette moyenne (±10%): 80 pts
   - Prix fourchette haute (+10 à +25%): 50 pts
   - ⚠️ MAJEUR (+25 à +40%): 20 pts - Négociation OBLIGATOIRE
   - ⚠️ CRITIQUE (>+40%): 0 pts - Arnaque potentielle, REFUSER

**2. TRANSPARENCE DU DEVIS (80 pts):**
   - Détail par poste (pas de forfait global): 40 pts
     * ⚠️ MAJEUR si forfait global: cache probablement marges excessives
   - Prix unitaires indiqués: 20 pts
   - Quantités précises mesurables: 20 pts
     * ⚠️ MINEUR si quantités floues: risque dérive en cours de chantier

**3. COHÉRENCE INTERNE (60 pts):**
   - Cohérence entre postes (pas de disproportion): 30 pts
     * Ex: MOI main d'œuvre = 40-60% du total (selon travaux)
     * ⚠️ MAJEUR si MO >70%: gonflage abusif
   - Rapport fourniture/pose réaliste: 30 pts
     * ⚠️ CRITIQUE si pose = 3x prix fourniture: arnaque

**4. OPTIMISATIONS & NÉGOCIATION (60 pts):**
Identifie PRÉCISÉMENT les postes négociables avec chiffres exacts:
   - Postes surévalués (comparaison marché)
   - Prestations inutiles ou en doublon
   - Matériaux surspécifiés (qualité excessive pour l'usage)
   - Quantités surestimées

**SIGNAUX D'ALERTE PRIX:**
- Acompte >30% demandé (illégal)
- "Prix valable 48h seulement" (pression commerciale)
- Refus de détailler les postes
- Majorations floues ("imprévus", "difficultés")
- Prix TTC sans détail HT/TVA
- Pas de mention TVA (devrait être 20% général, 10% ou 5.5% si éligible)

Retourne un JSON avec analyse CHIFFRÉE et DIRECTIVE:
{
  "scoreTotal": number (sur 300),
  "vsMarche": {
    "score": number,
    "prixDevis": number,
    "prixMoyenMarche": number,
    "prixBasMarche": number,
    "prixHautMarche": number,
    "ecartPourcentage": number,
    "positionnement": "string (excellent/correct/élevé/excessif/arnaque)",
    "gravite": "OK|MINEUR|MAJEUR|CRITIQUE",
    "analyse": "Explication FRANCHE et CHIFFRÉE du positionnement"
  },
  "transparence": {
    "score": number,
    "niveauDetail": "excellent|correct|insuffisant|opaque",
    "detailsManquants": ["liste précise"],
    "problemes": [
      {
        "type": "string",
        "gravite": "CRITIQUE|MAJEUR|MINEUR",
        "description": "string",
        "consequence": "string"
      }
    ]
  },
  "coherence": {
    "score": number,
    "ratioMainOeuvre": number (en %),
    "ratioFourniture": number (en %),
    "margeEstimee": number (en %),
    "incohérences": [
      {
        "poste": "string",
        "probleme": "string",
        "gravite": "CRITIQUE|MAJEUR|MINEUR"
      }
    ],
    "analyse": "Jugement expert sur la cohérence globale"
  },
  "optimisations": {
    "economiesPotentielles": number (TOTAL en €),
    "pourcentageNegociation": number,
    "postesNegociables": [
      {
        "poste": "string",
        "prixActuel": number,
        "prixMarche": number,
        "prixRecommande": number,
        "economie": number,
        "argumentaire": "string (argument précis pour négocier)",
        "priorite": "haute|moyenne|faible"
      }
    ],
    "prestationsInutiles": [
      {
        "designation": "string",
        "montant": number,
        "raison": "Pourquoi c'est inutile"
      }
    ]
  },
  "verdict": {
    "recommandation": "accepter|négocier|refuser",
    "prixJuste": number (estimation du prix réel de marché),
    "budgetRealiste": {
      "min": number,
      "max": number
    },
    "phraseCle": "string (verdict en 1 phrase claire et ferme)"
  }
}`;
};

/**
 * Prompt pour l'analyse de la complétude technique (200 points)
 */
export const buildCompletudeAnalysisPrompt = (devisData: string, typeTravaux: string): string => {
  return `ANALYSE TECHNIQUE APPROFONDIE - Vérifie que RIEN n'est laissé au hasard.

DONNÉES DU DEVIS:
\`\`\`json
${devisData}
\`\`\`

TYPE DE TRAVAUX: ${typeTravaux}

**ÉLÉMENTS TECHNIQUES OBLIGATOIRES PAR TYPE:**

**ISOLATION:**
- Épaisseur isolant (ex: 300mm laine de verre R=7 en combles)
- Coefficient R (résistance thermique) - OBLIGATOIRE pour aides
- Type isolant (laine de verre/roche, polyuréthane, etc.)
- Pare-vapeur/freine-vapeur spécifié
- Traitement ponts thermiques
- Ventilation associée (VMC)
- ⚠️ CRITIQUE si R non spécifié: devis non conforme aides

**MENUISERIES:**
- Coefficient Uw (isolation thermique) - OBLIGATOIRE
- Type vitrage (double/triple, gaz argon)
- Matériau châssis (PVC, alu, bois) avec épaisseur
- Pose en tunnel/applique/rénovation
- Étanchéité à l'air (joints, mousse)
- ⚠️ CRITIQUE si Uw >1.3: non éligible aides rénovation

**CHAUFFAGE:**
- Puissance en kW adaptée à la surface
- COP (pompe à chaleur) ou rendement (chaudière)
- Dimensionnement émetteurs (radiateurs/plancher)
- Régulation/programmation
- Production ECS si applicable
- ⚠️ MAJEUR si dimensionnement flou: risque sous/sur-puissance

**ÉLECTRICITÉ:**
- Conformité NF C 15-100 (OBLIGATOIRE)
- Nombre de circuits/disjoncteurs
- Section câbles (2.5mm² prises, 1.5mm² éclairage)
- Protection différentielle 30mA
- Mise à la terre
- ⚠️ CRITIQUE si non conforme NF C 15-100: danger + non assurable

**PLOMBERIE:**
- Diamètre canalisations (PER, cuivre, multicouche)
- Pente évacuation (1-3%)
- Traitement anti-corrosion si nécessaire
- Isolation tuyaux eau chaude
- Réducteur pression si >3 bars

**GROS ŒUVRE:**
- Type fondations (semelles, radier, pieux)
- Profondeur hors gel (60-80cm selon région)
- Ferraillage béton (ex: ST25C pour dalle)
- Drainage/étanchéité sous-sol
- Chaînages/linteaux
- ⚠️ CRITIQUE si fondations non détaillées: vice caché possible

**CRITÈRES D'ÉVALUATION (200 points):**

**1. DESCRIPTION TECHNIQUE (100 pts):**
   - Descriptif précis des travaux (pas de "selon DTU"): 30 pts
     * ⚠️ MAJEUR si vague: l'entreprise pourra rogner sur qualité

   - Matériaux spécifiés (marques, références, normes): 30 pts
     * Ex: "Laine de verre ISOVER IBR 300mm R=7" ✅
     * Ex: "Isolation combles" ❌ ⚠️ MAJEUR

   - Techniques de mise en œuvre détaillées: 20 pts
     * Préparation support, fixations, finitions

   - Plans/schémas/photos annexés: 20 pts
     * ⚠️ MINEUR si absents mais travaux simples
     * ⚠️ MAJEUR si absents sur travaux complexes (extension, etc.)

**2. CONFORMITÉ NORMES (60 pts):**
   - Normes techniques citées (DTU, NF, etc.): 30 pts
     * DTU applicables mentionnés et respectés
     * ⚠️ MAJEUR si aucune norme citée

   - Réglementation thermique RT2012/RE2020: 20 pts
     * OBLIGATOIRE pour neuf/extension >150m² ou >30% surface
     * ⚠️ CRITIQUE si oubliée: non-conformité = revente impossible

   - Accessibilité PMR si applicable: 10 pts
     * OBLIGATOIRE en neuf et certaines rénovations

**3. ÉVALUATION RISQUES TECHNIQUES (40 pts):**
   - Diagnostic préalable mentionné: 20 pts
     * Amiante, plomb, termites selon âge bâtiment
     * État des lieux existant (murs, charpente, etc.)
     * ⚠️ MAJEUR si absent: surprises en cours de chantier

   - Contraintes site prises en compte: 20 pts
     * Accès, mitoyenneté, réseaux, sol
     * ⚠️ MINEUR si non mentionné mais risque réel

**POINTS DE VIGILANCE PAR TYPE:**

**Isolation/Chauffage:**
- Étude thermique pour optimisation
- Attestation RT2012/RE2020 prévue
- Certificats RGE pour aides

**Extension/Gros œuvre:**
- Étude de sol G2 (OBLIGATOIRE depuis 2020)
- Calcul structure béton armé
- Déclaration préalable/Permis de construire

**Rénovation ancienne:**
- Diagnostic humidité/remontées capillaires
- État charpente/couverture
- Compatibilité matériaux anciens/modernes

Retourne un JSON avec analyse TECHNIQUE et DÉTAILLÉE:
{
  "scoreTotal": number (sur 200),
  "elementsPresents": [
    {
      "categorie": "string",
      "elements": ["array des specs présentes"],
      "qualiteDetail": "excellent|correct|insuffisant"
    }
  ],
  "elementsManquants": [
    {
      "element": "string (précis)",
      "gravite": "CRITIQUE|MAJEUR|MINEUR",
      "consequence": "string (risque concret)",
      "actionRequise": "string (ce qu'il faut exiger)"
    }
  ],
  "conformiteNormes": {
    "score": number,
    "normesRespectees": ["liste des normes citées"],
    "normesManquantes": ["normes obligatoires absentes"],
    "conformiteLegale": boolean,
    "analyse": "Évaluation experte de la conformité"
  },
  "risquesTechniques": [
    {
      "risque": "string (risque identifié)",
      "gravite": "CRITIQUE|MAJEUR|MINEUR",
      "probabilite": "haute|moyenne|faible",
      "impact": "string (conséquence si réalisé)",
      "prevention": "string (comment l'éviter)"
    }
  ],
  "recommandations": [
    {
      "type": "clarification|ajout|verification",
      "priorite": "haute|moyenne|faible",
      "titre": "string",
      "description": "string (détaillée)",
      "questionAPoser": "string (question exacte à poser à l'entreprise)"
    }
  ],
  "verdict": "string (synthèse en 2-3 phrases: devis complet ou lacunaire?)"
}`;
};

/**
 * Prompt pour l'analyse de la conformité réglementaire (150 points)
 */
export const buildConformiteAnalysisPrompt = (devisData: string, typeProjet: string): string => {
  return `ANALYSE CONFORMITÉ RÉGLEMENTAIRE - La loi n'est PAS négociable.

DONNÉES DU DEVIS:
\`\`\`json
${devisData}
\`\`\`

TYPE PROJET: ${typeProjet}

**RÉGLEMENTATION OBLIGATOIRE (NON-RESPECT = SANCTIONS):**

**1. ASSURANCES PROFESSIONNELLES (OBLIGATOIRES):**

**Assurance Décennale:**
- OBLIGATOIRE pour tous travaux de construction/gros œuvre
- Couvre vices compromettant solidité ou habitabilité pendant 10 ans
- ⚠️ CRITIQUE si absente:
  * Client sans recours si malfaçon grave
  * Amende 75 000€ + 6 mois prison pour l'entreprise
  * Travaux NON assurables pour revente
- EXIGER: Attestation datée <3 mois avec garanties précises

**RC Professionnelle:**
- Couvre dommages causés pendant et après travaux
- ⚠️ MAJEUR si absente: aucun recours en cas de sinistre

**2. URBANISME (SANCTIONS PÉNALES SI NON RESPECT):**

**Déclaration préalable (DP) OBLIGATOIRE si:**
- Modification aspect extérieur (fenêtres, couleurs, etc.)
- Extension 5-20m² (ou 5-40m² en zone PLU)
- Changement destination (garage → habitation)
- ⚠️ CRITIQUE si oubliée: démolition possible + amende 6 000€/m²

**Permis de construire OBLIGATOIRE si:**
- Construction neuve
- Extension >20m² (ou >40m² en zone PLU)
- Modification structure porteuse
- ⚠️ CRITIQUE: 6 mois prison + 300 000€ amende + démolition

**PLU (Plan Local Urbanisme):**
- Règles spécifiques par commune (hauteur, aspect, etc.)
- ⚠️ MAJEUR si non vérifié: risque refus permis/DP

**3. NORMES CONSTRUCTION:**

**RT2012/RE2020 (Réglementation Thermique/Environnementale):**
OBLIGATOIRE pour:
- Toute construction neuve
- Extension >150m² ou >30% surface existante
- Exige: Étude thermique + attestations (début + fin chantier)
- ⚠️ CRITIQUE si oubliée:
  * Bien NON conforme = invendable
  * Amende 45 000€ + prison
  * Refus certificat conformité

**DTU (Documents Techniques Unifiés):**
- Règles de l'art professionnelles
- Référence en cas de litige
- ⚠️ MAJEUR si non respectés: garantie décennale peut refuser couverture

**NF C 15-100 (Électricité):**
- OBLIGATOIRE pour toute installation électrique
- Exige: Attestation Consuel pour mise sous tension
- ⚠️ CRITIQUE: Danger + assurance habitation peut refuser sinistre

**4. ACCESSIBILITÉ PMR:**
OBLIGATOIRE pour:
- Logements neufs collectifs
- Maisons individuelles si vente sur plan
- ERP (Établissement Recevant du Public)
- ⚠️ CRITIQUE: Non-conformité = invendable + sanctions

**5. DÉCHETS DE CHANTIER:**
- Obligation recyclage (Loi AGEC 2020)
- Bordereau suivi déchets obligatoire
- ⚠️ MINEUR mais tendance contrôles renforcés

**CRITÈRES D'ÉVALUATION (150 points):**

**1. ASSURANCES (50 pts) - NON NÉGOCIABLE:**
   - Décennale valide mentionnée: 30 pts
     * ⚠️ CRITIQUE si absente: STOPPER le projet
   - RC Pro mentionnée: 20 pts
     * ⚠️ MAJEUR si absente

**2. URBANISME (40 pts):**
   - Mention permis/DP si nécessaire: 20 pts
     * ⚠️ CRITIQUE si oublié: projet illégal
   - Respect PLU vérifié: 20 pts
     * ⚠️ MAJEUR si non mentionné

**3. NORMES CONSTRUCTION (40 pts):**
   - RT2012/RE2020 si applicable: 20 pts
     * ⚠️ CRITIQUE si oubliée
   - DTU applicables cités: 20 pts
     * ⚠️ MAJEUR si aucun DTU

**4. ACCESSIBILITÉ & SÉCURITÉ (20 pts):**
   - PMR si obligatoire: 10 pts
   - Sécurité chantier/voisinage: 10 pts

**PIÈGES FRÉQUENTS À DÉTECTER:**
- "Travaux déclaratifs non nécessaires" (FAUX: c'est l'entreprise qui esquive)
- "DTU non applicable" (FAUX: DTU = règles de l'art)
- "Assurance du client suffit" (FAUX: décennale entrepreneur OBLIGATOIRE)
- Absence mention PPSPS (plan sécurité) sur gros chantier

Retourne un JSON avec analyse JURIDIQUE stricte:
{
  "scoreTotal": number (sur 150),
  "assurances": {
    "score": number,
    "decennale": {
      "presente": boolean,
      "details": "string (numéro police, couverture)",
      "conforme": boolean,
      "gravite": "OK|CRITIQUE"
    },
    "rcPro": {
      "presente": boolean,
      "conforme": boolean,
      "gravite": "OK|MAJEUR"
    },
    "analyse": "Évaluation experte des assurances",
    "actionRequise": "string (ce que le client DOIT exiger)"
  },
  "urbanisme": {
    "score": number,
    "autorisationNecessaire": "aucune|DP|permis",
    "mentionnee": boolean,
    "pluVerifie": boolean,
    "conformite": {
      "conforme": boolean,
      "gravite": "OK|MAJEUR|CRITIQUE",
      "risque": "string (risque juridique si non conforme)"
    },
    "demarches": ["Liste des démarches obligatoires"]
  },
  "normes": {
    "score": number,
    "rt2012re2020": {
      "applicable": boolean,
      "mentionnee": boolean,
      "gravite": "OK|CRITIQUE"
    },
    "dtu": {
      "cites": ["liste des DTU mentionnés"],
      "manquants": ["DTU applicables non cités"],
      "conforme": boolean
    },
    "nfC15100": {
      "applicable": boolean,
      "mentionnee": boolean,
      "gravite": "OK|CRITIQUE"
    },
    "analyse": "Évaluation conformité normes"
  },
  "accessibilite": {
    "score": number,
    "obligatoire": boolean,
    "conforme": boolean or null,
    "gravite": "OK|CRITIQUE"
  },
  "defauts": [
    {
      "type": "string (assurance|urbanisme|normes)",
      "gravite": "CRITIQUE|MAJEUR|MINEUR",
      "description": "string (défaut précis)",
      "consequence": "string (sanction/risque juridique)",
      "obligationLegale": "string (texte de loi si applicable)"
    }
  ],
  "recommandations": [
    {
      "priorite": "haute|moyenne|faible",
      "action": "string (action précise à faire)",
      "delai": "string (avant signature|avant travaux|pendant)",
      "consequence": "string (ce qui se passe si non fait)"
    }
  ],
  "verdict": {
    "conformiteLegale": "conforme|nonConforme|incomplet",
    "risqueJuridique": "aucun|faible|moyen|eleve|critique",
    "blocage": boolean (true si problème CRITIQUE bloquant),
    "synthese": "string (verdict ferme sur conformité légale)"
  }
}`;
};

/**
 * Prompt pour l'analyse des délais (100 points)
 */
export const buildDelaisAnalysisPrompt = (devisData: string, typeTravaux: string): string => {
  return `ANALYSE DÉLAIS - Les retards sont la règle, pas l'exception. Sois réaliste.

DONNÉES DU DEVIS:
\`\`\`json
${devisData}
\`\`\`

TYPE TRAVAUX: ${typeTravaux}

**DURÉES RÉELLES DE CHANTIER (STATISTIQUES 2024):**

**ISOLATION:**
- Combles (100m²): 2-3 jours
- Murs extérieur (ITE, 100m²): 10-15 jours
- Murs intérieur: 5-8 jours
- ⚠️ MAJEUR si <2 jours pour combles: travail bâclé probable

**MENUISERIES:**
- Fenêtres (6-8 unités): 2-3 jours
- Porte-fenêtre/baie vitrée: 1 jour
- Délai fabrication: 4-8 semaines (CRITIQUE)
- ⚠️ MINEUR si délai total <6 semaines: fournitures pas commandées

**CHAUFFAGE:**
- Pompe à chaleur: 2-4 jours installation
- Chaudière: 1-2 jours
- Radiateurs (8-10 unités): 3-5 jours
- Délai fourniture PAC: 6-12 semaines
- ⚠️ MAJEUR si installation sans délai fourniture: suspect

**RÉNOVATION:**
- Salle de bain complète: 10-15 jours
- Cuisine complète: 8-12 jours
- Peinture (100m²): 5-7 jours
- Carrelage (50m²): 7-10 jours
- ⚠️ MAJEUR si salle bain <7 jours: séchage insuffisant

**ÉLECTRICITÉ:**
- Rénovation complète (100m²): 7-12 jours
- Mise aux normes tableau: 1-2 jours
- ⚠️ CRITIQUE si pas de temps séchage avant élec: danger

**GROS ŒUVRE:**
- Extension 20m²: 8-12 semaines
- Surélévation: 12-16 semaines
- Ravalement (150m²): 3-4 semaines
- Dalle béton: 1 jour coulage + 28 jours séchage
- ⚠️ CRITIQUE si pas de temps séchage béton: fissures garanties

**FACTEURS DE RETARD FRÉQUENTS (+20 à +50%):**
- Météo défavorable (pluie, gel, canicule)
- Retard livraison matériaux (très fréquent)
- Découverte imprévus (humidité, amiante, structure)
- Autres chantiers entreprise en parallèle
- Délais administratifs (permis, Consuel, etc.)
- Coordinations corps d'état (plombier attend maçon, etc.)

**CRITÈRES D'ÉVALUATION (100 points):**

**1. RÉALISME DÉLAIS (50 pts):**
   - Durée cohérente avec type/ampleur travaux: 30 pts
     * ⚠️ MAJEUR si <80% durée normale: impossibleou bâclé
     * ⚠️ MINEUR si >150% durée: entreprise surbookée?

   - Contraintes prises en compte: 20 pts
     * Météo (pas de ravalement en hiver)
     * Séchage (béton, enduit, chape)
     * Délais approvisionnement
     * Contraintes techniques (accès, bruit, voisinage)

**2. COMPARAISON MARCHÉ (30 pts):**
   - Délai dans moyenne secteur: 30 pts
   - Délai très court (<-30%): 10 pts
     * ⚠️ MAJEUR: probable travail bâclé ou sous-traitance non déclarée
   - Délai très long (>+50%): 15 pts
     * ⚠️ MINEUR: entreprise surbookée, faible priorité

**3. PLANNING DÉTAILLÉ (10 pts):**
   - Phasage travaux précis: 5 pts
   - Dates début/fin par phase: 5 pts
   - ⚠️ MINEUR si absent: risque désorganisation

**4. PÉNALITÉS RETARD (10 pts):**
   - Clause pénalités mentionnée: 10 pts
   - Standard: 1/3000ème du montant/jour retard
   - ⚠️ MINEUR si absente mais recommandé de négocier

**SIGNAUX D'ALERTE DÉLAIS:**
- Promesse "terminé en 2 semaines" sur gros chantier
- Pas de date début précise ("début selon planning")
- Pas de mention délais fourniture/fabrication
- Dates irréalistes (ex: ravalement en décembre)
- Planning trop serré sans marge

Retourne un JSON avec analyse PRAGMATIQUE:
{
  "scoreTotal": number (sur 100),
  "realisme": {
    "score": number,
    "dureeProposee": number (jours ouvrés),
    "dureeMoyenneMarche": number (jours),
    "dureeMinimale": number (durée technique incompressible),
    "dureeRealistePlanning": number (avec aléas +30%),
    "ecartPourcentage": number,
    "appreciation": "realiste|optimiste|pessimiste|impossible",
    "gravite": "OK|MINEUR|MAJEUR|CRITIQUE",
    "analyse": "Jugement franc sur faisabilité du délai"
  },
  "contraintes": {
    "score": number,
    "meteo": {
      "prise_en_compte": boolean,
      "periode": "string (favorable/defavorable)",
      "impact": "string"
    },
    "sechage": {
      "necessaire": boolean,
      "duree": number (jours) or null,
      "mentionne": boolean
    },
    "approvisionnement": {
      "delai_estime": number (semaines) or null,
      "mentionne": boolean,
      "risque": "faible|moyen|eleve"
    },
    "autresContraintes": ["liste contraintes identifiées"]
  },
  "planning": {
    "score": number,
    "detaille": boolean,
    "phases": [
      {
        "nom": "string",
        "duree": number (jours),
        "realiste": boolean,
        "commentaire": "string"
      }
    ],
    "qualite": "excellent|correct|insuffisant|absent"
  },
  "penalites": {
    "score": number,
    "mentionnees": boolean,
    "montant": "string (ex: 1/3000ème/jour)",
    "plafond": "string ou null",
    "recommandation": "string (négocier si absent)"
  },
  "risquesDelais": [
    {
      "risque": "string",
      "probabilite": "faible|moyenne|elevee",
      "impact": "string (conséquence)",
      "prevention": "string (comment se protéger)"
    }
  ],
  "recommandations": [
    {
      "action": "string",
      "pourquoi": "string",
      "priorite": "haute|moyenne|faible"
    }
  ],
  "verdict": {
    "delaiPropose": "tenable|optimiste|irrealiste",
    "delaiRealiste": number (jours avec marge sécurité),
    "margeSecurite": number (jours à ajouter),
    "synthese": "string (verdict en 2-3 phrases franches)"
  }
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

  return `SYNTHÈSE FINALE - Verdict CLAIR et ACTIONNABLE. Le client doit savoir EXACTEMENT quoi faire.

SCORES OBTENUS:
- Entreprise: ${scoreEntreprise}/250 (Fiabilité, assurances, certifications)
- Prix: ${scorePrix}/300 (Positionnement marché, transparence, optimisations)
- Complétude: ${scoreCompletude}/200 (Détails techniques, normes)
- Conformité: ${scoreConformite}/150 (Légalité, réglementation)
- Délais: ${scoreDelais}/100 (Réalisme planning)
- **SCORE GLOBAL: ${scoreTotal}/1000**

ANALYSES DÉTAILLÉES DE TOUTES LES SECTIONS:
\`\`\`json
${allAnalyses}
\`\`\`

**TON ANALYSE DOIT ÊTRE:**
1. **DIRECTIVE**: Dis clairement "ACCEPTER", "NÉGOCIER" ou "REFUSER"
2. **HIÉRARCHISÉE**: Distingue CRITIQUE > MAJEUR > MINEUR
3. **ACTIONNABLE**: Dis PRÉCISÉMENT quoi faire (pas de généralités)
4. **EXPERTE**: TU es la référence, pas "consultez un expert"
5. **PROTECTRICE**: Protège le client des arnaques et risques

**GRILLE DE NOTATION TORP:**
- **A+ (900-1000 pts)**: EXCELLENT - Devis de qualité, accepter en confiance
- **A (800-899 pts)**: TRÈS BON - Quelques points mineurs, accepter
- **B (700-799 pts)**: BON - Négociations nécessaires mais devis viable
- **C (600-699 pts)**: MOYEN - Problèmes sérieux, négociation OBLIGATOIRE
- **D (500-599 pts)**: PASSABLE - Risques importants, chercher alternative recommandé
- **F (<500 pts)**: INSUFFISANT - REFUSER ou exiger refonte complète

**DÉCISION FINALE:**
Si AU MOINS UN élément ⚠️ CRITIQUE détecté → REFUSER (même si score OK)
- Exemples: Pas de SIRET, pas d'assurance décennale, prix arnaque (+50%), non-conformité légale

Retourne un JSON avec verdict FERME et DÉTAILLÉ:
{
  "grade": "string (A+|A|B|C|D|F)",
  "scoreGlobal": ${scoreTotal},
  "decision": {
    "verdict": "ACCEPTER|NÉGOCIER|REFUSER",
    "confiance": "haute|moyenne|faible|aucune",
    "urgence": "string (aucune|faible|importante|critique)",
    "syntheseExecutive": "string (EN 2-3 PHRASES: verdict direct + raison principale)"
  },
  "elementsCritiques": [
    {
      "categorie": "entreprise|prix|technique|legal|delais",
      "probleme": "string (problème précis)",
      "consequence": "string (danger concret pour le client)",
      "actionImmediate": "string (ce qu'il DOIT faire maintenant)"
    }
  ],
  "pointsForts": [
    {
      "aspect": "string",
      "detail": "string (pourquoi c'est un point fort)",
      "impact": "string (bénéfice concret)"
    }
  ],
  "pointsFaibles": [
    {
      "aspect": "string",
      "gravite": "CRITIQUE|MAJEUR|MINEUR",
      "detail": "string (explication)",
      "consequence": "string (risque)",
      "resolution": "string (comment corriger)"
    }
  ],
  "recommandations": [
    {
      "type": "BLOCAGE|NÉGOCIATION|VÉRIFICATION|PROTECTION|AMÉLIORATION",
      "priorite": "P0-bloquant|P1-haute|P2-moyenne|P3-faible",
      "titre": "string (titre clair)",
      "description": "string (explication détaillée)",
      "actionPrecise": "string (action concrète avec qui/quoi/quand)",
      "resultatAttendu": "string (ce qui doit être obtenu)",
      "delai": "avant signature|avant travaux|pendant chantier",
      "impactBudget": number or null (€),
      "impactDelai": number or null (jours),
      "siRefus": "string (que faire si l'entreprise refuse)"
    }
  ],
  "negociation": {
    "posture": "ferme|équilibrée|souple",
    "leviers": [
      {
        "sujet": "string",
        "argument": "string (argumentation précise avec chiffres)",
        "objetiMin": "string (minimum acceptable)",
        "objectifCible": "string (idéal à obtenir)",
        "repli": "string (si refus: plan B)"
      }
    ],
    "economiesCibles": number (€),
    "budgetJuste": number (€),
    "margeNegociation": {
      "min": number (prix minimum réaliste),
      "max": number (prix maximum acceptable),
      "cible": number (prix équitable à viser)
    }
  },
  "questionsObligatoires": [
    {
      "question": "string (question exacte à poser)",
      "pourquoi": "string (ce qu'on cherche à vérifier)",
      "reponseAttendue": "string (ce qui devrait être répondu)",
      "signauxAlerte": ["réponses qui doivent inquiéter"]
    }
  ],
  "documentsAExiger": [
    {
      "document": "string",
      "obligatoire": boolean,
      "delai": "avant signature|avant travaux",
      "pourquoi": "string"
    }
  ],
  "clausesAjouter": [
    "Liste de clauses protectrices à ajouter au contrat"
  ],
  "risques": {
    "niveauGlobal": "faible|moyen|eleve|critique",
    "principaux": [
      {
        "risque": "string",
        "gravite": "CRITIQUE|MAJEUR|MINEUR",
        "probabilite": "faible|moyenne|elevee",
        "impact": "string (conséquence chiffrée)",
        "prevention": "string (comment l'éviter)"
      }
    ]
  },
  "alternatives": {
    "recommandation": "string (poursuivre ou chercher autre devis?)",
    "raisons": ["pourquoi chercher/ne pas chercher ailleurs"],
    "criteresAutreDevis": ["ce qu'il faut vérifier dans les autres devis"]
  },
  "verdictFinal": {
    "instruction": "string (EN 1 PHRASE: ce que le client doit faire - style: 'REFUSEZ ce devis' ou 'Négociez ces 3 points' ou 'Acceptez en confiance')",
    "justification": "string (EN 2-3 PHRASES: pourquoi ce verdict)",
    "prochainePasse": "string (action concrète à faire dans les 48h)"
  }
}

**RAPPEL CRITIQUE:**
- Sois FRANC: un mauvais devis doit être REFUSÉ, ne temporise pas
- Sois PRÉCIS: "négocier le prix" → "exiger une baisse de 3 200€ sur le poste isolation"
- Sois DIRECTIF: "il serait bien de..." → "VOUS DEVEZ exiger..."
- Sois PROTECTEUR: pense aux conséquences à 5-10 ans (revente, garanties, etc.)
- TU ES L'EXPERT: ne renvoie JAMAIS vers "un autre professionnel"`;
};
