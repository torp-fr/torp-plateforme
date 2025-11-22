# Instructions pour activer le microservice OCR

## Problème actuel

Supabase déploie les Edge Functions depuis la branche `main`, mais le code du microservice PaddleOCR est sur la branche `claude/add-french-definitions-015v2wUeBSUVmz6PPtixaYyL`.

## Solution : Créer une Pull Request et merger

### Étape 1 : Créer la Pull Request

1. Allez sur **https://github.com/torp-fr/quote-insight-tally**

2. Vous devriez voir un banner jaune :
   ```
   claude/add-french-definitions-015v2wUeBSUVmz6PPtixaYyL had recent pushes
   [Compare & pull request]
   ```
   → Cliquez sur **"Compare & pull request"**

3. Si pas de banner :
   - **Pull requests** → **New pull request**
   - **Base** : `main`
   - **Compare** : `claude/add-french-definitions-015v2wUeBSUVmz6PPtixaYyL`

4. **Titre** :
   ```
   feat: Add PaddleOCR microservice for production OCR
   ```

5. **Description** :
   ```markdown
   ## Microservice OCR Production
   
   - PaddleOCR déployé sur Railway
   - URL : https://quote-insight-tally-production.up.railway.app
   - Edge Functions mises à jour avec stratégie microservice en priorité
   - Fallbacks : OCR.space, Google Vision, extraction basique
   
   ## Configuration Supabase requise
   
   Secret déjà configuré :
   - OCR_SERVICE_URL = https://quote-insight-tally-production.up.railway.app
   ```

6. **Create pull request**

### Étape 2 : Merger la PR

1. Cliquez sur **"Merge pull request"**
2. Cliquez sur **"Confirm merge"**

### Étape 3 : Redéployer dans Supabase

1. **Supabase Dashboard** → **Edge Functions**
2. Trouvez **`ingest-document`**
3. Cliquez sur **...** → **"Deploy"**
4. Attendez 10-30 secondes

### Étape 4 : Tester

1. Uploadez un PDF DTU via `/knowledge-base`
2. Vérifiez les logs Supabase
3. Vous devriez voir :
   ```
   ✅ [OCR] Strategy: Microservice PaddleOCR (production quality)
   ✅ [OCR Microservice] Extracted XXXX chars from X pages
   ```

## Ordre de priorité des stratégies OCR

```typescript
// PDFs
1. Microservice PaddleOCR (< 50 MB) ← PRIORITAIRE
2. OCR.space (< 3 MB, fallback)
3. Google Cloud Vision (< 10 MB, fallback)
4. Extraction basique (fallback ultime)

// Images
1. OpenAI Vision (GPT-4o)
2. OCR.space (fallback)
```

## Vérification du secret Supabase

**Settings** → **Edge Functions** → **Secrets**

Doit contenir :
```
OCR_SERVICE_URL = https://quote-insight-tally-production.up.railway.app
```

Sans slash final, sans espaces.
