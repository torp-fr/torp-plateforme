# Mobile-First UX Flows — TORP Platform
**Version:** 1.0
**Date:** 2026-03-27
**Status:** Design

---

## Design Principles

- **Mobile-first**: All flows designed for 375px viewport, enhanced for desktop
- **Progressive disclosure**: Show minimal required info upfront, reveal details on demand
- **Async-first**: Long operations (OCR, API calls) run in background with progress feedback
- **Zero dead-ends**: Every error state has a recovery path
- **Confidence transparency**: Always show what was auto-detected vs. manually entered

---

## Flow 1 — Entreprise Registration (SIRET onboarding)

```
┌─────────────────────────────────────┐
│  [Screen 1] Enter SIRET             │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ SIRET: [_______________]    │    │
│  │        14 chiffres          │    │
│  └─────────────────────────────┘    │
│                                     │
│  [→ Continuer]                      │
└─────────────────────────────────────┘
         ↓ (submit)
┌─────────────────────────────────────┐
│  [Screen 2] Loading                 │
│                                     │
│  ⟳  Vérification SIRET...          │
│  ⟳  Récupération profil Pappers... │
│  ✓  Certifications RGE...          │
│                                     │
│  (2–4 sec parallel fetch)           │
└─────────────────────────────────────┘
         ↓ (on success)
┌─────────────────────────────────────┐
│  [Screen 3] Confirm Pre-filled Data │
│                                     │
│  ✓ SARL DUPONT ÉLECTRICITÉ          │
│  NAF: 43.21A — Électricité          │
│  Effectifs: 12 salariés             │
│  CA: 1,2M€                          │
│  ┌─ Certifications ──────────────┐  │
│  │ ✓ RGE   ✓ Qualifelec         │  │
│  │ ✗ Qualiopi  ✗ Qualibat       │  │
│  └───────────────────────────────┘  │
│                                     │
│  [Corriger]    [Confirmer →]        │
└─────────────────────────────────────┘
         ↓ (confirm)
┌─────────────────────────────────────┐
│  [Screen 4] Complete Profile        │
│                                     │
│  Contact: [________________]        │
│  Email:   [________________]        │
│  Tel:     [________________]        │
│  Logo:    [Upload logo ↑]           │
│                                     │
│  [← Retour]  [Créer compte →]      │
└─────────────────────────────────────┘

Error states:
  SIRET invalide → "Format incorrect (14 chiffres requis)"
  SIRET inconnu  → "SIRET non trouvé — saisie manuelle disponible"
  Pappers down   → "Enrichissement temporairement indisponible — continuer manuellement"
```

---

## Flow 2 — Project Creation (with lazy context fetch)

```
┌─────────────────────────────────────┐
│  [Screen 1] Project Type            │
│                                     │
│  Quel type de travaux ?             │
│                                     │
│  [Piscine]    [Extension]           │
│  [Rénovation] [Électricité]         │
│  [Toiture]    [Isolation]           │
│  [Autre...]                         │
└─────────────────────────────────────┘
         ↓ (select type)
┌─────────────────────────────────────┐
│  [Screen 2] Client Info             │
│                                     │
│  Client: [Nom ________]             │
│          [Prénom ______]            │
│          [Tél _________]            │
│                                     │
│  Adresse chantier:                  │
│  [________________________________]  │
│   → Géolocaliser depuis GPS         │
│                                     │
│  [→ Suivant]                        │
└─────────────────────────────────────┘
         ↓ (submit address)
┌─────────────────────────────────────┐
│  [Screen 3] Context Loading         │
│             (background, non-blocking)│
│                                     │
│  ✓ Adresse validée — Paris 75001   │
│  ⟳ Vérification ABF...             │
│  ⟳ Consultation PLU...             │
│                                     │
│  [→ Continuer pendant le chargement]│
└─────────────────────────────────────┘
         ↓ (immediate)
┌─────────────────────────────────────┐
│  [Screen 4] Project Summary         │
│                                     │
│  PISCINE — M. Jean Dupont           │
│  12 rue de la Paix, Paris 75001     │
│                                     │
│  ┌─ Contexte réglementaire ──────┐  │
│  │ ⟳ Chargement en cours...     │  │
│  └───────────────────────────────┘  │
│                                     │
│  Budget estimé: [_________] €       │
│  Délai prévu:   [_________]         │
│                                     │
│  [Créer le projet →]                │
└─────────────────────────────────────┘
         ↓ (context loaded — card updates)
┌─ Contexte réglementaire ──────────┐
│ ✓ Zone ABF — Secteur protégé      │
│ ✓ PLU: Zone UA — piscine autorisée│
│ ⚠ Permis construire requis (>10m²) │
│ ℹ Données mises à jour: aujourd'hui│
└───────────────────────────────────┘
```

