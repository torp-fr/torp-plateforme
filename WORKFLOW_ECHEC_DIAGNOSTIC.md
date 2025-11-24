# 🔴 Workflow en Échec - Guide de Diagnostic

**Date** : 2025-11-24
**Commit déclencheur** : 67923f0

---

## ✅ CE QUE JE VIENS DE FAIRE

J'ai modifié le fichier `supabase/functions/refresh-company-cache/index.ts` et pushé le commit `67923f0`.

**Ce commit devrait déclencher automatiquement le workflow GitHub Actions dans les 30 prochaines secondes.**

---

## 🔍 ÉTAPE 1 : Vérifiez si le Workflow Apparaît Maintenant

**Allez sur** : https://github.com/torp-fr/quote-insight-tally/actions

**Attendez 30-60 secondes** et rafraîchissez la page.

### Que devez-vous voir ?

Vous devriez voir un nouveau workflow avec :
- **Nom** : "Deploy Company Search System" OU "Test Company Search System"
- **Commit** : "chore: Trigger workflow - Add version to refresh function"
- **Branche** : `claude/configure-company-search-01Be9mHyZZNNd2KUWVjowoFs`
- **Statut** : 🟡 En cours, 🟢 Succès, ou 🔴 Échec

---

## 📊 SCÉNARIOS POSSIBLES

### Scénario A : Le Workflow Apparaît et est 🟢 VERT

**✅ EXCELLENT !**

Le déploiement a réussi. Vous pouvez maintenant :

```bash
# Vérifier le déploiement
./verify-deployment.sh

# Tester le système
supabase functions invoke test-company-search
```

**→ Le problème est résolu !**

---

### Scénario B : Le Workflow Apparaît et est 🔴 ROUGE

**Des erreurs se sont produites.** Je dois voir les logs pour corriger.

#### Comment me partager les logs :

1. Allez sur : https://github.com/torp-fr/quote-insight-tally/actions
2. Cliquez sur le workflow en échec (🔴)
3. Cliquez sur le job "deploy" (à gauche)
4. Vous verrez plusieurs étapes :
   - 🔄 Checkout code
   - 📦 Setup Node.js
   - 🔧 Install Supabase CLI
   - 🔗 Link to Supabase project
   - 🗄️ Deploy Database Migration
   - 🚀 Deploy Edge Functions
   - etc.

5. **Trouvez l'étape avec une ❌ croix rouge**
6. **Cliquez dessus pour développer les logs**
7. **Copiez TOUT le message d'erreur**
8. **Partagez-le moi**

#### Erreurs Courantes et Solutions Rapides

##### ❌ Erreur : "Error: Invalid credentials"

**Cause** : Les secrets GitHub sont incorrects

**Solution** :

1. Allez sur : https://github.com/torp-fr/quote-insight-tally/settings/secrets/actions

