# Configuration Supabase - Module B2B TORP

## ✅ État de la configuration

Voici les requirements Supabase pour que l'ensemble du module B2B fonctionne correctement.

## 📊 Tables requises

### 1. `pro_company_profiles`
**Colonnes utilisées dans le code :**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `raison_sociale` (text)
- `siret` (text)
- `siret_verifie` (boolean)
- `ville` (text)
- `date_creation` (date)
- Autres colonnes pour profil complet

**Relations :**
- Référencée par `pro_devis_analyses.company_id`

### 2. `pro_devis_analyses`
**Colonnes critiques pour le système de tickets :**
```sql
CREATE TABLE pro_devis_analyses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES pro_company_profiles(id),
  user_id uuid REFERENCES auth.users(id),
  
  -- Identification devis
  reference_devis text NOT NULL,
  nom_projet text,
  
  -- Fichier
  file_url text NOT NULL,
  file_name text NOT NULL,
  
  -- Résultats analyse
  status text NOT NULL, -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
  score_total integer, -- 0-1000
  grade text, -- 'A', 'B', 'C', 'D', 'E'
  score_details jsonb,
  
  -- Ticket TORP (CRITICAL)
  ticket_genere boolean DEFAULT false,
  ticket_code text UNIQUE, -- Ex: 'M4X7K9' (6 chars)
  ticket_url text, -- URL du PDF dans Storage
  ticket_generated_at timestamptz,
  ticket_view_count integer DEFAULT 0,
  ticket_last_viewed_at timestamptz,
  
  -- Timestamps
  analyzed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index CRITICAL pour recherche par ticket_code
CREATE UNIQUE INDEX idx_ticket_code ON pro_devis_analyses(ticket_code) 
WHERE ticket_code IS NOT NULL;
```

### 3. `company_documents`
**Colonnes utilisées :**
- `id` (uuid)
- `company_id` (uuid, foreign key)
- `type` (text) - 'KBIS', 'ASSURANCE_DECENNALE', 'CERTIFICATION_RGE', etc.
- `statut` (text) - 'VALID', 'EXPIRING', 'EXPIRED', 'PENDING'
- `file_url` (text)
- Dates de validité

### 4. `ticket_tracking_events`
**Table pour analytics des tickets :**
```sql
CREATE TABLE ticket_tracking_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id uuid REFERENCES pro_devis_analyses(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'qr_scanned', 'link_viewed', 'pdf_downloaded'
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_tracking_analysis ON ticket_tracking_events(analysis_id);
CREATE INDEX idx_tracking_date ON ticket_tracking_events(created_at);
```

## 🔧 Fonctions SQL requises

### Fonction `increment_ticket_view_count`
```sql
CREATE OR REPLACE FUNCTION increment_ticket_view_count(p_analysis_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pro_devis_analyses
  SET 
    ticket_view_count = ticket_view_count + 1,
    ticket_last_viewed_at = now()
  WHERE id = p_analysis_id;
END;
$$;
```

## 🗄️ Storage Buckets requis

### 1. Bucket `pro-tickets`
**Configuration :**
- Public: **OUI** (les tickets PDF doivent être accessibles publiquement)
- Politique de stockage:
```sql
-- Politique d'upload (authentifié seulement)
CREATE POLICY "Authenticated users can upload tickets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pro-tickets');

-- Politique de lecture (PUBLIC pour scan QR)
CREATE POLICY "Public can view tickets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pro-tickets');

-- Politique de suppression (owner seulement)
CREATE POLICY "Users can delete their tickets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pro-tickets' AND auth.uid() = owner);
```

### 2. Bucket `devis-analyses` (déjà existant)
Pour stocker les fichiers PDF des devis uploadés.

## 🔐 Row Level Security (RLS)

### Table `pro_devis_analyses`
```sql
-- Enable RLS
ALTER TABLE pro_devis_analyses ENABLE ROW LEVEL SECURITY;

-- Users can read their own analyses
CREATE POLICY "Users can view their own analyses"
ON pro_devis_analyses FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own analyses
CREATE POLICY "Users can create analyses"
ON pro_devis_analyses FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own analyses
CREATE POLICY "Users can update their own analyses"
ON pro_devis_analyses FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- PUBLIC can read analyses with generated tickets (FOR TICKET PAGE)
CREATE POLICY "Public can view ticket data"
ON pro_devis_analyses FOR SELECT
TO public
USING (ticket_genere = true AND ticket_code IS NOT NULL);
```

