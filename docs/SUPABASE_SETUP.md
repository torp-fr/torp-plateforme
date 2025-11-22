# 🔌 Guide de Setup Supabase - TORP

## 📋 Vue d'ensemble

Ce guide vous accompagne dans la configuration complète de Supabase pour TORP, incluant :
- Création du projet Supabase
- Application du schéma de base de données
- Configuration de l'authentification
- Configuration du stockage de fichiers
- Intégration dans l'application React

---

## 🚀 Étape 1 : Créer un Projet Supabase

### 1.1 Créer un compte
1. Aller sur [https://supabase.com](https://supabase.com)
2. Cliquer sur "Start your project"
3. Se connecter avec GitHub (recommandé)

### 1.2 Créer un nouveau projet
1. Cliquer sur "New Project"
2. Renseigner :
   - **Name** : `torp-production` (ou `torp-dev` pour dev)
   - **Database Password** : Générer un mot de passe fort (le noter !)
   - **Region** : `Europe (Frankfurt)` ou `Europe (Paris)` pour RGPD
   - **Pricing Plan** : Free (ou Pro selon besoins)
3. Cliquer sur "Create new project"
4. Attendre 2-3 minutes que le projet soit créé

### 1.3 Récupérer les credentials
Une fois le projet créé, aller dans **Settings > API** :

- **Project URL** : `https://xxxxx.supabase.co`
- **anon public** key : `eyJhbG...` (clé publique)
- **service_role** key : `eyJhbG...` (clé privée, NE PAS exposer)

**Les noter quelque part de sûr !**

---

## 🗄️ Étape 2 : Appliquer le Schéma de Base de Données

### 2.1 Via l'interface Supabase (Recommandé)

1. Dans votre projet Supabase, aller dans **SQL Editor**
2. Cliquer sur "New query"
3. Copier le contenu de `supabase/migrations/001_initial_schema.sql`
4. Coller dans l'éditeur
5. Cliquer sur "Run" (en bas à droite)
6. Attendre quelques secondes
7. Vérifier dans **Table Editor** que les tables sont créées

**Tables créées** :
- `users`
- `companies`
- `projects`
- `devis`
- `payments`
- `notifications`
- `market_data`
- `activity_logs`

### 2.2 Via Supabase CLI (Alternatif)

```bash
# Installer Supabase CLI
npm install -g supabase

# Se connecter
supabase login

# Lier au projet
supabase link --project-ref xxxxx

# Appliquer les migrations
supabase db push
```

### 2.3 Vérifier que tout fonctionne

Dans **SQL Editor**, exécuter :

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Vous devriez voir les 8 tables listées.

---

## 🔐 Étape 3 : Configurer l'Authentification

### 3.1 Configuration Email/Password

1. Aller dans **Authentication > Providers**
2. **Email** : Activer si pas déjà fait
3. **Confirm email** : Désactiver pour dev, activer pour prod
4. **Secure email change** : Activer
5. Sauvegarder

### 3.2 Configuration OAuth (Optionnel)

Pour **Google OAuth** :
1. Aller sur [Google Cloud Console](https://console.cloud.google.com)
2. Créer un nouveau projet
3. Activer "Google+ API"
4. Créer des credentials OAuth 2.0
5. Ajouter redirect URI : `https://xxxxx.supabase.co/auth/v1/callback`
6. Copier Client ID et Client Secret
7. Dans Supabase : **Authentication > Providers > Google**
8. Coller Client ID et Secret
9. Activer

Même processus pour **GitHub OAuth** si souhaité.

### 3.3 Configuration Email Templates

1. Aller dans **Authentication > Email Templates**
2. Personnaliser les templates :
   - **Confirm signup** : Email de vérification
   - **Invite user** : Invitation
   - **Magic Link** : Connexion sans mot de passe
   - **Change Email Address** : Changement d'email
   - **Reset Password** : Réinitialisation

Exemple de template personnalisé :

```html
<h2>Bienvenue sur TORP !</h2>
<p>Cliquez sur le lien ci-dessous pour confirmer votre email :</p>
<p><a href="{{ .ConfirmationURL }}">Confirmer mon email</a></p>
<p>Ce lien expire dans 24 heures.</p>
```

---

## 📁 Étape 4 : Configurer le Storage

### 4.1 Créer les buckets

1. Aller dans **Storage**
2. Cliquer sur "Create a new bucket"
3. Créer 2 buckets :

**Bucket : devis-uploads**
- Name : `devis-uploads`
- Public : ❌ Non (privé)
- File size limit : 10 MB
- Allowed MIME types : `application/pdf, image/jpeg, image/png`

**Bucket : company-documents**
- Name : `company-documents`
- Public : ❌ Non (privé)
- File size limit : 5 MB
- Allowed MIME types : `application/pdf, image/jpeg, image/png`

### 4.2 Configurer les Policies

Pour chaque bucket, aller dans **Policies** et ajouter :

```sql
-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload devis"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'devis-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can read their own files
CREATE POLICY "Users can read their devis"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'devis-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete their devis"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'devis-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## ⚙️ Étape 5 : Configuration de l'Application

### 5.1 Installer les dépendances

```bash
npm install @supabase/supabase-js
```

### 5.2 Configurer les variables d'environnement

Créer `.env.local` :

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5.3 Créer le client Supabase

Le fichier `src/lib/supabase.ts` a déjà été créé et configure le client.

### 5.4 Mettre à jour env.ts

Dans `.env` :

```bash
VITE_AUTH_PROVIDER=supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
VITE_MOCK_API=false
```

---

## ✅ Étape 6 : Tester l'Installation

### 6.1 Test de connexion

```typescript
import { supabase } from '@/lib/supabase';

// Tester la connexion
const { data, error } = await supabase.from('users').select('count');
console.log('Connection OK:', data);
```

### 6.2 Test d'authentification

```typescript
// Inscription
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'password123',
  options: {
    data: {
      name: 'Test User',
      user_type: 'B2C'
    }
  }
});

