# Fix RLS - Ajout de user_id à la table devis

## Problème

Erreur : `la colonne « user_id » n'existe pas`

**Cause :** La table `devis` n'a pas de colonne `user_id` directement. Elle utilise `project_id` qui référence la table `projects`, qui elle-même a un `user_id`.

## Solution : Ajouter user_id à la table devis

### Étape 1 : Modifier le schéma de la table devis

Exécutez ce script SQL dans **SQL Editor** :

```sql
-- ========================================
-- AJOUT DE LA COLONNE user_id À LA TABLE devis
-- ========================================

-- 1. Ajouter la colonne user_id
ALTER TABLE public.devis
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Rendre project_id nullable (optionnel car on peut créer un devis sans projet)
ALTER TABLE public.devis
ALTER COLUMN project_id DROP NOT NULL;

-- 3. Ajouter une contrainte de clé étrangère vers users
ALTER TABLE public.devis
ADD CONSTRAINT devis_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 4. Migrer les données existantes (copier user_id depuis projects)
UPDATE public.devis
SET user_id = p.user_id
FROM public.projects p
WHERE devis.project_id = p.id
AND devis.user_id IS NULL;

-- 5. Rendre user_id obligatoire maintenant que les données sont migrées
ALTER TABLE public.devis
ALTER COLUMN user_id SET NOT NULL;

-- 6. Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_devis_user_id ON public.devis(user_id);

-- 7. Ajouter les colonnes manquantes pour le projet
ALTER TABLE public.devis
ADD COLUMN IF NOT EXISTS nom_projet TEXT;

ALTER TABLE public.devis
ADD COLUMN IF NOT EXISTS type_travaux TEXT;

ALTER TABLE public.devis
ADD COLUMN IF NOT EXISTS montant_total NUMERIC DEFAULT 0;

-- 8. Renommer 'amount' en 'montant_total' si elle existe déjà
-- (Ignorer l'erreur si 'amount' n'existe pas)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'devis'
        AND column_name = 'amount'
    ) THEN
        ALTER TABLE public.devis RENAME COLUMN amount TO montant_total;
    END IF;
END $$;
```

---

### Étape 2 : Configurer les politiques RLS

Maintenant que `user_id` existe, exécutez ce script :

```sql
-- ========================================
-- POLITIQUES RLS POUR STORAGE (devis-uploads)
-- ========================================

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

-- Activer RLS
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;

-- Supprimer anciennes politiques
DROP POLICY IF EXISTS "Users can insert their own devis" ON public.devis;
DROP POLICY IF EXISTS "Users can read their own devis" ON public.devis;
DROP POLICY IF EXISTS "Users can update their own devis" ON public.devis;
DROP POLICY IF EXISTS "Users can delete their own devis" ON public.devis;

-- Insert
CREATE POLICY "Users can insert their own devis"
ON public.devis FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Select
CREATE POLICY "Users can read their own devis"
ON public.devis FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Update
CREATE POLICY "Users can update their own devis"
ON public.devis FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Delete
CREATE POLICY "Users can delete their own devis"
ON public.devis FOR DELETE
TO authenticated
USING (user_id = auth.uid());
```

---

### Étape 3 : Vérification

```sql
-- Vérifier que user_id existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'devis'
AND column_name IN ('user_id', 'nom_projet', 'type_travaux', 'montant_total');

-- Devrait retourner :
-- user_id        | uuid    | NO
-- nom_projet     | text    | YES
-- type_travaux   | text    | YES
-- montant_total  | numeric | YES
```

---

## Alternative : Script complet en une seule fois

Copiez ce script complet et exécutez-le :

```sql
-- ========================================
-- MIGRATION COMPLÈTE : Ajout user_id + RLS
-- ========================================

-- Étape 1 : Modifier le schéma
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.devis ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS nom_projet TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS type_travaux TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS montant_total NUMERIC DEFAULT 0;

-- Renommer 'amount' si elle existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devis' AND column_name = 'amount') THEN
        ALTER TABLE public.devis RENAME COLUMN amount TO montant_total;
    END IF;
END $$;

-- Ajouter contrainte FK
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devis_user_id_fkey') THEN
        ALTER TABLE public.devis
        ADD CONSTRAINT devis_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Migrer données existantes
UPDATE public.devis
SET user_id = p.user_id
FROM public.projects p
WHERE devis.project_id = p.id AND devis.user_id IS NULL;

-- Rendre user_id obligatoire
ALTER TABLE public.devis ALTER COLUMN user_id SET NOT NULL;

-- Index
CREATE INDEX IF NOT EXISTS idx_devis_user_id ON public.devis(user_id);

-- Étape 2 : RLS Storage
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;

CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'devis-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow users to read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'devis-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow users to update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'devis-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'devis-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Étape 3 : RLS Table devis
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own devis" ON public.devis;
DROP POLICY IF EXISTS "Users can read their own devis" ON public.devis;
DROP POLICY IF EXISTS "Users can update their own devis" ON public.devis;
DROP POLICY IF EXISTS "Users can delete their own devis" ON public.devis;

CREATE POLICY "Users can insert their own devis"
ON public.devis FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read their own devis"
ON public.devis FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own devis"
ON public.devis FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own devis"
ON public.devis FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Étape 4 : Vérifications
SELECT 'Migration terminée !' as status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'devis' AND column_name IN ('user_id', 'nom_projet', 'type_travaux', 'montant_total');
```

---

## Explication

**Avant :**
```
devis → project_id → projects.user_id
```

**Après :**
```
devis → user_id (direct)
devis → project_id (optionnel)
```

**Avantages :**
- ✅ Pas besoin de créer un projet avant le devis
- ✅ Upload direct plus simple
- ✅ Politiques RLS plus simples
- ✅ `project_id` reste disponible si besoin

---

## Test après migration

```sql
-- Test d'insertion (devrait fonctionner)
INSERT INTO public.devis (
  user_id,
  nom_projet,
  type_travaux,
  montant_total,
  file_url,
  file_name,
  status
) VALUES (
  auth.uid(),
  'Test',
  'plomberie',
  0,
  'https://test.com/file.pdf',
  'test.pdf',
  'uploaded'
);

-- Vérifier l'insertion
SELECT id, user_id, nom_projet, status
FROM public.devis
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;
```

---

## Checklist

Après avoir exécuté le script :

- [ ] Colonne `user_id` existe dans la table `devis`
- [ ] Colonne `nom_projet` existe
- [ ] Colonne `type_travaux` existe
- [ ] Colonne `montant_total` existe
- [ ] `project_id` est nullable
- [ ] Contrainte FK `devis_user_id_fkey` existe
- [ ] RLS activé sur la table `devis`
- [ ] 4 politiques Storage créées
- [ ] 4 politiques table devis créées
- [ ] Test d'upload réussi dans l'application

---

## Support

Si vous avez des erreurs :

**Erreur : "column already exists"**
→ Normal, la colonne existe déjà. Le script gère ça avec `IF NOT EXISTS`.

**Erreur : "violates not-null constraint"**
→ Il y a des devis sans user_id. Exécutez d'abord la migration des données :
```sql
UPDATE public.devis
SET user_id = p.user_id
FROM public.projects p
WHERE devis.project_id = p.id AND devis.user_id IS NULL;
```

**Erreur : "constraint already exists"**
→ Normal, la contrainte existe déjà. Le script gère ça avec `IF NOT EXISTS`.