### Table `pro_company_profiles`
```sql
ALTER TABLE pro_company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company"
ON pro_company_profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- PUBLIC can view company info for tickets
CREATE POLICY "Public can view company for tickets"
ON pro_company_profiles FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM pro_devis_analyses
    WHERE company_id = pro_company_profiles.id
    AND ticket_genere = true
  )
);
```

### Table `ticket_tracking_events`
```sql
ALTER TABLE ticket_tracking_events ENABLE ROW LEVEL SECURITY;

-- PUBLIC can insert tracking events
CREATE POLICY "Public can track ticket views"
ON ticket_tracking_events FOR INSERT
TO public
WITH CHECK (true);

-- Users can view their tracking events
CREATE POLICY "Users can view their tracking"
ON ticket_tracking_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pro_devis_analyses
    WHERE id = ticket_tracking_events.analysis_id
    AND user_id = auth.uid()
  )
);
```

## ✅ Points de vérification

### 1. Champs de base de données
- ✅ `pro_devis_analyses.ticket_code` (text, unique)
- ✅ `pro_devis_analyses.ticket_genere` (boolean)
- ✅ `pro_devis_analyses.ticket_url` (text)
- ✅ `pro_devis_analyses.ticket_view_count` (integer)
- ✅ `pro_devis_analyses.score_details` (jsonb)

### 2. Requêtes critiques utilisées
```typescript
// 1. Génération du code (vérifier unicité)
supabase.from('pro_devis_analyses')
  .select('id')
  .eq('ticket_code', shortCode)
  .maybeSingle()

// 2. Récupération analyse pour page publique
supabase.from('pro_devis_analyses')
  .select(`*, company:pro_company_profiles!inner(...)`)
  .eq('ticket_code', code)
  .eq('ticket_genere', true)
  .eq('status', 'COMPLETED')
  .single()

// 3. Récupération documents
supabase.from('company_documents')
  .select('*')
  .eq('company_id', analysis.company_id)
  .in('statut', ['VALID', 'EXPIRING'])

// 4. Tracking
supabase.from('ticket_tracking_events').insert({...})
supabase.rpc('increment_ticket_view_count', {...})
```

### 3. Storage
- ✅ Bucket `pro-tickets` existe et est public
- ✅ Upload fonctionne : `storage.from('pro-tickets').upload(...)`
- ✅ URLs publiques : `storage.from('pro-tickets').getPublicUrl(...)`

## 🔍 Comment vérifier

### Test 1: Vérifier les tables
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pro_devis_analyses'
AND column_name LIKE '%ticket%';
```

### Test 2: Vérifier la fonction SQL
```sql
SELECT proname, proargtypes 
FROM pg_proc 
WHERE proname = 'increment_ticket_view_count';
```

### Test 3: Vérifier le bucket
```sql
SELECT * FROM storage.buckets WHERE name = 'pro-tickets';
```

### Test 4: Vérifier les policies
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'pro_devis_analyses';
```

## ⚠️ Points d'attention

1. **Politique PUBLIC sur `pro_devis_analyses`** : Nécessaire pour que la page `/t/:code` fonctionne sans auth
2. **Index sur `ticket_code`** : Critical pour performance de recherche
3. **Bucket public** : Les PDFs doivent être accessibles via URL directe
4. **Fonction SQL SECURITY DEFINER** : Permet l'incrémentation du compteur sans auth

## 🚀 Migration SQL complète

Si besoin de créer toutes les structures d'un coup, voici le script:

```sql
-- Voir fichier: supabase/migrations/YYYYMMDD_ticket_system.sql
```

## 📝 Notes

- Le code TypeScript utilise les noms de colonnes en snake_case (ex: `ticket_code`)
- Les interfaces TypeScript utilisent camelCase (ex: `ticketCode`)
- La conversion est automatique via Supabase client
- Les champs JSONB (`score_details`) stockent les objets JS directement
