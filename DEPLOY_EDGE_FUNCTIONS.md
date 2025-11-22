# Guide de déploiement des Edge Functions Supabase

## 🐛 Problème résolu

Les erreurs "Maximum call stack size exceeded" dans les Edge Functions `ingest-document` et `ingest-document-standalone` ont été corrigées.

**Cause :** Conversion base64 inefficace qui tentait de passer ~500,000 arguments pour un PDF de 0.5MB.

**Solution :** Fonction helper `bufferToBase64()` qui traite les données par chunks de 8KB.

## 📦 Fichiers corrigés

- ✅ `supabase/functions/ingest-document-standalone/index.ts`
- ✅ `supabase/functions/ingest-document/index.ts`

## 🚀 Déploiement

### Option 1 : Interface Supabase Dashboard (Recommandé)

1. Connectez-vous à https://app.supabase.com
2. Sélectionnez votre projet
3. Menu de gauche → **Edge Functions**
4. Pour chaque fonction :
   - Cliquez sur le nom de la fonction
   - Cliquez sur **Deploy function** ou le bouton de redéploiement
   - Attendez la confirmation

Fonctions à déployer :
- `ingest-document-standalone` (priorité haute - c'est la principale)
- `ingest-document`

### Option 2 : Supabase CLI (ligne de commande)

#### Prérequis

```bash
# Installer Supabase CLI (si pas déjà fait)
npm install -g supabase

# Se connecter
supabase login

# Lier votre projet
supabase link --project-ref YOUR_PROJECT_REF
```

#### Déploiement automatique

Utilisez le script fourni :

```bash
./deploy-functions.sh
```

Ou manuellement :

```bash
# Déployer ingest-document-standalone
supabase functions deploy ingest-document-standalone

# Déployer ingest-document
supabase functions deploy ingest-document
```

### Option 3 : GitHub Actions (CI/CD)

Si vous voulez automatiser le déploiement à chaque push, créez un workflow GitHub Actions :

```yaml
# .github/workflows/deploy-edge-functions.yml
name: Deploy Edge Functions

on:
  push:
    branches: [main, master]
    paths:
      - 'supabase/functions/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy Edge Functions
        run: |
          supabase functions deploy ingest-document-standalone --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase functions deploy ingest-document --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Ajoutez ces secrets dans GitHub :
- `SUPABASE_PROJECT_REF` : votre project reference ID
- `SUPABASE_ACCESS_TOKEN` : votre access token (depuis Supabase Dashboard → Settings → API)

## ✅ Vérification

Après le déploiement, testez en uploadant un PDF. Vous ne devriez plus voir les erreurs :
- ❌ `RangeError: Maximum call stack size exceeded`
- ❌ `ocrWithGoogleVision failed`
- ❌ `ocrWithMicroservice failed`

Les logs devraient afficher :
- ✅ `[OCR] Strategy: ...`
- ✅ Traitement réussi sans stack overflow

## 📝 Notes

- Les changements sont déjà committés dans la branche `claude/fix-railway-errors-01UVb1eK5A6yZqDPPysftDEJ`
- Le code local est correct, seul le déploiement est nécessaire
- Les anciennes versions déployées contiennent du code obsolète (`ocrWithGoogleVision`, `ocrWithMicroservice`) qui n'existe plus dans le code source

## 🆘 Support

En cas de problème :
1. Vérifiez les logs dans Supabase Dashboard → Edge Functions → Logs
2. Assurez-vous que les variables d'environnement sont configurées (OPENAI_API_KEY, etc.)
3. Testez avec un petit PDF (<100KB) en premier
