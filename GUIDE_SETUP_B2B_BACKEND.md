# 🚀 Guide de Configuration Backend B2B - Étape par Étape

> **Guide complet pour configurer le backend du module B2B TORP**

---

## ✅ Étape 1 : Vérifier la Migration SQL (FAIT)

Tu as déjà appliqué la migration `007_b2b_pro_module.sql`. Vérifions que tout est OK.

### 1.1 Vérifier que les tables existent

Dans **Supabase Dashboard > SQL Editor**, exécute cette requête :

```sql
-- Vérifier les tables B2B
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'pro_company_profiles',
  'company_documents',
  'pro_devis_analyses',
  'ticket_tracking_events'
)
ORDER BY table_name;
```

**Résultat attendu :** 4 lignes (les 4 tables)

### 1.2 Vérifier les RLS policies

```sql
-- Vérifier les policies RLS
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
  'pro_company_profiles',
  'company_documents',
  'pro_devis_analyses',
  'ticket_tracking_events'
)
ORDER BY tablename, policyname;
```

**Résultat attendu :** Environ 20 policies

### 1.3 Vérifier les fonctions

```sql
-- Vérifier les fonctions SQL
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'generate_ticket_code',
  'increment_ticket_view_count',
  'calculate_grade_from_score'
);
```

**Résultat attendu :** 3 fonctions

### 1.4 Tester les fonctions

```sql
-- Test 1 : Générer un code ticket
SELECT generate_ticket_code();
-- Résultat attendu : "TORP-ABC123XY" (8 caractères aléatoires)

-- Test 2 : Calculer un grade
SELECT calculate_grade_from_score(870);
-- Résultat attendu : "A-"

SELECT calculate_grade_from_score(950);
-- Résultat attendu : "A+"

SELECT calculate_grade_from_score(600);
-- Résultat attendu : "C"
```

✅ **Si tous les tests passent, la migration est OK !**

---

## 🗂️ Étape 2 : Créer les Buckets Storage

### 2.1 Appliquer la migration Storage

J'ai créé le fichier `supabase/008_storage_buckets_b2b.sql`.

**Dans Supabase Dashboard > SQL Editor :**

1. Clique sur **"New query"**
2. Copie-colle le contenu du fichier `supabase/008_storage_buckets_b2b.sql`
3. Clique sur **"Run"** (ou Ctrl+Enter)

### 2.2 Vérifier les buckets

```sql
-- Vérifier que les 3 buckets sont créés
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('company-documents', 'devis-analyses', 'tickets-torp');
```

**Résultat attendu :**

| id | name | public | file_size_limit |
|----|------|--------|-----------------|
| company-documents | company-documents | false | 10485760 |
| devis-analyses | devis-analyses | false | 10485760 |
| tickets-torp | tickets-torp | true | 5242880 |

### 2.3 Vérifier les policies Storage

```sql
-- Vérifier les policies Storage
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
ORDER BY policyname;
```

**Résultat attendu :** Environ 12 policies pour les 3 buckets

✅ **Les buckets sont configurés !**

---

## 🔑 Étape 3 : Configurer les Variables d'Environnement

### 3.1 Récupérer les clés Supabase

Dans **Supabase Dashboard > Settings > API** :

- **Project URL :** `https://your-project.supabase.co`
- **anon public key :** `eyJhbGciOi...` (longue clé)
- **service_role key :** `eyJhbGciOi...` (à ne PAS exposer côté client)

### 3.2 Créer/Modifier le fichier `.env`

Dans la racine du projet :

```bash
# Copier l'exemple si nécessaire
cp .env.example .env
```

Ajoute/modifie ces lignes dans `.env` :

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Module B2B
VITE_B2B_ENABLED=true

# API Externe pour vérification SIRET (optionnel pour l'instant)
# VITE_PAPPERS_API_KEY=your-pappers-api-key
```

⚠️ **Important :** Ne committe JAMAIS le fichier `.env` ! Il doit être dans `.gitignore`.

### 3.3 Vérifier que Supabase est configuré

Vérifie que le fichier `src/lib/supabase.ts` existe. Sinon, créons-le :

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

✅ **Les variables d'environnement sont configurées !**

---

## 💻 Étape 4 : Implémenter les Services API

Maintenant on va implémenter les 3 services API.

### 4.1 Service companyService.ts

Ce service gère les profils entreprise.

**Fichier :** `src/services/api/pro/companyService.ts`

Je vais créer l'implémentation complète pour toi.

### 4.2 Service documentService.ts

Ce service gère l'upload et la gestion des documents.

**Fichier :** `src/services/api/pro/documentService.ts`

### 4.3 Service analysisService.ts

Ce service gère les analyses de devis.

**Fichier :** `src/services/api/pro/analysisService.ts`

---

## 🧪 Étape 5 : Tester les Services

Une fois les services implémentés, on va créer des tests basiques.

### 5.1 Test companyService

```typescript
// Test dans la console du navigateur
import { getCompanyProfile, createCompanyProfile } from '@/services/api/pro/companyService';

// Créer un profil
const profile = await createCompanyProfile({
  siret: '12345678901234',
  siren: '123456789',
  raison_sociale: 'Test Entreprise',
  email: 'test@entreprise.fr',
});
console.log('Profile créé:', profile);

// Récupérer le profil
const myProfile = await getCompanyProfile();
console.log('Mon profil:', myProfile);
```

### 5.2 Test documentService

```typescript
import { uploadCompanyDocument } from '@/services/api/pro/documentService';

// Upload d'un document (dans un formulaire)
const file = document.getElementById('file-input').files[0];
const doc = await uploadCompanyDocument({
  company_id: 'uuid-du-company',
  type: 'KBIS',
  nom: 'Kbis 2024',
  file: file,
});
console.log('Document uploadé:', doc);
```

---

## 📋 Récapitulatif des Étapes

### ✅ Étapes Complétées
- [x] Migration SQL appliquée (007)
- [ ] Buckets Storage créés (008)
- [ ] Variables d'environnement configurées
- [ ] Services API implémentés
- [ ] Tests basiques effectués

### 🔜 Prochaines Étapes (après services)
1. Créer les composants UI
2. Implémenter les pages React
3. Configurer le routing
4. Intégrer l'API de vérification SIRET
5. Développer le service d'analyse IA
6. Créer le générateur de tickets PDF + QR

---

## 🆘 Troubleshooting

### Erreur : "relation does not exist"
**Solution :** La migration SQL n'a pas été appliquée correctement. Re-exécute le fichier `007_b2b_pro_module.sql`.

### Erreur : "bucket does not exist"
**Solution :** Les buckets n'ont pas été créés. Exécute le fichier `008_storage_buckets_b2b.sql`.

### Erreur : "permission denied for table"
**Solution :** Les RLS policies ne sont pas correctes. Vérifie que tu es connecté avec un utilisateur authentifié.

### Erreur : "Missing Supabase environment variables"
**Solution :** Vérifie que ton fichier `.env` contient les bonnes clés et que le serveur est redémarré.

---

## 📞 Support

Si tu bloques à une étape, n'hésite pas à demander ! Je peux :
- Débugger les erreurs SQL
- T'aider à configurer Supabase
- Implémenter les services API
- Créer les composants UI

**Prochaine étape recommandée :** Applique la migration Storage (`008_storage_buckets_b2b.sql`), puis on implémente les services API ensemble ! 🚀
