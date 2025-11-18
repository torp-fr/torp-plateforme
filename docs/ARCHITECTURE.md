# Architecture Technique - TORP

## 📋 Vue d'ensemble

TORP est une plateforme d'analyse de devis pour le secteur des travaux, construite avec React, TypeScript et Vite.

## 🏗️ Stack Technique

### Frontend
- **React 18.3** - Framework UI
- **TypeScript 5.8** - Typage statique
- **Vite 5.4** - Build tool ultra-rapide
- **React Router v6** - Routing
- **TanStack Query v5** - State management serveur

### UI Framework
- **shadcn/ui** - Composants UI réutilisables
- **Radix UI** - Composants accessibles headless
- **Tailwind CSS 3.4** - Styling utility-first
- **Lucide React** - Icons

### Tests
- **Vitest 4.0** - Test runner
- **React Testing Library** - Tests de composants
- **@testing-library/jest-dom** - Matchers additionnels

### Build & Qualité
- **ESLint 9** - Linting
- **TypeScript strict mode** - Type safety renforcé
- **SWC** - Compilateur super rapide

## 📁 Structure du Projet

```
src/
├── assets/              # Images, fonts, etc.
├── components/          # Composants React
│   ├── auth/           # Composants d'authentification
│   │   └── ProtectedRoute.tsx
│   ├── error/          # Error boundaries
│   │   └── ErrorBoundary.tsx
│   ├── ui/             # Composants UI shadcn (48 composants)
│   └── [business]/     # Composants métier (33+)
├── config/             # Configuration
│   └── env.ts          # Variables d'environnement (type-safe)
├── context/            # React Context
│   └── AppContext.tsx  # État global application
├── data/               # Données mock
├── hooks/              # Custom React hooks
├── lib/                # Utilitaires
├── pages/              # Pages/Routes (26 pages)
├── services/           # Services API
│   └── api/
│       ├── client.ts           # Client HTTP centralisé
│       ├── index.ts            # Export des services
│       └── mock/               # Services mockés
│           ├── auth.service.ts
│           ├── devis.service.ts
│           └── project.service.ts
├── test/               # Configuration & utilitaires de test
│   ├── setup.ts
│   └── test-utils.tsx
├── types/              # Définitions TypeScript
│   ├── torp.ts         # Types métier TORP
│   └── marketplace.ts
├── App.tsx             # Composant racine (version originale)
├── App.improved.tsx    # Version améliorée avec lazy loading
└── main.tsx            # Point d'entrée
```

## 🔐 Authentification

### Architecture
- Service d'auth mocké (`authService`)
- Protection des routes via `<ProtectedRoute>`
- Support multi-profils : B2C, B2B, B2G, B2B2C, admin

### Usage

```tsx
// Protéger une route
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>

// Restreindre par type d'utilisateur
<Route
  path="/admin"
  element={
    <ProtectedRoute requiredTypes={['admin']}>
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

## 🔌 Services API

### Client HTTP

```typescript
import { apiClient } from '@/services/api';

// GET
const data = await apiClient.get('/devis');

// POST
const result = await apiClient.post('/devis', { data });

// Upload
const response = await apiClient.upload('/devis/upload', file);
```

### Services Métier

```typescript
import { services } from '@/services/api';

// Auth
await services.auth.login({ email, password });
await services.auth.register({ email, password, name, type });

// Devis
await services.devis.uploadDevis(file);
const analysis = await services.devis.getAnalysis(devisId);

// Projects
await services.project.createProject(data);
await services.project.updateProject(id, updates);
```

## ⚙️ Configuration Environnement

### Variables d'environnement

Fichiers :
- `.env.example` - Template
- `.env.development.example` - Config développement
- `.env.production.example` - Config production
- `.env` - Configuration locale (gitignored)

### Usage type-safe

```typescript
import { env } from '@/config/env';

console.log(env.app.name);           // 'TORP'
console.log(env.api.baseUrl);        // 'http://localhost:3000/api'
console.log(env.features.chatAIEnabled); // true
```

## 🧪 Tests

### Exécution

```bash
npm test              # Mode watch
npm run test:ui       # Interface UI
npm run test:run      # Run une fois
npm run test:coverage # Avec couverture
```

### Écrire des tests

```typescript
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { screen } from '@testing-library/react';
import MyComponent from './MyComponent';

test('renders component', () => {
  renderWithProviders(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

## 🚀 Performance

### Code Splitting

Utiliser `App.improved.tsx` pour le lazy loading :

```typescript
const Dashboard = lazy(() => import('./pages/Dashboard'));

<Suspense fallback={<LoadingFallback />}>
  <Dashboard />
</Suspense>
```

### Optimisations

- ✅ Lazy loading des routes non-critiques
- ✅ React Query cache (5min stale time)
- ✅ SWC pour compilation rapide
- ✅ Code splitting par route
- ⏳ TODO: Image optimization
- ⏳ TODO: Bundle analysis

## 🛡️ Error Handling

### Error Boundary

```tsx
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

### HOC Pattern

```tsx
import { withErrorBoundary } from '@/components/error/ErrorBoundary';

export default withErrorBoundary(MyComponent);
```

## 🔄 État Global

### AppContext

```tsx
import { useApp } from '@/context/AppContext';

function MyComponent() {
  const {
    user,
    userType,
    projects,
    setUser,
    addProject
  } = useApp();

  // ...
}
```

## 📦 Build & Déploiement

### Scripts disponibles

```bash
npm run dev           # Dev server (port 8080)
npm run build         # Build production
npm run build:dev     # Build développement
npm run preview       # Preview build
npm run lint          # Linting
npm test              # Tests
```

### Build production

```bash
# 1. Configurer .env.production
cp .env.production.example .env.production
# Éditer .env.production avec les vraies valeurs

# 2. Build
npm run build

# 3. Le dossier dist/ contient le build
```

## 🎯 Roadmap Technique

### ✅ Phase 1 - Fondations (Complété)
- [x] TypeScript strict mode progressif
- [x] Variables d'environnement
- [x] Infrastructure de tests
- [x] Architecture backend-ready
- [x] Protection des routes
- [x] Error boundaries
- [x] Lazy loading

### ⏳ Phase 2 - Backend Integration (TODO)
- [ ] Connexion API backend réelle
- [ ] Authentification Supabase/Auth0
- [ ] Upload de fichiers sécurisé
- [ ] WebSocket pour temps réel

### ⏳ Phase 3 - Production Ready (TODO)
- [ ] Tests E2E (Playwright)
- [ ] Monitoring (Sentry)
- [ ] Analytics
- [ ] CI/CD pipeline
- [ ] SEO optimization
- [ ] PWA features

## 🔍 Bonnes Pratiques

### TypeScript
- Toujours typer les props
- Utiliser interfaces pour les objets
- Éviter `any`, préférer `unknown`
- Utiliser `env.ts` pour les variables d'environnement

### React
- Composants fonctionnels + hooks
- Lazy loading pour routes non-critiques
- Error boundaries pour robustesse
- Mémoization si nécessaire (`useMemo`, `useCallback`)

### Tests
- Tester comportements, pas implémentation
- Utiliser `renderWithProviders` pour tous les composants
- Mock data disponible dans `test-utils`
- Viser 70%+ de couverture

### Git
- Commits atomiques et descriptifs
- Branches features (`feature/nom`)
- PR avec description claire
- Tests passants avant merge

## 📚 Ressources

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [shadcn/ui](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query/)
- [Vitest](https://vitest.dev/)
