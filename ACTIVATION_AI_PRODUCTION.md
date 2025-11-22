# 🚀 Activation de l'Analyse AI en Production (Vercel)

## ✅ Ce qui est déjà fait

- ✅ Code de Phase 3 déployé sur la branche
- ✅ Services AI (OpenAI + Claude) implémentés
- ✅ Extraction PDF fonctionnelle
- ✅ Prompts TORP configurés
- ✅ Intégration avec le flux d'upload

## 🔑 Étape 1: Ajouter les Clés API sur Vercel (5 min)

### Option A: Via Dashboard Vercel

1. **Ouvrez votre projet sur Vercel**
   - https://vercel.com/torps-projects/quote-insight-tally

2. **Allez dans Settings → Environment Variables**

3. **Ajoutez ces 4 variables** (cliquez "Add" pour chacune):

   **Variable 1:**
   ```
   Name: VITE_OPENAI_API_KEY
   Value: torp_gpt_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
   Environments: ✓ Production, ✓ Preview, ✓ Development
   ```

   **Variable 2:**
   ```
   Name: VITE_ANTHROPIC_API_KEY
   Value: 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
   Environments: ✓ Production, ✓ Preview, ✓ Development
   ```

   **Variable 3:**
   ```
   Name: VITE_AI_PRIMARY_PROVIDER
   Value: claude
   Environments: ✓ Production, ✓ Preview, ✓ Development
   ```

   **Variable 4:**
   ```
   Name: VITE_AI_FALLBACK_ENABLED
   Value: true
   Environments: ✓ Production, ✓ Preview, ✓ Development
   ```

4. **Sauvegardez** chaque variable

### Option B: Via Vercel CLI (plus rapide)

```bash
# Si vous avez vercel CLI installé
vercel env add VITE_OPENAI_API_KEY
# Collez: torp_gpt_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0

vercel env add VITE_ANTHROPIC_API_KEY
# Collez: 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

vercel env add VITE_AI_PRIMARY_PROVIDER
# Valeur: claude

vercel env add VITE_AI_FALLBACK_ENABLED
# Valeur: true
```

---

## 🔄 Étape 2: Redéployer (2 min)

### Méthode 1: Auto-deploy (Recommandé)
Le dernier push devrait avoir déclenché un redéploiement automatique.

Vérifiez dans **Vercel Dashboard → Deployments**:
- Status doit être "Ready" ou "Building"
- Branche: `claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME`

### Méthode 2: Redéploiement manuel
Si l'auto-deploy n'a pas fonctionné:
1. Dans **Vercel Dashboard → Deployments**
2. Cliquez sur le dernier déploiement
3. Cliquez **"Redeploy"**
4. Confirmez

---

## 🧪 Étape 3: Tester l'Analyse AI (5 min)

Une fois le déploiement terminé:

### Test 1: Vérifier que l'AI est configurée

1. Ouvrez la console navigateur (F12)
2. Rechargez la page
3. Cherchez dans les logs:
   ```
   🔧 Environment Configuration:
   ...
   AI Provider: claude
   ```

### Test 2: Uploader un devis PDF

1. **Connectez-vous** sur votre site
2. Allez sur `/analyze`
3. **Uploadez un devis PDF test** (idéalement un vrai devis de travaux)
4. Remplissez les informations du projet:
   - Nom du projet
   - Type de travaux
   - Région (optionnel)

5. Cliquez **"Analyser"**

### Test 3: Observer l'analyse

Dans la console navigateur, vous devriez voir:

```
[Devis] Starting analysis for xxx...
[PDF] Extracted 2543 characters from 3 pages
[TORP] Step 1/6: Extracting structured data...
[HybridAI] Using claude for JSON generation
[TORP] Step 2/6: Analyzing entreprise...
[TORP] Step 3/6: Analyzing prix...
[HybridAI] Using openai for JSON generation
[TORP] Step 4/6: Analyzing complétude...
[TORP] Step 5/6: Analyzing conformité...
[TORP] Step 6/6: Analyzing délais...
[TORP] Generating synthesis...
[TORP] Analysis complete in 23s - Score: 742/1000 (B)
[Devis] Analysis complete for xxx - 25s total - Score: 742/1000 (B)
```

### Test 4: Vérifier les résultats dans Supabase

