# 🗂️ Configuration Storage B2B - Guide Pas à Pas

> **Création des buckets via l'interface Supabase Dashboard**

---

## ⚠️ Note importante

Les buckets Storage ne peuvent PAS être créés via SQL dans Supabase. Il faut utiliser le Dashboard.

---

## 📋 ÉTAPE 1 : Créer les 3 Buckets

### 1.1 Accéder à Storage

1. Va sur **Supabase Dashboard**
2. Sélectionne ton projet
3. Dans la barre latérale gauche, clique sur **"Storage"**
4. Clique sur **"New bucket"** (bouton vert en haut à droite)

---

### 1.2 Bucket 1 : company-documents (Privé)

**Configuration :**

| Champ | Valeur |
|-------|--------|
| **Name** | `company-documents` |
| **Public bucket** | ❌ **Décoché** (privé) |
| **File size limit** | `10` MB |
| **Allowed MIME types** | `application/pdf, image/jpeg, image/png, image/jpg` |

Clique sur **"Create bucket"** ✅

---

### 1.3 Bucket 2 : devis-analyses (Privé)

Clique à nouveau sur **"New bucket"**

**Configuration :**

| Champ | Valeur |
|-------|--------|
| **Name** | `devis-analyses` |
| **Public bucket** | ❌ **Décoché** (privé) |
| **File size limit** | `10` MB |
| **Allowed MIME types** | `application/pdf, image/jpeg, image/png, image/jpg` |

Clique sur **"Create bucket"** ✅

---

### 1.4 Bucket 3 : tickets-torp (Public)

Clique à nouveau sur **"New bucket"**

**Configuration :**

| Champ | Valeur |
|-------|--------|
| **Name** | `tickets-torp` |
| **Public bucket** | ✅ **Coché** (public) |
| **File size limit** | `5` MB |
| **Allowed MIME types** | `application/pdf, image/png, image/svg+xml` |

Clique sur **"Create bucket"** ✅

---

## ✅ Vérification

Tu devrais maintenant voir 3 buckets dans la liste :

```
📁 company-documents   🔒 Private   10 MB
📁 devis-analyses      🔒 Private   10 MB
📁 tickets-torp        🌐 Public     5 MB
```

---

## 📋 ÉTAPE 2 : Appliquer les Policies RLS

Maintenant, on va ajouter les policies de sécurité via SQL.

### 2.1 Copier le script SQL suivant

Va dans **Supabase Dashboard > SQL Editor > New query**

Copie-colle ce script complet :

```sql
-- =====================================================
-- POLICIES RLS POUR STORAGE B2B
-- =====================================================

-- ==========================================
-- POLICIES: company-documents (Privé)
-- ==========================================

-- Les utilisateurs peuvent lister leurs propres documents
CREATE POLICY "Users can list their company documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent uploader des documents dans leur dossier
CREATE POLICY "Users can upload their company documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent mettre à jour leurs documents
CREATE POLICY "Users can update their company documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent supprimer leurs documents
CREATE POLICY "Users can delete their company documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==========================================
-- POLICIES: devis-analyses (Privé)
-- ==========================================

-- Les utilisateurs peuvent lister leurs propres devis
CREATE POLICY "Users can list their devis"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'devis-analyses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent uploader des devis dans leur dossier
CREATE POLICY "Users can upload their devis"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'devis-analyses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent mettre à jour leurs devis
CREATE POLICY "Users can update their devis"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'devis-analyses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent supprimer leurs devis
CREATE POLICY "Users can delete their devis"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'devis-analyses'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==========================================
-- POLICIES: tickets-torp (Public)
-- ==========================================

-- Tout le monde peut voir les tickets (bucket public)
CREATE POLICY "Anyone can view tickets"
ON storage.objects FOR SELECT
USING (bucket_id = 'tickets-torp');

-- Seuls les utilisateurs authentifiés peuvent uploader des tickets
CREATE POLICY "Authenticated users can upload tickets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tickets-torp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent mettre à jour leurs tickets
CREATE POLICY "Users can update their tickets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tickets-torp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Les utilisateurs peuvent supprimer leurs tickets
CREATE POLICY "Users can delete their tickets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tickets-torp'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==========================================
-- VÉRIFICATION
-- ==========================================

-- Pour vérifier que les policies sont créées
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
ORDER BY policyname;
```

### 2.2 Exécuter le script

Clique sur **"Run"** (ou Ctrl+Enter)

✅ **Résultat attendu :** "Success. No rows returned"

---

## 📊 ÉTAPE 3 : Vérification complète

### 3.1 Vérifier les buckets

```sql
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

### 3.2 Vérifier les policies

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
ORDER BY policyname;
```

**Résultat attendu :** 12 policies (4 par bucket)

---

## ✅ Configuration Terminée !

Tu peux maintenant :
- ✅ Uploader des documents entreprise
- ✅ Uploader des devis pour analyse
- ✅ Générer des tickets TORP

---

## 🧪 Test rapide (optionnel)

### Test d'upload dans la console

```javascript
import { supabase } from '@/lib/supabase';

// Créer un fichier de test
const testFile = new File(['Hello TORP!'], 'test.txt', { type: 'text/plain' });

// Test upload dans company-documents
const { data, error } = await supabase.storage
  .from('company-documents')
  .upload(`${user.id}/test-${Date.now()}.txt`, testFile);

console.log('Upload résultat:', { data, error });

// Si ça marche, supprimer le fichier de test
if (data) {
  await supabase.storage
    .from('company-documents')
    .remove([data.path]);
  console.log('✅ Storage configuré correctement !');
}
```

---

## 🆘 Troubleshooting

### Erreur : "Bucket not found"
**Solution :** Vérifie que tu as bien créé les 3 buckets via le Dashboard.

### Erreur : "Policy already exists"
**Solution :** Normal si tu as déjà exécuté le script. Ignore l'erreur ou supprime les policies existantes avant.

Pour supprimer une policy existante :
```sql
DROP POLICY IF EXISTS "policy_name" ON storage.objects;
```

### Erreur : "Permission denied"
**Solution :** Vérifie que tu es bien connecté avec un utilisateur authentifié.

---

## 📞 Prochaine Étape

Une fois les buckets configurés :
- ✅ Les services API sont déjà implémentés
- ✅ Les variables d'environnement sont configurées (Vercel)
- 🎨 On peut passer à la création des composants UI !

---

**Tu es maintenant prêt à tester les services API ! 🚀**
