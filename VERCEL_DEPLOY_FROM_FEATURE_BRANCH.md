# 🔧 Configurer Vercel pour Déployer depuis la Feature Branch

## 🔍 Diagnostic du Problème

**Situation actuelle:**
- ✅ Feature branch: `claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME` (à jour, avec Phase 2 + 3)
- ❌ Branch `main`: en retard (s'arrête à Phase 0-1-2, sans les fixes)
- 🚫 Impossible de pusher directement sur main (erreur 403)
- 📦 Vercel déploie depuis `main` → **affiche l'ancienne version**

**Résultat:** Landing page affiche l'ancienne version sans:
- Bouton "Inscription"
- Menu de déconnexion
- Fix d'authentification Supabase
- Phase 3 (Analyse AI)

---

## 🎯 Solution: Déployer depuis la Feature Branch

### Étape 1: Changer la Branche de Production sur Vercel (2 min)

1. **Ouvrez Vercel Dashboard**
   - https://vercel.com/torps-projects/quote-insight-tally

2. **Allez dans Settings → Git**

3. **Dans "Production Branch", changez:**
   ```
   main  →  claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME
   ```

4. **Sauvegardez** les changements

5. **Redéployez:**
   - Allez dans **Deployments**
   - Cliquez sur le dernier déploiement de la feature branch
   - Cliquez **"Promote to Production"**

---

## ✅ Vérification

Une fois le déploiement terminé, vérifiez sur votre site:

### Landing Page Mise à Jour
- ✅ Bouton **"Inscription"** visible dans le header
- ✅ Bouton **"Connexion"** visible
- ✅ Menu dropdown avec déconnexion (quand connecté)

### Backend Activé
- ✅ Inscription crée un vrai compte dans Supabase
- ✅ Login fonctionne avec authentification réelle
- ✅ Mock auth n'est plus utilisé

### AI Opérationnel (si clés ajoutées)
- ✅ Upload de devis déclenche l'analyse
- ✅ Console logs montrent les étapes TORP
- ✅ Score affiché dans les résultats

---

## 🔄 Alternative: Créer une Pull Request

Si vous préférez garder `main` comme branche de prod:

### Option A: Via GitHub Interface

1. **Ouvrez GitHub**
   - https://github.com/torp-fr/quote-insight-tally

2. **Créez une Pull Request:**
   - Base: `main`
   - Compare: `claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME`

3. **Titre:**
   ```
   Phase 2 & 3: Backend Supabase + AI Analysis Integration
   ```

4. **Mergez la PR**

5. **Vercel déploiera automatiquement** depuis main mis à jour

### Option B: Via CLI (si configuré)

```bash
# Créer la PR
gh pr create \
  --base main \
  --head claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME \
  --title "Phase 2 & 3: Backend + AI Integration" \
  --body "Merge feature branch with all updates into main"

# Merger la PR (après review)
gh pr merge --merge --delete-branch=false
```

⚠️ **Note:** Cette option nécessite les permissions pour merger dans main.

---

## 📊 Comparaison des Versions

### Version Actuelle (main - obsolète)
```
Commits jusqu'à: f66774d
Inclut: Phase 0, 1, 2 (backend code seulement)
❌ Manque: Fixes navigation
❌ Manque: Fixes RLS/auth
❌ Manque: Phase 3 (AI)
```

### Version Feature Branch (à jour)
```
Commits jusqu'à: 19e5049
Inclut: Phase 0, 1, 2, 3
✅ Tous les fixes de navigation
✅ Tous les fixes RLS/auth
✅ Phase 3 complète (AI)
✅ Documentation mise à jour
```

---

## 🎯 Recommandation

**Option 1 (Rapide):** Changer la production branch sur Vercel
- ✅ Rapide (2 minutes)
- ✅ Pas besoin de permissions spéciales
- ✅ Fonctionne immédiatement

**Option 2 (Propre):** Créer et merger une PR
- ✅ Plus "propre" (suit le workflow Git standard)
- ✅ Permet review avant merge
- ⚠️ Nécessite permissions sur main

---

## 🐛 Si le Problème Persiste

### Cache Vercel

Il peut y avoir un cache. Forcez un redéploiement complet:

1. **Vercel Dashboard → Deployments**
2. Trouvez le déploiement de `claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME`
3. Cliquez le menu **⋯** → **"Redeploy"**
4. Cochez **"Use existing Build Cache"** → **OFF**
5. Cliquez **"Redeploy"**

### Cache Navigateur

Videz le cache navigateur:
- Chrome: `Ctrl+Shift+R` (hard refresh)
- Firefox: `Ctrl+F5`
- Safari: `Cmd+Opt+R`

### Vérifier la Branche Déployée

Dans **Vercel Dashboard → Deployments**:
- Regardez le déploiement "Production"
- Vérifiez le **"Branch"** affiché
- Si c'est `main`, recommencez Étape 1

---

## ✅ Checklist Finale

Après changement de branche de production:

- [ ] Vercel Settings → Git → Production Branch = feature branch
- [ ] Redéploiement effectué
- [ ] Site affiche la nouvelle landing page
- [ ] Bouton "Inscription" visible
- [ ] Authentification fonctionne
- [ ] (Si clés AI ajoutées) Analyse fonctionne

---

**Une fois fait, toutes les mises à jour (Phase 2-3) seront en production! 🎉**
