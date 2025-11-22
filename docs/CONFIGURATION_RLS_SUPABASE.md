# Configuration Row Level Security (RLS) - Supabase

Ce guide explique comment configurer les politiques RLS pour corriger l'erreur "new row violated row-level security policy" lors de l'upload de devis.

## Problème

Erreur lors de l'analyse de devis :
```
Failed to upload file: new row violated row-level security policy
```

**Cause :** Les politiques RLS (Row Level Security) ne permettent pas aux utilisateurs d'uploader des fichiers ou d'insérer des enregistrements dans la base de données.

---

## Solution Complète

### 1. Configuration du Storage Bucket `devis-uploads`

#### A. Créer le bucket (si pas déjà fait)

1. Allez sur le dashboard Supabase : https://app.supabase.com
2. Sélectionnez votre projet
3. **Storage → Create a new bucket**
4. Nom : `devis-uploads`
5. ✅ **Public bucket** : OFF (privé)
6. Cliquez "Create bucket"

#### B. Configurer les politiques RLS pour Storage

1. Cliquez sur le bucket `devis-uploads`
2. Allez dans l'onglet **Policies**
3. Cliquez **"New Policy"**

**Politique 1 : Upload (INSERT)**
```sql
-- Nom : Allow authenticated users to upload files
-- Operation : INSERT
-- Target roles : authenticated

CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Politique 2 : Read (SELECT)**
```sql
-- Nom : Allow users to read their own files
-- Operation : SELECT
-- Target roles : authenticated

CREATE POLICY "Allow users to read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Politique 3 : Update (UPDATE)**
```sql
-- Nom : Allow users to update their own files
-- Operation : UPDATE
-- Target roles : authenticated

CREATE POLICY "Allow users to update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Politique 4 : Delete (DELETE)**
```sql
-- Nom : Allow users to delete their own files
-- Operation : DELETE
-- Target roles : authenticated

CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

### 2. Configuration RLS pour la table `devis`

#### Vérifier si RLS est activé

1. Allez sur **Database → Tables**
2. Sélectionnez la table `devis`
3. ✅ Vérifiez que **"Enable RLS"** est activé

#### Créer les politiques pour la table `devis`

**Politique 1 : Insert (INSERT)**
```sql
-- Nom : Users can insert their own devis
-- Operation : INSERT
-- Target roles : authenticated

CREATE POLICY "Users can insert their own devis"
ON public.devis FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);
```

**Politique 2 : Select (SELECT)**
```sql
-- Nom : Users can read their own devis
-- Operation : SELECT
-- Target roles : authenticated

CREATE POLICY "Users can read their own devis"
ON public.devis FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);
```

**Politique 3 : Update (UPDATE)**
```sql
-- Nom : Users can update their own devis
-- Operation : UPDATE
-- Target roles : authenticated

CREATE POLICY "Users can update their own devis"
ON public.devis FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);
```

**Politique 4 : Delete (DELETE)**
```sql
-- Nom : Users can delete their own devis
-- Operation : DELETE
-- Target roles : authenticated

CREATE POLICY "Users can delete their own devis"
ON public.devis FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
);
```

---

### 3. Script SQL Complet (via SQL Editor)

Pour gagner du temps, vous pouvez exécuter ce script SQL complet :

```sql
-- ========================================
-- POLITIQUES RLS POUR STORAGE (devis-uploads)
-- ========================================

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;

-- Upload
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Read
CREATE POLICY "Allow users to read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Update
CREATE POLICY "Allow users to update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete
CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);


-- ========================================
-- POLITIQUES RLS POUR TABLE devis
-- ========================================

-- Activer RLS si pas déjà fait
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can insert their own devis" ON public.devis;
DROP POLICY IF EXISTS "Users can read their own devis" ON public.devis;
DROP POLICY IF EXISTS "Users can update their own devis" ON public.devis;
DROP POLICY IF EXISTS "Users can delete their own devis" ON public.devis;

-- Insert
CREATE POLICY "Users can insert their own devis"
ON public.devis FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- Select
CREATE POLICY "Users can read their own devis"
ON public.devis FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Update
CREATE POLICY "Users can update their own devis"
ON public.devis FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- Delete
CREATE POLICY "Users can delete their own devis"
ON public.devis FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
);
```

---

### 4. Comment exécuter le script SQL

1. Allez sur **SQL Editor** dans le dashboard Supabase
2. Cliquez **"New Query"**
3. Copiez-collez le script SQL complet ci-dessus
4. Cliquez **"Run"** (ou Ctrl+Enter)
5. ✅ Vérifiez qu'il n'y a pas d'erreurs

