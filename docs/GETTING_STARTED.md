# Guide de Démarrage - TORP

## 🚀 Installation

### Prérequis

- Node.js 18+ ([Installer avec nvm](https://github.com/nvm-sh/nvm))
- npm 9+ (inclus avec Node.js)
- Git

### Cloner le projet

```bash
git clone <YOUR_GIT_URL>
cd quote-insight-tally
```

### Installer les dépendances

```bash
npm install
```

### Configuration

1. **Variables d'environnement**

```bash
# Copier le template
cp .env.development.example .env

# Éditer si nécessaire (optionnel pour le développement local)
nano .env
```

Les valeurs par défaut sont suffisantes pour le développement local avec les services mockés.

2. **Vérifier la configuration**

```bash
# Vérifier que tout est OK
npm run lint
npm run test:run
```

## 💻 Développement

### Démarrer le serveur de dev

```bash
npm run dev
```

Le serveur démarre sur http://localhost:8080

### Mode avec lazy loading (recommandé)

Pour utiliser la version optimisée avec lazy loading :

```bash
# 1. Sauvegarder l'ancienne version
mv src/App.tsx src/App.old.tsx

# 2. Activer la nouvelle version
mv src/App.improved.tsx src/App.tsx

# 3. Redémarrer le serveur
npm run dev
```

### Scripts disponibles

```bash
npm run dev           # Serveur de développement
npm run build         # Build production
npm run build:dev     # Build développement
npm run preview       # Preview du build
npm run lint          # Vérifier le code
npm test              # Tests en mode watch
npm run test:ui       # Tests avec interface
npm run test:run      # Tests une fois
npm run test:coverage # Tests avec couverture
```

## 🧪 Tests

### Exécuter les tests

```bash
# Mode watch (recommandé en dev)
npm test

# Interface UI
npm run test:ui

# Une seule fois
npm run test:run

# Avec couverture
npm run test:coverage
```

### Écrire un nouveau test

```typescript
// src/components/MyComponent.test.tsx
import { renderWithProviders, screen } from '@/test/test-utils';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## 🏗️ Structure du Code

```
src/
├── components/     # Composants React
├── pages/          # Pages/Routes
├── services/       # Services API
├── context/        # État global
├── hooks/          # Custom hooks
├── types/          # Types TypeScript
├── config/         # Configuration
└── test/           # Utilitaires de test
```

## 🔐 Authentification (Mode Mock)

Par défaut, l'application utilise un service d'authentification mocké.

### Se connecter

1. Aller sur `/login`
2. Utiliser n'importe quel email (ex: `demo@torp.app`)
3. Mot de passe : minimum 6 caractères (ex: `password`)

### Types d'utilisateurs disponibles

- **B2C** (Particuliers) - email normal
- **B2B** (Entreprises) - email contenant "pro" (ex: `pro@example.com`)
- **B2G** (Collectivités)
- **B2B2C** (Prescripteurs)
- **Admin**

## 📝 Créer une Nouvelle Page

### 1. Créer le fichier de la page

```tsx
// src/pages/MyNewPage.tsx
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function MyNewPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold">Ma Nouvelle Page</h1>
      </main>
      <Footer />
    </div>
  );
}
```

### 2. Ajouter la route

```tsx
// src/App.tsx (ou App.improved.tsx)
import MyNewPage from './pages/MyNewPage';

// Dans <Routes>
<Route path="/my-new-page" element={<MyNewPage />} />

// Ou protégée
<Route
  path="/my-new-page"
  element={
    <ProtectedRoute>
      <MyNewPage />
    </ProtectedRoute>
  }
/>
```

### 3. Ajouter au lazy loading (App.improved.tsx)

```tsx
const MyNewPage = lazy(() => import('./pages/MyNewPage'));
```

## 🎨 Utiliser les Composants UI

### Import depuis shadcn/ui

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Titre</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="default">Cliquer</Button>
        <Badge variant="success">Nouveau</Badge>
      </CardContent>
    </Card>
  );
}
```

### 48 composants disponibles

Alert, Avatar, Badge, Button, Calendar, Card, Checkbox, Dialog, Dropdown, Form, Input, Select, Table, Toast, Tooltip, etc.

Voir la liste complète : `src/components/ui/`

## 🔌 Utiliser les Services API

### Exemple : Upload de devis

```tsx
import { services } from '@/services/api';
import { useState } from 'react';

function UploadDevis() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const result = await services.devis.uploadDevis(file);
      console.log('Upload success:', result);

      // Obtenir l'analyse
      const analysis = await services.devis.getAnalysis(result.id);
      console.log('Analysis:', analysis);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? 'Upload...' : 'Upload Devis'}
      </button>
    </div>
  );
}
```

## 🌍 Variables d'Environnement

### Modifier la configuration

```bash
# .env (local, gitignored)
VITE_APP_NAME=TORP
VITE_API_BASE_URL=http://localhost:3000/api
VITE_MOCK_API=true
VITE_DEBUG_MODE=true
VITE_FEATURE_PAYMENT_ENABLED=true
```

### Utiliser dans le code

```typescript
import { env } from '@/config/env';

console.log(env.app.name);              // 'TORP'
console.log(env.api.useMock);           // true
console.log(env.features.chatAIEnabled); // true

if (env.app.debugMode) {
  console.log('Debug info...');
}
```

## 🐛 Debugging

### React DevTools

Installer l'extension Chrome/Firefox : [React DevTools](https://react.dev/learn/react-developer-tools)

### Activer le mode debug

```bash
# Dans .env
VITE_DEBUG_MODE=true
```

Affiche les logs de configuration au démarrage.

### Inspecteur de requêtes

Utiliser TanStack Query DevTools (déjà intégré) :
- Affiche automatiquement en dev
- Montre toutes les requêtes en cours
- Cache inspection

## 📚 Ressources Utiles

### Documentation Officielle
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)

### Outils de Développement
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [TanStack Query DevTools](https://tanstack.com/query/latest/docs/framework/react/devtools)

## ❓ Problèmes Courants

### Port 8080 déjà utilisé

```bash
# Changer le port dans vite.config.ts
server: {
  port: 3000, // Au lieu de 8080
}
```

### Erreurs de type TypeScript

```bash
# Vérifier la configuration
npx tsc --noEmit

# Redémarrer le serveur
npm run dev
```

### Tests qui échouent

```bash
# Nettoyer et réinstaller
rm -rf node_modules
npm install
npm run test:run
```

## 🆘 Support

- **Issues GitHub** : [Créer une issue](https://github.com/your-repo/issues)
- **Documentation** : `docs/`
- **Architecture** : `docs/ARCHITECTURE.md`

## 🎯 Prochaines Étapes

1. ✅ Configuration terminée
2. ✅ Serveur de dev qui tourne
3. ✅ Tests qui passent

Prêt à développer ! 🚀

### Suggestions :
- Lire `docs/ARCHITECTURE.md` pour comprendre l'architecture
- Explorer les composants UI dans `src/components/ui/`
- Tester les différents dashboards (B2C, B2B, B2G)
- Créer votre première page personnalisée
