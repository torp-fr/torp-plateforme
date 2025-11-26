# TORP - Quote Insight Tally

> Plateforme d'analyse intelligente de devis pour le secteur des travaux

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/torp-fr/quote-insight-tally)

## 🎯 À propos

TORP est une plateforme SaaS qui permet d'analyser automatiquement la qualité des devis de travaux grâce à l'intelligence artificielle. Elle s'adresse à deux types d'utilisateurs principaux (B2C et B2B) et offre un scoring détaillé TORP (Transparence, Offre, Robustesse, Prix).

**🎉 Actuellement en phase de test gratuit** - Analyses illimitées pour tous les testeurs !

**Démo en ligne** : [quote-insight-tally.vercel.app](https://quote-insight-tally.vercel.app)

## ✨ Fonctionnalités Principales

### B2C - Particuliers
- 🔍 **Analyse IA de devis reçus** - Score TORP détaillé (A+ à F)
- 🔎 **Vérification entreprise** - SIREN, Kbis, assurances
- 💡 **Aide à la décision** - Recommandations pour choisir le bon pro
- 📊 **Dashboard personnel** - Suivi de vos demandes de devis

### B2B - Professionnels BTP
- 🎯 **Optimisation de devis avant envoi** - Améliorez votre taux de signature
- 📈 **Recommandations IA** - Conseils pour augmenter votre score TORP
- 🏆 **Certification TORP Pro** - Badge de confiance + QR Code
- 📊 **Analyse de performance** - Suivez l'évolution de vos scores

### Fonctionnalités communes
- 📁 **Gestion documentaire** - CCTP, DOE, carnet numérique
- 🏗️ **Suivi de projet** - Timeline et paiements échelonnés
- 💬 **Assistant IA** - Chatbot pour répondre à vos questions
- 📊 **Analytics avancées** - Statistiques et tendances

> 📖 **[Voir la documentation B2B complète](docs/B2B_ASSISTANT_SCOPE.md)** pour comprendre la différence entre B2C et B2B

## 🚀 Démarrage Rapide

### Installation

```bash
# Cloner le projet
git clone https://github.com/torp-fr/quote-insight-tally.git
cd quote-insight-tally

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.development.example .env

# Lancer le serveur de développement
npm run dev
```

Le serveur démarre sur **http://localhost:8080**

### Scripts disponibles

```bash
npm run dev           # Serveur de développement
npm run build         # Build production
npm run preview       # Preview du build
npm test              # Tests en mode watch
npm run test:ui       # Tests avec interface UI
npm run test:coverage # Tests avec couverture
npm run lint          # Vérifier le code
```

## 📚 Documentation

### Documentation principale
- **[Guide de démarrage](docs/GETTING_STARTED.md)** - Installation et configuration détaillée
- **[Architecture technique](docs/ARCHITECTURE.md)** - Structure du projet et patterns
- **[Changelog](CHANGELOG.md)** - Historique des modifications

### Documentation métier
- **[B2B Assistant Scope](docs/B2B_ASSISTANT_SCOPE.md)** - Vision et fonctionnalités B2B détaillées
- **[Pragmatic Approach](PRAGMATIC_APPROACH.md)** - Stratégie de développement pragmatique
- **[Free Mode Config](FREE_MODE_CONFIG.md)** - Configuration du mode gratuit

### Guides d'implémentation
- **[START_HERE Decision](START_HERE_DECISION.md)** - Choisir entre approche radicale et pragmatique
- **[Automated Tasks](AUTOMATED_TASKS.md)** - Plan d'exécution automatisé (4 phases)

## 🏗️ Stack Technique

### Frontend
- **React 18.3** + **TypeScript 5.8**
- **Vite 5.4** - Build ultra-rapide
- **TanStack Query v5** - State management serveur
- **React Router v6** - Routing

### UI/UX
- **shadcn/ui** + **Radix UI** - Composants accessibles
- **Tailwind CSS 3.4** - Styling
- **Lucide React** - Icons

### Qualité & Tests
- **Vitest 4.0** - Tests unitaires (13 tests ✅)
- **React Testing Library** - Tests de composants
- **ESLint 9** - Linting
- **TypeScript strict mode** - Type safety

## 🔐 Authentification

Le projet utilise actuellement un système d'authentification mocké pour le développement.

**Pour vous connecter** :
- Email : n'importe quelle adresse (ex: `demo@torp.app`)
- Mot de passe : minimum 6 caractères (ex: `password`)

Types d'utilisateurs :
- **B2C** (Particuliers) - email normal (ex: `jean@email.com`)
- **B2B** (Professionnels BTP) - email contenant "pro" (ex: `contact@entreprise-pro.fr`)
- **Admin** - pour la gestion de la plateforme

> 💡 En production, remplacer par Supabase, Auth0 ou Firebase
> 🎉 **Mode gratuit activé** - Tous les utilisateurs bénéficient de crédits illimités pendant la phase de test

## 📦 Structure du Projet

```
src/
├── components/       # Composants React (33+ métier + 48 UI)
│   ├── auth/        # Authentification & routes protégées
│   ├── error/       # Error boundaries
│   └── ui/          # Composants shadcn/ui
├── pages/           # Pages/Routes (26 pages)
├── services/        # Services API (mockés, backend-ready)
│   └── api/
│       ├── client.ts           # Client HTTP
│       └── mock/               # Services mockés
├── context/         # État global React Context
├── config/          # Configuration (env vars)
├── hooks/           # Custom React hooks
├── types/           # Types TypeScript
├── test/            # Utilitaires de test
└── lib/             # Utilitaires
```

## 🚀 Déploiement

### Vercel (Recommandé)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/torp-fr/quote-insight-tally)

Ou via CLI :

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Production
vercel --prod
```

### Variables d'environnement Vercel

Dans les settings Vercel, configurer :

```bash
VITE_APP_ENV=production
VITE_API_BASE_URL=https://api.torp.app/api
VITE_MOCK_API=false
VITE_DEBUG_MODE=false

# Auth (remplacer par vraies valeurs)
VITE_AUTH_PROVIDER=supabase
VITE_AUTH_SUPABASE_URL=https://your-project.supabase.co
VITE_AUTH_SUPABASE_ANON_KEY=your-key-here
```

### Autres plateformes

**Netlify**
```bash
npm run build
# Deploy le dossier dist/
```

**Docker**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "run", "preview"]
```

## 🧪 Tests

```bash
# Tous les tests
npm test

# Interface UI interactive
npm run test:ui

# Avec couverture
npm run test:coverage
```

**Couverture actuelle** : 13 tests passants ✅

## 🎯 Roadmap

### ✅ Phase 1 - Fondations (Complété)
- [x] Infrastructure de tests
- [x] TypeScript strict mode
- [x] Architecture backend-ready
- [x] Protection des routes
- [x] Error boundaries
- [x] Lazy loading
- [x] Documentation complète

### 🔄 Phase 2 - Backend Integration (En cours)
- [ ] Connexion API backend réelle
- [ ] Authentification Supabase/Auth0
- [ ] Upload de fichiers sécurisé
- [ ] WebSocket pour temps réel
- [ ] Base de données

### 📅 Phase 3 - Production
- [ ] Tests E2E (Playwright)
- [ ] Monitoring (Sentry)
- [ ] Analytics
- [ ] CI/CD (GitHub Actions)
- [ ] SEO optimization
- [ ] PWA features

## 🤝 Contribution

Les contributions sont les bienvenues ! Merci de :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

**Avant de contribuer** :
- Lire `docs/ARCHITECTURE.md`
- S'assurer que les tests passent (`npm test`)
- Respecter les conventions de code (ESLint)

## 📄 Licence

Ce projet a été initialement développé avec [Lovable.dev](https://lovable.dev) et est maintenant maintenu par l'équipe TORP.

---

## 🔗 Liens Utiles

- **Lovable Project**: https://lovable.dev/projects/f7c01cee-8476-487a-9d55-ea6fba0aeeee
- **Production**: https://quote-insight-tally.vercel.app
- **GitHub**: https://github.com/torp-fr/quote-insight-tally
- **Documentation**: [docs/](docs/)

## 💬 Support

Pour toute question ou problème :
- 📧 Email : support@torp.app
- 🐛 Issues : [GitHub Issues](https://github.com/torp-fr/quote-insight-tally/issues)
- 📖 Docs : [Documentation complète](docs/)

---

**Fait avec ❤️ par l'équipe TORP**
