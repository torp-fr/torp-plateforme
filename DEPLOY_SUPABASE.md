# Guide de déploiement forcé Supabase

## Problème
Supabase Dashboard ne redéploie pas correctement la nouvelle version de l'Edge Function depuis GitHub.

## Solution : Forcer le redéploiement

### Option 1 : Via Supabase Dashboard (à réessayer)

1. **Supabase Dashboard** → **Edge Functions** → **ingest-document**

2. Regardez le numéro de version actuel (ex: v24, v25, etc.)

3. Cliquez sur **... (trois points)** → **"Deploy"**

4. **ATTENDEZ 60 secondes** (ne pas rafraîchir la page immédiatement)

5. Vérifiez que le numéro de version a AUGMENTÉ

6. Testez en uploadant un PDF - vous DEVEZ voir dans les logs :
   ```
   🚀 [INGEST v2024-11-22] PaddleOCR microservice enabled
   [OCR DEBUG] OCR_SERVICE_URL: CONFIGURED
   ```

### Option 2 : Vérifier la branche source

1. **Supabase Dashboard** → **Settings** → **Functions**

2. Cherchez "Source branch" ou "Deployment branch"

3. Vérifiez que c'est bien **`main`** (pas une autre branche)

4. Si c'est une autre branche, changez-la vers `main` et sauvegardez

### Option 3 : Supprimer et recréer la fonction

⚠️ **ATTENTION** : Cela supprimera temporairement la fonction (downtime de 2-3 minutes)

1. **Edge Functions** → **ingest-document** → **... (trois points)** → **"Delete"**

2. Confirmez la suppression

3. **New Function** → **Deploy from GitHub**
   - Name: `ingest-document`
   - Repository: `torp-fr/quote-insight-tally`
   - Branch: `main`
   - Path: `supabase/functions/ingest-document`

4. Attendez le déploiement complet

### Option 4 : Vérifier les secrets

Il est possible que le secret `OCR_SERVICE_URL` ne soit pas visible par la fonction.

1. **Settings** → **Edge Functions** → **Secrets**

2. Vérifiez que `OCR_SERVICE_URL` existe

3. Si oui, **SUPPRIMEZ-LE** et **RECRÉEZ-LE** :
   - Delete `OCR_SERVICE_URL`
   - Add new secret:
     - Name: `OCR_SERVICE_URL`
     - Value: `https://quote-insight-tally-production.up.railway.app`

4. Redéployez la fonction après avoir recréé le secret

## Vérification du déploiement réussi

Uploadez un PDF et vérifiez les logs. Vous DEVEZ voir :

```
✅ 🚀 [INGEST v2024-11-22] PaddleOCR microservice enabled
✅ [OCR] File: xxx.pdf, Type: application/pdf, Size: 0.06 MB
✅ [OCR DEBUG] OCR_SERVICE_URL: CONFIGURED, sizeMB: 0.06
✅ [OCR] Strategy: Microservice PaddleOCR (production quality)
```

Si vous voyez toujours :
```
❌ [OCR] Strategy: OCR.space (PDF, max 3 pages)
```

Sans les logs 🚀 et [OCR DEBUG], c'est que l'ancienne version est toujours déployée.

## Dernière option : Support Supabase

Si rien ne fonctionne, contactez le support Supabase :
- Dashboard → Help → Support
- Indiquez : "Edge Function not redeploying from GitHub main branch"
- Fournissez le nom du projet et de la fonction
