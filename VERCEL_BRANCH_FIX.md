# Configuration Vercel - Déployer depuis la branche feature

## Problème

Vercel déploie depuis `main` (obsolète) au lieu de `claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME` (à jour).

## Solution Rapide : Changer la branche de production

### Étape 1 : Aller dans Settings Vercel

1. Ouvrir : https://vercel.com/torps-projects/quote-insight-tally/settings/git
2. Section **Production Branch**

### Étape 2 : Changer la branche

**Actuellement** :
```
Production Branch: main
```

**Changer en** :
```
Production Branch: claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME
```

### Étape 3 : Save

Cliquer **Save**

### Étape 4 : Redéployer

1. Onglet **Deployments**
2. Vercel va automatiquement déclencher un nouveau déploiement depuis la bonne branche
3. Ou manuellement : dernier déploiement → **⋮** → **Redeploy**

---

## Résultat

✅ Vercel déploiera maintenant depuis `claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME`
✅ Commit `37f30c3` sera déployé (avec tout le travail Phase 0, 1, 2)
✅ Build réussira (Vite détecté correctement)

---

## Alternative : Merger vers main (si vous préférez)

Si vous préférez garder `main` comme branche de production :

### Via GitHub UI

1. Aller sur : https://github.com/torp-fr/quote-insight-tally
2. **Pull requests** → **New pull request**
3. **base:** `main` ← **compare:** `claude/setup-new-project-01624XSUdEvM9W9a3pNtSxME`
4. **Create pull request**
5. **Merge pull request**
6. Vercel redéploiera automatiquement

---

## Recommandation

**Option 1** (changer branche Vercel) est plus rapide : **2 minutes**

**Option 2** (merger via PR) est plus propre mais prend **5 minutes**

Choisissez celle qui vous convient !