---

## Flow 3 — Devis Upload (core feature)

```
┌─────────────────────────────────────┐
│  [Screen 1] Upload                  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   📎 Déposer votre devis   │    │
│  │                             │    │
│  │   PDF · Image · Excel · Word│    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Ou: [Prendre une photo] (mobile)   │
│      [Saisir manuellement]          │
└─────────────────────────────────────┘
         ↓ (file selected)
┌─────────────────────────────────────┐
│  [Screen 2] Parsing Progress        │
│                                     │
│  📄 devis-dupont.pdf (2.4 MB)       │
│                                     │
│  ✓ Format détecté: PDF              │
│  ✓ Extraction du texte...           │
│  ⟳ Analyse des postes... (3/9)      │
│                                     │
│  [████████░░░░░░░] 55%              │
└─────────────────────────────────────┘
         ↓ (confidence ≥ 0.70)
┌─────────────────────────────────────┐
│  [Screen 3] Preview Items           │
│                                     │
│  9 postes détectés                  │
│  Confiance: 87%  ●●●●○              │
│  Total HT: 12 450 €                 │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ 1. Tableau TGBT           890€ │ │
│  │    Catégorie: Électricité   ✓  │ │
│  │                                │ │
│  │ 2. Câblage circuits          … │ │
│  │    Catégorie: Électricité   ✓  │ │
│  │                                │ │
│  │ ⚠ 3. [À vérifier]        0 €  │ │
│  │    Prix unitaire manquant      │ │
│  └────────────────────────────────┘ │
│                                     │
│  [Modifier]   [Valider et analyser]  │
└─────────────────────────────────────┘

Confidence < 0.50:
┌─────────────────────────────────────┐
│  ⚠ Qualité de lecture insuffisante  │
│                                     │
│  Le document est difficile à lire   │
│  (scan basse qualité ou format      │
│  non standard).                     │
│                                     │
│  Options:                           │
│  [📸 Reprendre la photo]            │
│  [✏ Saisir manuellement]           │
│  [↑ Importer un meilleur fichier]   │
└─────────────────────────────────────┘
```

---

## Flow 4 — Analysis Run (score generation)

```
┌─────────────────────────────────────┐
│  [Screen 1] Launch Analysis         │
│                                     │
│  Prêt à analyser                    │
│  PISCINE — M. Jean Dupont           │
│  9 postes · 12 450 € HT             │
│                                     │
│  Ce qui sera analysé:               │
│  ✓ Conformité réglementaire         │
│  ✓ Exhaustivité des prestations     │
│  ✓ Clarté des descriptions          │
│  ✓ Cohérence des prix               │
│  ✓ Risques et anomalies             │
│                                     │
│  [⚡ Lancer l'analyse]              │
└─────────────────────────────────────┘
         ↓ (launch)
┌─────────────────────────────────────┐
│  [Screen 2] Analysis Progress       │
│                                     │
│  Analyse en cours...                │
│                                     │
│  ✓ Contexte projet                  │
│  ✓ Classification des lots          │
│  ⟳ Vérification réglementaire...   │
│  ░ Scoring                          │
│  ░ Rapport final                    │
│                                     │
│  [████████████░░░░░] 65%            │
│                                     │
│  Résultat disponible dans ~30 sec   │
└─────────────────────────────────────┘
         ↓ (complete)
┌─────────────────────────────────────┐
│  [Screen 3] Score Reveal            │
│                                     │
│         ┌─────────┐                 │
│         │    C    │   Score: 62/100 │
│         │  62/100 │   Passable      │
│         └─────────┘                 │
│                                     │
│  Risque: Modéré                     │
│  Verdict: Attention requise         │
│                                     │
│  [Voir le rapport complet →]        │
│  [Générer le QR code]               │
└─────────────────────────────────────┘
```