2. Vérifiez ces 3 secrets (cliquez sur chacun pour voir s'il existe) :

   **A. SUPABASE_ACCESS_TOKEN**
   - Obtenez-le ici : https://supabase.com/dashboard/account/tokens
   - Cliquez sur "Generate new token"
   - Nom : "GitHub Actions"
   - Copiez le token
   - Collez dans GitHub Secrets

   **B. SUPABASE_PROJECT_ID**
   - Allez dans votre projet Supabase
   - Settings → General → Reference ID
   - Copiez l'ID (format : `abcdefghijklmnop`)
   - Collez dans GitHub Secrets

   **C. SUPABASE_DB_PASSWORD**
   - C'est le mot de passe de votre projet Supabase
   - Celui que vous avez défini à la création
   - Si oublié : Supabase Dashboard → Settings → Database → Reset password
   - Collez dans GitHub Secrets

3. Une fois les secrets corrigés, relancez le workflow :
   - GitHub Actions → Deploy Company Search System → Re-run all jobs

##### ❌ Erreur : "Error: Unable to locate executable file: supabase"

**Cause** : L'installation de Supabase CLI a échoué

**Solution** : C'est un problème temporaire GitHub. Relancez simplement le workflow :
- GitHub Actions → Deploy Company Search System → Re-run all jobs

##### ❌ Erreur : "Error: Project not found"

**Cause** : Le `SUPABASE_PROJECT_ID` est incorrect

**Solution** :

1. Allez dans Supabase Dashboard → Votre Projet → Settings → General
2. Copiez le "Reference ID" (pas le "Project URL")
3. Allez sur GitHub → Settings → Secrets → Actions
4. Éditez `SUPABASE_PROJECT_ID` et collez le bon ID
5. Relancez le workflow

##### ❌ Erreur : "Error: Failed to deploy function: [function-name]"

**Cause** : Problème dans le code de la fonction (syntaxe, imports, etc.)

**Solution** : Partagez-moi le log complet de l'erreur, je corrigerai le code immédiatement.

##### ❌ Erreur : "Error: process exited with code 1" (dans Deploy Database Migration)

**Cause** : La migration a peut-être déjà été appliquée (pas grave)

**Solution** : Ce n'est pas une vraie erreur si le workflow continue avec les autres étapes. Vérifiez si les étapes suivantes (Deploy Edge Functions) ont réussi.

---

### Scénario C : Le Workflow N'Apparaît TOUJOURS PAS

**Le workflow ne se déclenche pas du tout.**

Causes possibles :

#### 1. GitHub Actions est désactivé

**Vérifiez** : https://github.com/torp-fr/quote-insight-tally/settings/actions

**Solution** :
- "Actions permissions" → Sélectionnez "Allow all actions and reusable workflows"
- "Workflow permissions" → Sélectionnez "Read and write permissions"
- Cochez "Allow GitHub Actions to create and approve pull requests"
- Cliquez "Save"

#### 2. Les Secrets ne sont pas configurés (empêche le workflow de démarrer)

**Vérifiez** : https://github.com/torp-fr/quote-insight-tally/settings/secrets/actions

Vous devez voir **3 secrets** :
- ✅ SUPABASE_ACCESS_TOKEN
- ✅ SUPABASE_PROJECT_ID
- ✅ SUPABASE_DB_PASSWORD

**Si un manque**, ajoutez-le (voir Section "Erreur: Invalid credentials" ci-dessus).

#### 3. Le Workflow n'a pas été pushé sur GitHub

**Vérifiez localement** :

```bash
git log --oneline | grep workflow
# Devrait afficher : 6b17722 ci: Add GitHub Actions workflows for automatic deployment

ls .github/workflows/
# Devrait afficher : deploy-company-search.yml  test-company-search.yml
```

Si les fichiers existent localement, le problème n'est pas là.

#### 4. Déclenchez le Workflow Manuellement

Si rien ne fonctionne, forcez l'exécution manuelle :

1. Allez sur : https://github.com/torp-fr/quote-insight-tally/actions
2. Dans la barre de gauche, cherchez "Deploy Company Search System"
3. S'il apparaît, cliquez dessus
4. Cliquez sur "Run workflow" (bouton bleu en haut à droite)
5. Sélectionnez la branche `claude/configure-company-search-01Be9mHyZZNNd2KUWVjowoFs`
6. Cliquez "Run workflow"

---

## 🎯 CE QU'IL ME FAUT POUR VOUS AIDER

Si le workflow est en échec, partagez-moi :

### 1. Le Statut

"Le workflow est 🔴 rouge" ou "Le workflow n'apparaît pas du tout"

### 2. Les Logs d'Erreur (si workflow rouge)

Copiez-collez TOUT le message d'erreur de l'étape qui a échoué.

**Exemple de logs à partager** :

```
Run supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
Error: Invalid access token
Error: Process completed with exit code 1.
```

### 3. Confirmation des Secrets (si workflow n'apparaît pas)

Allez sur : https://github.com/torp-fr/quote-insight-tally/settings/secrets/actions

Dites-moi :
- ✅ ou ❌ SUPABASE_ACCESS_TOKEN est configuré
- ✅ ou ❌ SUPABASE_PROJECT_ID est configuré
- ✅ ou ❌ SUPABASE_DB_PASSWORD est configuré

### 4. GitHub Actions Activé ? (si workflow n'apparaît pas)

Allez sur : https://github.com/torp-fr/quote-insight-tally/settings/actions

Dites-moi ce qui est sélectionné dans "Actions permissions"

---

## 📞 PROCHAINES ÉTAPES

### MAINTENANT (dans les 60 prochaines secondes)

1. Allez sur : https://github.com/torp-fr/quote-insight-tally/actions
2. Attendez 30-60 secondes
3. Rafraîchissez la page (F5)
4. Regardez si un nouveau workflow apparaît avec le commit "chore: Trigger workflow"

### SI VERT ✅

→ Exécutez `./verify-deployment.sh` et testez le système

### SI ROUGE ❌

→ Copiez les logs d'erreur et partagez-les moi

### SI ABSENT ❓

→ Vérifiez GitHub Actions settings et les secrets, puis dites-moi ce que vous trouvez

---

## 🔗 LIENS RAPIDES

- **GitHub Actions** : https://github.com/torp-fr/quote-insight-tally/actions
- **GitHub Secrets** : https://github.com/torp-fr/quote-insight-tally/settings/secrets/actions
- **GitHub Actions Settings** : https://github.com/torp-fr/quote-insight-tally/settings/actions
- **Supabase Dashboard** : https://supabase.com/dashboard
- **Supabase Tokens** : https://supabase.com/dashboard/account/tokens

---

**Je suis là pour corriger immédiatement dès que vous me partagez les logs d'erreur ! 🚀**