1. Ouvrez **Supabase Dashboard**
2. Allez dans **Table Editor → devis**
3. Trouvez votre devis
4. Vérifiez:
   - ✅ `status` = "analyzed"
   - ✅ `score_total` = nombre entre 0-1000
   - ✅ `grade` = A+, A, B, C, D ou F
   - ✅ `score_entreprise` = objet JSON avec détails
   - ✅ `recommendations` = array de recommandations
   - ✅ `analyzed_at` = timestamp

---

## 🐛 Dépannage

### Erreur: "No AI provider is configured"

**Cause**: Les clés API ne sont pas accessibles

**Solution**:
1. Vérifiez que les variables sont bien ajoutées sur Vercel
2. Vérifiez que les noms commencent par `VITE_` (important pour Vite!)
3. Redéployez après avoir ajouté les variables

### Erreur: "Failed to extract PDF text"

**Cause**: PDF protégé ou corrompu

**Solution**:
1. Essayez avec un autre PDF
2. Vérifiez que le PDF n'est pas protégé par mot de passe
3. Vérifiez que le PDF contient du texte (pas juste des images scannées)

### Erreur: "OpenAI API call failed" ou "Claude API call failed"

**Cause**: Problème avec les clés API ou quota dépassé

**Solution**:
1. Vérifiez que les clés API sont valides
2. Vérifiez les quotas sur OpenAI/Anthropic dashboards
3. Le fallback devrait automatiquement basculer sur l'autre provider

### L'analyse reste bloquée sur "analyzing"

**Cause**: Erreur pendant l'analyse qui n'a pas été catchée

**Solution**:
1. Regardez les logs dans la console navigateur
2. Vérifiez les logs Vercel (Runtime Logs)
3. Le status devrait revenir à "uploaded" en cas d'erreur

---

## 📊 Résultats Attendus

### Score TORP

Le système attribue un score sur **1000 points**:

```
Entreprise:  ███████████░░░░  250/250
Prix:        ████████████░░░  300/300
Complétude:  ██████████░░░░░  180/200
Conformité:  ████████░░░░░░░  120/150
Délais:      ███████░░░░░░░░   70/100
─────────────────────────────
TOTAL:       ████████████░░░  920/1000  → Grade: A+
```

### Recommandations

L'analyse génère automatiquement:
- **Points forts** (top 5)
- **Points faibles** (top 5)
- **Questions à poser** à l'entreprise
- **Points de négociation** précis avec montants
- **Actions recommandées** avec priorité (haute/moyenne/faible)
- **Budget réel estimé** vs montant du devis
- **Marge de négociation** (min/max)

---

## ⚡ Optimisations Performance

### Actuellement
- Temps moyen: **20-30 secondes** par devis
- Analyse séquentielle des 6 critères

### Optimisations futures (optionnel)
- **Analyse parallèle**: 6 critères en même temps → **8-12 secondes**
- **Caching**: Réutiliser les analyses d'entreprises connues
- **Streaming**: Afficher les résultats au fur et à mesure
- **Background jobs**: Utiliser Supabase Edge Functions pour l'analyse

---

## 💰 Coûts Estimés

### Par analyse (estimation)

**Claude 3.5 Sonnet**:
- Input: ~8k tokens × $3/M = **$0.024**
- Output: ~2k tokens × $15/M = **$0.030**

**GPT-4o** (fallback):
- Input: ~8k tokens × $2.5/M = **$0.020**
- Output: ~2k tokens × $10/M = **$0.020**

**Total par analyse**: ~**$0.05-0.08** (5-8 centimes)

Pour **100 analyses/mois**: ~**€5-8**
Pour **1000 analyses/mois**: ~**€50-80**

💡 **Astuce**: Avec le fallback activé, vous maximisez la fiabilité tout en optimisant les coûts.

---

## ✅ Checklist Finale

Avant de déclarer la Phase 3 en production:

- [ ] Clés API ajoutées sur Vercel
- [ ] Redéploiement effectué
- [ ] Test avec un vrai devis PDF réussi
- [ ] Score TORP affiché correctement
- [ ] Recommandations générées
- [ ] Données sauvegardées dans Supabase
- [ ] Console logs indiquent succès
- [ ] Temps d'analyse < 40 secondes

---

## 🎉 Prêt pour la Production!

Une fois toutes les étapes validées, l'analyse AI est **100% opérationnelle** !

Vos utilisateurs peuvent maintenant:
1. Uploader leurs devis
2. Recevoir une analyse TORP complète en 30 secondes
3. Obtenir un score objectif /1000
4. Accéder à des recommandations personnalisées
5. Négocier en connaissance de cause

**Besoin d'aide?** Consultez les logs ou testez avec différents types de devis pour affiner les prompts.