---

## Flow 5 — Full Audit Report View

```
┌─────────────────────────────────────┐
│  [Tab 1] Résumé                     │
│                                     │
│  Grade C · 62/100                   │
│  ━━━━━━━━━━━━━━━━━━━━              │
│  Conformité    [████████░░] 78      │
│  Exhaustivité  [████████░░] 75      │
│  Clarté        [██████░░░░] 60      │
│  Compétitivité [████░░░░░░] 45      │
│  Risques       [████████░░] 80      │
│  ━━━━━━━━━━━━━━━━━━━━              │
│                                     │
│  Points forts:                      │
│  ✓ Conformité réglementaire bonne  │
│  ✓ Risques structurels faibles     │
│                                     │
│  À améliorer:                       │
│  ⚠ Prix unitaires sous-détaillés   │
│  ⚠ 2 domaines techniques absents   │
│                                     │
│  [Résumé] [Postes] [Recommandations]│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  [Tab 2] Postes                     │
│                                     │
│  9 postes analysés                  │
│  ┌───────────────────────────────┐  │
│  │ Tableau TGBT           890 €  │  │
│  │ Électricité · Prix: ✓ normal  │  │
│  │ Conforme NF C 15-100   ✓     │  │
│  ├───────────────────────────────┤  │
│  │ Câblage 2,5mm²        1200 € │  │
│  │ Électricité · Prix: ⚠ élevé  │  │
│  │ +23% vs marché               │  │
│  └───────────────────────────────┘  │
│  [Résumé] [Postes] [Recommandations]│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  [Tab 3] Recommandations            │
│                                     │
│  🔴 Critique (1)                    │
│  ┌───────────────────────────────┐  │
│  │ Ajouter la mise à la terre    │  │
│  │ Référence: NF C 15-100 §411   │  │
│  │ Effort: Rapide                │  │
│  │ Gain estimé: +8 pts           │  │
│  └───────────────────────────────┘  │
│                                     │
│  🟠 Important (2)                   │
│  [voir 2 recommandations...]        │
│                                     │
│  🟡 Conseil (3)                     │
│  [voir 3 recommandations...]        │
│                                     │
│  [Résumé] [Postes] [Recommandations]│
└─────────────────────────────────────┘
```

---

## Flow 6 — QR Code Generation & Sharing

```
┌─────────────────────────────────────┐
│  [Screen 1] Generate QR             │
│                                     │
│  Créer un QR code public            │
│                                     │
│  Ce QR code permettra à votre       │
│  client de consulter le rapport     │
│  en scannant le code.               │
│                                     │
│  Accès: Lecture seule (anonyme)     │
│  Expiration: Aucune (permanent)     │
│                                     │
│  [Générer le QR code]               │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  [Screen 2] QR Ready                │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  █▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█    │    │
│  │  █ ▀▄▀▄  ▄▀▄▀▄  ▄▀▄▀ █    │    │
│  │  █▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█    │    │
│  └─────────────────────────────┘    │
│                                     │
│  Code: AB3XK7M2                     │
│  URL: torp.fr/audit/AB3XK7M2        │
│                                     │
│  [📥 Télécharger PNG]               │
│  [📋 Copier le lien]                │
│  [📤 Partager par email/SMS]        │
│  [🖨 Imprimer]                      │
└─────────────────────────────────────┘
```