---

### 5. Vérification des politiques

#### A. Vérifier Storage

1. **Storage → devis-uploads → Policies**
2. Vous devez voir 4 politiques :
   - ✅ Allow authenticated users to upload files (INSERT)
   - ✅ Allow users to read their own files (SELECT)
   - ✅ Allow users to update their own files (UPDATE)
   - ✅ Allow users to delete their own files (DELETE)

#### B. Vérifier Table devis

1. **Database → Tables → devis → Policies**
2. Vous devez voir 4 politiques :
   - ✅ Users can insert their own devis (INSERT)
   - ✅ Users can read their own devis (SELECT)
   - ✅ Users can update their own devis (UPDATE)
   - ✅ Users can delete their own devis (DELETE)

---

### 6. Test de la configuration

#### Test 1 : Upload d'un fichier
```typescript
// Devrait fonctionner maintenant
const { data, error } = await supabase.storage
  .from('devis-uploads')
  .upload(`${userId}/test.pdf`, file);

console.log('Upload success:', data);
console.log('Upload error:', error); // Should be null
```

#### Test 2 : Insert dans la table devis
```typescript
// Devrait fonctionner maintenant
const { data, error } = await supabase
  .from('devis')
  .insert({
    user_id: userId,
    nom_projet: 'Test',
    file_url: 'https://...',
    // ...
  });

console.log('Insert success:', data);
console.log('Insert error:', error); // Should be null
```

---

### 7. Structure des fichiers dans Storage

Les fichiers sont organisés par utilisateur :
```
devis-uploads/
├── user-uuid-1/
│   ├── 1234567890_devis.pdf
│   └── 1234567891_facture.pdf
├── user-uuid-2/
│   └── 1234567892_devis.pdf
└── ...
```

**Format du path :**
```
${userId}/${timestamp}_${fileName}
```

**Exemple :**
```
a1b2c3d4-e5f6-7890-abcd-ef1234567890/1700000000_devis-cuisine.pdf
```

---

### 8. Politiques pour Admin (Optionnel)

Si vous avez des admins qui doivent voir tous les devis :

```sql
-- Admin peut tout voir
CREATE POLICY "Admins can read all devis"
ON public.devis FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.user_type = 'admin'
  )
);

-- Admin peut tout modifier
CREATE POLICY "Admins can update all devis"
ON public.devis FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.user_type = 'admin'
  )
);
```

---

## Debugging

### Erreur : "new row violated row-level security policy"

**Vérifications :**
1. ✅ RLS est activé sur la table
2. ✅ Les politiques INSERT existent
3. ✅ L'utilisateur est authentifié (`auth.uid()` n'est pas null)
4. ✅ Le `user_id` dans l'insert correspond à `auth.uid()`

**Test SQL direct :**
```sql
-- Tester si l'utilisateur peut insérer
SELECT auth.uid(); -- Doit retourner votre user ID

-- Tester l'insert
INSERT INTO public.devis (user_id, nom_projet, montant_total)
VALUES (auth.uid(), 'Test', 0);
-- Si erreur RLS, les politiques ne sont pas correctes
```

### Erreur : "permission denied for table devis"

**Cause :** RLS est désactivé ou les rôles ne sont pas corrects

**Solution :**
```sql
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.devis TO authenticated;
```

---

## Checklist de configuration

- [ ] Bucket `devis-uploads` créé
- [ ] Bucket en mode privé (non public)
- [ ] 4 politiques Storage créées (INSERT, SELECT, UPDATE, DELETE)
- [ ] RLS activé sur table `devis`
- [ ] 4 politiques table devis créées (INSERT, SELECT, UPDATE, DELETE)
- [ ] Script SQL exécuté sans erreurs
- [ ] Test d'upload réussi
- [ ] Analyse de devis fonctionne

---

## Support

Si vous rencontrez toujours des erreurs :

1. Vérifiez les logs Supabase : **Logs → Postgres Logs**
2. Cherchez les erreurs RLS
3. Vérifiez que l'utilisateur est bien authentifié
4. Testez avec le SQL Editor directement

---

## Sécurité

Les politiques RLS garantissent que :
- ✅ Chaque utilisateur ne peut voir que ses propres devis
- ✅ Chaque utilisateur ne peut uploader que dans son dossier
- ✅ Impossible de voir/modifier les fichiers d'autres utilisateurs
- ✅ Les admins peuvent avoir des permissions étendues

**Structure de sécurité :**
```
Storage: /devis-uploads/${auth.uid()}/fichier.pdf
Database: devis.user_id = auth.uid()
```