// Connexion
const { data: { user }, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'password123'
});
```

### 6.3 Test d'upload

```typescript
const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

const { data, error } = await supabase.storage
  .from('devis-uploads')
  .upload(`${user.id}/test.pdf`, file);
```

---

## 🔒 Étape 7 : Sécurité & Production

### 7.1 Row Level Security (RLS)

✅ Déjà configuré dans le schéma SQL
- Les utilisateurs ne voient que leurs données
- Les policies sont appliquées automatiquement

### 7.2 API Rate Limiting

Dans **Settings > API** :
- Configurer les limites de requêtes
- Par défaut : 200 req/sec en Free tier

### 7.3 Backup

Dans **Settings > Database** :
- Activer les backups automatiques (Pro plan)
- Ou faire des backups manuels via `pg_dump`

### 7.4 Monitoring

Dans **Reports** :
- Dashboard de monitoring
- Queries lentes
- Erreurs
- Utilisation

---

## 📊 Schéma de la Base de Données

```
users (auth)
  ├─ projects
  │   ├─ devis
  │   └─ payments
  ├─ notifications
  └─ activity_logs

companies
  ├─ devis
  └─ projects

market_data (référence publique)
```

### Cardinalités

- 1 user → N projects
- 1 project → N devis
- 1 project → N payments
- 1 company → N devis
- 1 company → N projects

---

## 🐛 Troubleshooting

### Problème : Migration échoue

**Erreur** : `relation "xxx" already exists`

**Solution** : Drop et recréer
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Puis réexécuter la migration
```

### Problème : RLS bloque les requêtes

**Erreur** : `new row violates row-level security policy`

**Solution** : Vérifier que l'utilisateur est bien authentifié
```typescript
const { data: { user } } = await supabase.auth.getUser();
console.log('Authenticated as:', user?.id);
```

### Problème : Storage upload échoue

**Erreur** : `new row violates row-level security policy`

**Solution** : Vérifier les policies du bucket et la structure du path
```typescript
// Correct path format
`${user.id}/devis/${filename}`
```

---

## 📚 Ressources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✅ Checklist d'Installation

- [ ] Projet Supabase créé
- [ ] Credentials notées (URL + anon key)
- [ ] Schéma SQL appliqué (8 tables créées)
- [ ] Authentication configurée (Email + OAuth optionnel)
- [ ] Storage buckets créés (devis-uploads, company-documents)
- [ ] Storage policies configurées
- [ ] Variables d'environnement configurées (.env)
- [ ] Dépendance @supabase/supabase-js installée
- [ ] Client Supabase créé (src/lib/supabase.ts)
- [ ] Tests de connexion OK
- [ ] Tests d'auth OK
- [ ] Tests d'upload OK

---

**Bravo ! Votre backend Supabase est prêt ! 🎉**

Prochaine étape : Remplacer les services mockés par les vrais services Supabase.