---

## Flow 7 — Client Public View (QR scan)

```
Client scans QR → torp.fr/audit/AB3XK7M2

┌─────────────────────────────────────┐
│  TORP — Rapport de confiance        │
│                                     │
│  Devis SARL Dupont Électricité      │
│  Analysé le 27 mars 2026            │
│                                     │
│         ┌─────────┐                 │
│         │    C    │                 │
│         │  62/100 │                 │
│         └─────────┘                 │
│         Passable · Risque Modéré    │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━              │
│  Conformité      78/100   ●●●●○    │
│  Exhaustivité    75/100   ●●●●○    │
│  Clarté          60/100   ●●●○○    │
│  ━━━━━━━━━━━━━━━━━━━━              │
│                                     │
│  Points clés:                       │
│  ⚠ 2 postes nécessitent révision    │
│  ✓ Certifications RGE vérifiées     │
│                                     │
│  [En savoir plus sur TORP]          │
│                                     │
│  Rapport confidentiel —             │
│  Ne pas redistribuer                │
└─────────────────────────────────────┘
```

---

## Flow 8 — Devis Revision (v2 comparison)

```
┌─────────────────────────────────────┐
│  [Screen 1] Upload New Version      │
│                                     │
│  Version précédente: v1 (grade C)   │
│  Recommandations appliquées: ?      │
│                                     │
│  [↑ Déposer la version révisée]     │
└─────────────────────────────────────┘
         ↓ (upload + parse + score)
┌─────────────────────────────────────┐
│  [Screen 2] Version Comparison      │
│                                     │
│  v1 → v2 : Amélioration +12 pts    │
│                                     │
│  Grade: C → B  ✓                   │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ Dimension     v1    v2  Δ      │ │
│  │ Conformité    78    85  +7 ↑   │ │
│  │ Exhaustivité  75    82  +7 ↑   │ │
│  │ Clarté        60    71  +11 ↑  │ │
│  │ Compétitivité 45    52  +7 ↑   │ │
│  │ Risques       80    80   0 →   │ │
│  └────────────────────────────────┘ │
│                                     │
│  Améliorations reconnues:           │
│  ✓ Prix unitaires ajoutés           │
│  ✓ Domaines manquants ajoutés       │
│                                     │
│  Encore à corriger:                 │
│  ⚠ Mise à la terre non mentionnée  │
│                                     │
│  [Générer nouveau QR code]          │
└─────────────────────────────────────┘
```

---

## Mobile Interaction Patterns

### Thumb-Friendly Action Zones
```
Phone (375px) layout:
┌─────────────────────────────────────┐
│  Header (safe zone — status bar)    │  ← System UI
├─────────────────────────────────────┤
│                                     │
│     Content Zone (scrollable)       │  ← Main content
│                                     │
│                                     │
├─────────────────────────────────────┤
│   Primary CTA Button (full width)   │  ← Thumb reach: bottom
│   [48px height min]                 │
└─────────────────────────────────────┘

Primary actions (full-width button, bottom)
Secondary actions (text links, mid-screen)
Destructive actions (require confirmation, never bottom-right)
```

### Progressive Loading States
```
State 1: Skeleton screen (immediate)  → No layout shift
State 2: Content appears              → Fade in
State 3: Real-time updates            → Badge/counter update
State 4: Completion                   → Toast notification
```

### Error Recovery Patterns
```
Network error   → "Réessayer" + offline cache fallback
OCR failure     → "Reprendre photo" + "Saisir manuellement"
API unavailable → Continue without data + "Données non disponibles"
Parse failure   → Flag items + "Vérifier manuellement"
Auth expired    → Redirect to login + return to current page after
```
