# 🚀 Guide de Déploiement - Edge Function `ingest-document`

## ⚠️ PROBLÈME ACTUEL
L'erreur CORS que vous rencontrez signifie que la fonction `ingest-document` **N'EXISTE PAS** ou **N'EST PAS DÉPLOYÉE** sur votre Supabase.

---

## 📋 ÉTAPE 1: TESTER D'ABORD AVEC UNE FONCTION SIMPLE

Avant de déployer la fonction complète, testons que le déploiement fonctionne.

### 1.1 Ouvrir le Dashboard Supabase
1. Allez sur: https://supabase.com/dashboard
2. Sélectionnez votre projet: `zvxasiwahpraasjzfhhl`
3. Menu gauche → **Edge Functions**

### 1.2 Créer/Modifier la fonction `ingest-document`
- Si la fonction existe: Cliquez dessus
- Sinon: Cliquez **"New Function"** → Nom: `ingest-document`

### 1.3 Copier le CODE DE TEST

**📄 Fichier à copier**: `TEST-ingest-document-simple.ts` (40 lignes seulement)

```typescript
[COPIEZ TOUT LE CONTENU DU FICHIER TEST-ingest-document-simple.ts]
```

### 1.4 Déployer
1. Cliquez **"Deploy"** ou **"Save"**
2. Attendez 10-20 secondes
3. Vérifiez que le statut est **"Active"** (point vert)

### 1.5 Tester depuis votre navigateur
Ouvrez la console de votre navigateur et tapez:

```javascript
fetch('https://zvxasiwahpraasjzfhhl.supabase.co/functions/v1/ingest-document', {
  method: 'GET',
  headers: {
    'apikey': 'VOTRE_SUPABASE_ANON_KEY'
  }
})
.then(r => r.json())
.then(console.log)
```

**Résultat attendu**:
```json
{
  "success": true,
  "message": "TEST: La fonction ingest-document fonctionne !",
  "timestamp": "2025-11-23T..."
}
```

✅ **Si ça fonctionne**: Passez à l'ÉTAPE 2
❌ **Si ça échoue**: Il y a un problème de déploiement → Contactez-moi avec les logs

---

## 📋 ÉTAPE 2: DÉPLOYER LA FONCTION COMPLÈTE

Une fois le test réussi, déployez la version complète.

### 2.1 Retourner dans Edge Functions
Dashboard → Edge Functions → `ingest-document`

### 2.2 Copier le CODE COMPLET

**📄 Fichier à copier**: `supabase/functions/ingest-document-standalone-COPIER-COLLER.ts` (912 lignes)

**IMPORTANT**: Copiez **TOUT LE CONTENU** du fichier (de la ligne 1 à 912)

### 2.3 Déployer
1. Remplacez tout le code de test par le code complet
2. Cliquez **"Deploy"**
3. Attendez 20-30 secondes (c'est plus long car le fichier est gros)

---

## 📋 ÉTAPE 3: CONFIGURER LES VARIABLES D'ENVIRONNEMENT

### 3.1 Aller dans les Settings
Dashboard → Edge Functions → **Settings** (ou Configuration)

### 3.2 Ajouter les secrets

Cliquez sur **"Add new secret"** pour chaque clé:

```
ANTHROPIC_API_KEY = sk-ant-...votre_clé...
OPENAI_API_KEY = sk-...votre_clé...
```

**Recommandation**: Configurez au moins `ANTHROPIC_API_KEY` (2-3x moins cher)

### 3.3 Redéployer après config
Après avoir ajouté les secrets, cliquez à nouveau sur **"Deploy"** sur la fonction

---

## 📋 ÉTAPE 4: TESTER L'UPLOAD

### 4.1 Depuis votre application
Essayez d'uploader un PDF depuis votre frontend

### 4.2 Vérifier les logs
Dashboard → Edge Functions → `ingest-document` → **Logs**

**Logs attendus**:
```
[OCR] Processing: votre_fichier.pdf (application/pdf, 2.34MB)
[OCR] Using pdf.js for text extraction
[OCR] ✅ Extracted 1234 characters from 5 pages
✅ Document 123 processed: 15 chunks, method: pdf.js
```

---

## 🆘 DÉPANNAGE

### Erreur CORS persiste
- Vérifiez que la fonction est bien **"Active"** (point vert)
- Attendez 30 secondes après le déploiement
- Videz le cache du navigateur (Ctrl+Shift+R)
- Vérifiez l'URL: `https://zvxasiwahpraasjzfhhl.supabase.co/functions/v1/ingest-document`

### Erreur "No GlobalWorkerOptions.workerSrc"
- Le code a été mis à jour avec `disableWorker: true`
- Assurez-vous d'avoir copié **la dernière version** du fichier

### Erreur "ANTHROPIC_API_KEY non configurée"
- Allez dans Settings → Secrets
- Ajoutez au moins `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY`

---

## 📞 BESOIN D'AIDE ?

Si après ces étapes le problème persiste, envoyez-moi:

1. Une capture d'écran de Edge Functions montrant le statut
2. Les logs complets de la fonction
3. L'erreur exacte dans la console du navigateur

---

**Fichiers à utiliser**:
- Test: `/home/user/quote-insight-tally/TEST-ingest-document-simple.ts`
- Production: `/home/user/quote-insight-tally/supabase/functions/ingest-document-standalone-COPIER-COLLER.ts`
