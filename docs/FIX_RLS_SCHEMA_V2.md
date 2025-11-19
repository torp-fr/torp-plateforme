# Script SQL Corrigé - Migration RLS avec gestion des colonnes existantes

## Script SQL Complet et Corrigé

**Copiez ce script et exécutez-le dans SQL Editor :**

```sql
-- ========================================
-- MIGRATION COMPLÈTE : Ajout user_id + RLS (Version corrigée)
-- ========================================

-- Étape 1 : Modifier le schéma
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS nom_projet TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS type_travaux TEXT;
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS montant_total NUMERIC DEFAULT 0;

-- Rendre project_id nullable si pas déjà fait
DO $$
BEGIN
    ALTER TABLE public.devis ALTER COLUMN project_id DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN NULL; -- Ignorer si déjà nullable
END $$;

-- Supprimer la colonne 'amount' si elle existe ET que montant_total existe déjà
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'devis' AND column_name = 'amount'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'devis' AND column_name = 'montant_total'
    ) THEN
        -- Les deux existent : copier les données si montant_total est vide
        UPDATE public.devis
        SET montant_total = amount
        WHERE montant_total IS NULL OR montant_total = 0;

        -- Supprimer amount
        ALTER TABLE public.devis DROP COLUMN amount;
    END IF;

    -- Si seul amount existe (et pas montant_total), le renommer
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'devis' AND column_name = 'amount'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'devis' AND column_name = 'montant_total'
    ) THEN
        ALTER TABLE public.devis RENAME COLUMN amount TO montant_total;
    END IF;
END $$;

-- Ajouter la colonne points_forts si elle n'existe pas
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS points_forts JSONB;

-- Ajouter la colonne points_vigilance si elle n'existe pas
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS points_vigilance JSONB;

-- Ajouter la colonne recommandations si elle n'existe pas
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS recommandations JSONB;

-- Ajouter la colonne comparaison_prix si elle n'existe pas
ALTER TABLE public.devis ADD COLUMN IF NOT EXISTS comparaison_prix JSONB;

-- Ajouter contrainte FK pour user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'devis_user_id_fkey'
    ) THEN
        ALTER TABLE public.devis
        ADD CONSTRAINT devis_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Migrer les données existantes (copier user_id depuis projects si project_id existe)
UPDATE public.devis
SET user_id = p.user_id
FROM public.projects p
WHERE devis.project_id = p.id
AND devis.user_id IS NULL;

-- Rendre user_id obligatoire seulement si toutes les lignes ont un user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.devis WHERE user_id IS NULL
    ) THEN
        ALTER TABLE public.devis ALTER COLUMN user_id SET NOT NULL;
    ELSE
        RAISE NOTICE 'Attention: Il y a des devis sans user_id. Corrigez-les avant de rendre la colonne NOT NULL.';
    END IF;
END $$;

-- Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_devis_user_id ON public.devis(user_id);
CREATE INDEX IF NOT EXISTS idx_devis_status ON public.devis(status);
CREATE INDEX IF NOT EXISTS idx_devis_created_at ON public.devis(created_at);

-- ========================================
-- Étape 2 : RLS Storage (devis-uploads)
-- ========================================

DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;

CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow users to read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow users to update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ========================================
-- Étape 3 : RLS Table devis
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
ON public.devis FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Select
CREATE POLICY "Users can read their own devis"
ON public.devis FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Update
CREATE POLICY "Users can update their own devis"
ON public.devis FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Delete
CREATE POLICY "Users can delete their own devis"
ON public.devis FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ========================================
-- Étape 4 : Vérifications finales
-- ========================================

SELECT 'Migration terminée avec succès !' as status;

-- Afficher les colonnes de la table devis
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'devis'
AND column_name IN ('user_id', 'nom_projet', 'type_travaux', 'montant_total', 'points_forts', 'points_vigilance', 'recommandations', 'comparaison_prix')
ORDER BY column_name;

-- Compter les devis sans user_id
SELECT
  COUNT(*) as total_devis,
  COUNT(user_id) as devis_with_user_id,
  COUNT(*) - COUNT(user_id) as devis_without_user_id
FROM public.devis;

-- Afficher les politiques RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'devis';
```

---

## Ce que fait ce script corrigé

### 1. Gestion intelligente des colonnes

**Cas 1 : `amount` et `montant_total` existent tous les deux**
- Copie les données de `amount` vers `montant_total` (si vide)
- Supprime `amount`

**Cas 2 : Seul `amount` existe**
- Renomme `amount` en `montant_total`

**Cas 3 : Seul `montant_total` existe**
- Ne fait rien (pas d'erreur)

### 2. Ajout des colonnes manquantes

- `user_id` : UUID (lien vers utilisateur)
- `nom_projet` : TEXT (nom du projet)
- `type_travaux` : TEXT (type de travaux)
- `montant_total` : NUMERIC (montant du devis)
- `points_forts` : JSONB (points forts de l'analyse)
- `points_vigilance` : JSONB (points de vigilance)
- `recommandations` : JSONB (recommandations TORP)
- `comparaison_prix` : JSONB (comparaison avec marché)

### 3. Migration des données

Si des devis existent avec `project_id`, copie automatiquement le `user_id` depuis la table `projects`.

### 4. Politiques RLS

- **Storage** : 4 politiques (upload, read, update, delete)
- **Table devis** : 4 politiques (insert, select, update, delete)

---

## Exécution

1. **SQL Editor** dans Supabase
2. **New Query**
3. Copiez le script complet ci-dessus
4. **Run**
5. ✅ Vérifiez : "Migration terminée avec succès !"

---

## Résultats attendus

Vous devriez voir ces colonnes :

```
column_name       | data_type | is_nullable
------------------|-----------|-----------
comparaison_prix  | jsonb     | YES
montant_total     | numeric   | YES
nom_projet        | text      | YES
points_forts      | jsonb     | YES
points_vigilance  | jsonb     | YES
recommandations   | jsonb     | YES
type_travaux      | text      | YES
user_id           | uuid      | NO
```

Et ces statistiques :

```
total_devis | devis_with_user_id | devis_without_user_id
------------|--------------------|-----------------------
0           | 0                  | 0
```

Et 4 politiques RLS :

```
policyname                          | cmd
------------------------------------|--------
Users can insert their own devis    | INSERT
Users can read their own devis      | SELECT
Users can update their own devis    | UPDATE
Users can delete their own devis    | DELETE
```

---

## En cas d'erreur

**"Il y a des devis sans user_id"**

Si vous voyez ce message, exécutez :

```sql
-- Lister les devis sans user_id
SELECT id, file_name, created_at
FROM public.devis
WHERE user_id IS NULL;

-- Option 1 : Supprimer ces devis (si ce sont des tests)
DELETE FROM public.devis WHERE user_id IS NULL;

-- Option 2 : Assigner à un utilisateur spécifique
UPDATE public.devis
SET user_id = 'VOTRE-USER-ID-ICI'
WHERE user_id IS NULL;
```

Puis re-exécutez le script principal.

---

## Test final

Après la migration, testez dans votre application :

1. Connectez-vous
2. Allez sur `/analyze`
3. Uploadez un PDF
4. Lancez l'analyse
5. ✅ Devrait fonctionner sans erreur !
