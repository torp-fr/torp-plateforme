# TORP - Plateforme Intelligente de Gestion de Projets BTP

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/torp-fr/quote-insight-tally)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)]()
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)]()

## Présentation

**TORP** (Tool for Optimized Renovation Projects) est une plateforme SaaS qui accompagne les particuliers et professionnels du BTP tout au long du cycle de vie d'un projet de construction ou rénovation.

La plateforme couvre **5 phases** distinctes, de la conception initiale jusqu'à la fin des garanties légales, avec une intelligence artificielle intégrée à chaque étape.

## Fonctionnalités par Phase

| Phase | Nom | Description |
|-------|-----|-------------|
| **0** | Conception | Qualification projet, définition travaux IA, diagnostics, CCTP, budget & aides |
| **1** | Consultation | DCE, matching entreprises (Sirene/RGE), analyse offres IA, contrats |
| **2** | Préparation | Planning Gantt, checklist administrative, réunions, ordre de service |
| **3** | Exécution | Suivi temps réel, contrôles qualité, coordination multi-lots, situations |
| **4** | Réception | OPR, gestion réserves, PV réception, garanties, carnet de santé |

### Phase 0 - Conception et Définition
- Wizard de qualification interactif (type bien, budget, objectifs)
- Définition des travaux assistée par IA
- Diagnostics automatisés (DPE, amiante, plomb)
- Génération CCTP automatique
- Estimation budget et aides (MaPrimeRénov', CEE)

### Phase 1 - Consultation Entreprises
- Génération DCE (Dossier de Consultation des Entreprises)
- Recherche entreprises via API Sirene + Qualifications RGE
- Analyse comparative des offres par IA
- Génération automatique des contrats

### Phase 2 - Préparation Chantier
- Planning Gantt interactif avec dépendances
- Checklist administrative (assurances, autorisations)
- Gestion des réunions de chantier
- Ordres de service numériques

### Phase 3 - Exécution des Travaux
- Dashboard temps réel d'avancement
- Contrôles qualité avec photos et annotations
- Coordination multi-lots
- Situations de travaux et suivi financier
- Journal de chantier automatisé

### Phase 4 - Réception et Garanties
- Opérations Préalables à la Réception (OPR)
- Gestion des réserves et levées
- Génération PV de réception
- Dashboard garanties (parfait achèvement, décennale)
- Carnet de santé numérique du bâtiment

## Intelligence Artificielle

### Agents IA intégrés
- **Analyse de devis** : Scoring automatique sur 80+ critères (score TORP A+ à F)
- **Vision par ordinateur** : Analyse photos chantier via GPT-4o Vision
- **RAG BTP** : Base de connaissances DTU, normes, prix de référence
- **Génération documentaire** : CCTP, DCE, PV automatisés
- **Monitoring chantier** : Alertes prédictives et recommandations

### Architecture IA sécurisée
Tous les appels IA passent par des **Supabase Edge Functions** pour protéger les clés API :
```
Client → Edge Function (llm-completion) → OpenAI/Anthropic
```

## Démarrage Rapide

### Prérequis
- Node.js 18+
- npm ou yarn
- Compte Supabase
- Clés API (OpenAI, Anthropic - optionnel)

### Installation
```bash
# Cloner le repository
git clone https://github.com/torp-fr/quote-insight-tally.git
cd quote-insight-tally

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés

# Lancer en développement
npm run dev
```

### Variables d'environnement
```env
# Supabase (requis)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# APIs externes (optionnel)
VITE_INSEE_API_KEY=xxx
VITE_PAPPERS_API_KEY=xxx

# Mode développement
VITE_MOCK_API=false
```

## Architecture Technique

### Stack Frontend
- **React 18.3** + **TypeScript 5.8**
- **Vite 5.4** - Build ultra-rapide
- **TanStack Query v5** - State management serveur
- **React Router v6** - Routing

### UI/UX
- **shadcn/ui** + **Radix UI** - Composants accessibles
- **Tailwind CSS 3.4** - Styling
- **Lucide React** - Iconographie

### Backend
- **Supabase** - Base de données PostgreSQL + Auth + Storage
- **Edge Functions** - Serverless pour appels IA sécurisés

## Structure du Projet
```
src/
├── ai/                    # Agents IA
│   └── agents/
│       ├── phase3/        # SiteMonitoring, PhotoAnalysis, Quality
│       └── phase4/        # Reception, Warranty
├── components/
│   ├── layout/            # AppLayout, ChantierLayout, Sidebar
│   ├── phase0-4/          # Composants par phase
│   └── ui/                # Composants shadcn/ui
├── hooks/
│   ├── phase1-4/          # Hooks React Query par phase
│   └── useProjectDetails  # Hook projet global
├── pages/
│   ├── phase0/            # 6 pages (Dashboard, Wizard, CCTP...)
│   ├── phase1/            # Consultation entreprises
│   ├── phase2/            # 5 pages (Dashboard, Planning, Réunions...)
│   ├── phase3/            # 4 pages (Dashboard, Contrôles, Situations...)
│   └── phase4/            # Dashboard réception & garanties
├── services/
│   ├── ai/                # SecureAI, OpenAI wrappers
│   ├── api/               # APIs externes (Insee, Cadastre...)
│   └── phase0-4/          # Services métier par phase
└── types/                 # Types TypeScript par phase

supabase/
└── functions/
    └── llm-completion/    # Edge Function pour appels IA sécurisés
```

## Profils Utilisateurs

| Profil | Accès | Navigation |
|--------|-------|------------|
| **B2C** (Particuliers) | Toutes phases | /dashboard, /phase0-4 |
| **B2B** (Professionnels) | Pro features | /pro/* |
| **B2G** (Collectivités) | Marchés publics | Appels d'offres |

## Scripts Disponibles

```bash
npm run dev           # Serveur développement (localhost:5173)
npm run build         # Build production
npm run preview       # Preview du build
npm run lint          # Vérifier le code
npm test              # Tests unitaires
```

## Déploiement

### Vercel (Recommandé)
```bash
vercel --prod
```

### Variables Vercel
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

## Branches Git

| Branche | Usage |
|---------|-------|
| `main` | Production stable |
| `claude/*` | Branches de développement IA |

### Nettoyage des branches
```bash
# Voir les branches mergées
git branch -r --merged origin/main

# Supprimer une branche distante
git push origin --delete nom-branche
```

## Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit (`git commit -m 'feat: ajouter fonctionnalité X'`)
4. Push (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

### Conventions de commit
- `feat:` Nouvelle fonctionnalité
- `fix:` Correction de bug
- `docs:` Documentation
- `refactor:` Refactoring
- `test:` Tests

## Support

- **GitHub Issues** : [Signaler un bug](https://github.com/torp-fr/quote-insight-tally/issues)
- **Documentation** : [docs/](docs/)
- **Email** : support@torp.fr

## Licence

MIT License - Voir [LICENSE](LICENSE)

---

**Développé avec React, TypeScript et Supabase**
