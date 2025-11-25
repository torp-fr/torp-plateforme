# 🎯 GUIDE : Remplir les Fonctions Vides dans Supabase

**Situation** : Vous avez créé 3 fonctions vides dans Supabase Dashboard. Il faut maintenant les remplir avec du code.

**Durée** : 5 minutes (2 minutes par fonction)

---

## 📋 LES 3 FONCTIONS À REMPLIR

1. ✅ `test-company-search`
2. ✅ `refresh-company-cache`
3. ✅ `cleanup-company-cache`

---

## 🚀 ÉTAPES POUR CHAQUE FONCTION

### FONCTION 1 : test-company-search

#### 1. Ouvrir la fonction dans Supabase

**Allez sur** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/functions

**Cliquez** sur : `test-company-search`

#### 2. Copier le code

Dans votre éditeur local, ouvrez le fichier :
```
test-company-search-standalone.ts
```

**Sélectionnez TOUT** (Ctrl+A ou Cmd+A)
**Copiez** (Ctrl+C ou Cmd+C)

#### 3. Coller dans Supabase

- Dans Supabase Dashboard, **effacez** tout le contenu actuel de la fonction
- **Collez** le code que vous venez de copier (Ctrl+V ou Cmd+V)
- **Cliquez** sur "Deploy" (ou "Save and deploy")

#### 4. Tester

Une fois déployée :
- Cliquez sur "Invoke function"
- Vous devriez voir :
  ```json
  {
    "success": true,
    "totalTests": 7,
    "passed": 7,
    "failed": 0
  }
  ```

---

### FONCTION 2 : refresh-company-cache

#### 1. Ouvrir la fonction

**Cliquez** sur : `refresh-company-cache`

#### 2. Copier le code

Ouvrez le fichier :
```
refresh-company-cache-standalone.ts
```

**Sélectionnez TOUT** → **Copiez**

#### 3. Coller dans Supabase

- **Effacez** le contenu actuel
- **Collez** le nouveau code
- **Cliquez** "Deploy"

#### 4. Tester

Une fois déployée :
- Cliquez sur "Invoke function"
- Dans le body, mettez :
  ```json
  {
    "maxCompanies": 5,
    "forceAll": false
  }
  ```
- Cliquez "Invoke"
- Résultat attendu :
  ```json
  {
    "success": true,
    "message": "No companies need refreshing" (ou liste des entreprises)
  }
  ```

---

### FONCTION 3 : cleanup-company-cache

#### 1. Ouvrir la fonction

**Cliquez** sur : `cleanup-company-cache`

#### 2. Copier le code

Ouvrez le fichier :
```
cleanup-company-cache-standalone.ts
```

**Sélectionnez TOUT** → **Copiez**

#### 3. Coller dans Supabase

- **Effacez** le contenu actuel
- **Collez** le nouveau code
- **Cliquez** "Deploy"

#### 4. Tester (Mode Dry-Run)

Une fois déployée :
- Cliquez sur "Invoke function"
- Dans le body, mettez :
  ```json
  {
    "dryRun": true
  }
  ```
- Cliquez "Invoke"
- Résultat attendu :
  ```json
  {
    "success": true,
    "dryRun": true,
    "wouldDelete": 0 (ou nombre d'entrées)
  }
  ```

---

## ✅ CHECKLIST FINALE

Après avoir rempli les 3 fonctions :

- [ ] `test-company-search` déployée et testée (7/7 tests passent)
- [ ] `refresh-company-cache` déployée et testée (retourne success)
- [ ] `cleanup-company-cache` déployée et testée (dry-run fonctionne)

---

## 🎯 RÉSUMÉ VISUEL

```
Pour chaque fonction :

1. Ouvrir dans Dashboard Supabase
   ↓
2. Copier le fichier *-standalone.ts
   ↓
3. Coller dans l'éditeur Supabase
   ↓
4. Deploy
   ↓
5. Tester avec "Invoke"
   ↓
✅ FAIT !
```

---

## 📊 FICHIERS À UTILISER

| Fonction Supabase | Fichier Local |
|-------------------|---------------|
| `test-company-search` | `test-company-search-standalone.ts` |
| `refresh-company-cache` | `refresh-company-cache-standalone.ts` |
| `cleanup-company-cache` | `cleanup-company-cache-standalone.ts` |

---

## 🆘 EN CAS DE PROBLÈME

### Erreur lors du déploiement

**Message** : "Invalid syntax" ou "Cannot parse"
**Cause** : Vous n'avez pas copié tout le fichier
**Solution** : Retournez au fichier, faites Ctrl+A (tout sélectionner), puis recopiez

### La fonction ne s'invoque pas

**Message** : "Function not found" ou erreur 404
**Cause** : Le déploiement n'a pas fonctionné
**Solution** : Cliquez à nouveau sur "Deploy" et attendez que le statut passe à "Active"

### Tests échouent

**Message** : Dans test-company-search, certains tests sont "FAIL"
**Cause possible** : Les tables ou fonctions PostgreSQL ne sont pas créées
**Solution** : Vérifiez que la migration SQL a bien été appliquée (voir VERIFICATION_COMPLETE.md)

---

## ✨ APRÈS AVOIR TOUT REMPLI

Une fois les 3 fonctions déployées et testées :

1. **Vérifiez** : https://supabase.com/dashboard/project/zvxasiwahpraasjzfhhl/functions
   - Les 3 fonctions doivent avoir un statut "Active"
   - Chacune doit avoir du code (plus de coquille vide)

2. **Testez** : Invoquez `test-company-search`
   - Doit retourner : `"passed": 7`

3. **C'est prêt** ! Le système est maintenant 100% opérationnel ! 🎉

---

**Commencez par la FONCTION 1 (test-company-search) maintenant !** 🚀
