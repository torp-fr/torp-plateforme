# Configuration Supabase Storage pour les documents

## Création du bucket `devis-documents`

### Via Supabase Dashboard

1. **Accédez à Supabase Dashboard** : https://supabase.com/dashboard
2. **Projet** : zvxasiwahpraasjzfhhl.supabase.co
3. **Menu gauche** → **Storage**
4. **Cliquez sur "New bucket"**
5. **Configuration** :
   - **Name** : `devis-documents`
   - **Public** : ✅ Coché (pour permettre l'accès aux URLs publiques)
   - **File size limit** : 10MB
   - **Allowed MIME types** : `application/pdf`, `image/jpeg`, `image/png`, `image/jpg`

6. **Cliquez sur "Create bucket"**

### Configuration des politiques de sécurité (RLS)

Après création du bucket, configurez les politiques RLS :

#### Politique 1 : Upload (INSERT)
```sql
CREATE POLICY "Users can upload to their own devis folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'devis-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.devis WHERE user_id = auth.uid()
  )
);
```

#### Politique 2 : Select (READ)
```sql
CREATE POLICY "Users can view their own devis documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'devis-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.devis WHERE user_id = auth.uid()
  )
);
```

#### Politique 3 : Delete
```sql
CREATE POLICY "Users can delete their own devis documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'devis-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.devis WHERE user_id = auth.uid()
  )
);
```

#### Politique 4 : Public read (optionnel, pour partage)
```sql
CREATE POLICY "Public can view documents if devis is shared"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'devis-documents'
);
```

## Structure des fichiers

Les fichiers seront organisés par devis :

```
devis-documents/
├── {devisId-1}/
│   ├── warning_0_1234567890.pdf
│   ├── warning_1_1234567891.jpg
│   └── warning_2_1234567892.pdf
├── {devisId-2}/
│   └── warning_0_1234567893.pdf
...
```

## Test du bucket

Pour tester la configuration :

```typescript
import { supabase } from '@/lib/supabase';

// Test upload
const testFile = new Blob(['test'], { type: 'text/plain' });
const { data, error } = await supabase.storage
  .from('devis-documents')
  .upload('test/test.txt', testFile);

if (error) {
  console.error('Bucket not configured:', error);
} else {
  console.log('Bucket OK:', data);
}
```

## Migrations à exécuter

1. **Table `devis_documents`** :
   ```bash
   # Exécutez la migration 005_create_devis_documents_table.sql
   # via le SQL Editor de Supabase Dashboard
   ```

2. **Vérifiez** :
   ```sql
   SELECT * FROM public.devis_documents LIMIT 1;
   ```

## Résolution des problèmes

### Erreur : "Bucket does not exist"
→ Créez le bucket `devis-documents` via Dashboard

### Erreur : "Policy check violation"
→ Vérifiez que les politiques RLS sont bien créées

### Erreur : "File too large"
→ Augmentez la limite dans les settings du bucket (max 10MB)

### Erreur : "Invalid MIME type"
→ Ajoutez le type MIME dans les allowed types du bucket
