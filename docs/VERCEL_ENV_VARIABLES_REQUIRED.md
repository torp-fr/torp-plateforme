# ⚠️ CONFIGURATION VERCEL REQUISE

## 🔴 Variables d'environnement manquantes

Votre projet utilise **Vite** (pas Next.js), mais vos variables Vercel utilisent le préfixe **Next.js** (`NEXT_PUBLIC_*`).

### Variables actuelles (incorrectes pour Vite) :
```
NEXT_PUBLIC_SUPABASE_URL        ❌ Mauvais préfixe
NEXT_PUBLIC_SUPABASE_ANON_KEY   ❌ Mauvais préfixe
```

### Variables requises (préfixe Vite) :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📝 Actions à faire dans Vercel

### Étape 1 : Ajouter les variables VITE (CRITIQUE)

Aller dans **Settings → Environment Variables** et ajouter :

#### 1. **VITE_SUPABASE_URL**
- **Value** : La même valeur que `SUPABASE_URL`
- **Environments** : Production, Preview, Development
- **Type** : Plain Text

#### 2. **VITE_SUPABASE_ANON_KEY**
- **Value** : La même valeur que `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Environments** : Production, Preview, Development
- **Type** : Plain Text

---

### Étape 2 : Variables optionnelles (pour fonctionnalités avancées)

#### 3. **VITE_PAPPERS_API_KEY** (Optionnel)
- **Description** : Enrichissement données entreprises (capital, CA, dirigeants)
- **Value** : Votre clé API Pappers
- **Si non configuré** : Utilise uniquement SIRENE open data (gratuit)

#### 4. **VITE_OPENAI_API_KEY** ou **VITE_ANTHROPIC_API_KEY** (Requis pour analyse IA)
- **Description** : Analyse automatique des devis PDF
- **Value** : Votre clé API OpenAI ou Claude
- **Si non configuré** : Les analyses échouent avec message "IA non configurée"

---

## 🔧 Résumé des variables par fonctionnalité

### ✅ **Fonctionnalités de base (REQUIS)** :
```env
# Connexion Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Module B2B activé
VITE_B2B_ENABLED=true
```

### 🆓 **Vérification SIRET (Gratuit, fonctionne sans config)** :
```env
# Aucune configuration requise
# Utilise API SIRENE open data (gratuite)
# + Base Adresse Nationale (gratuite)
```

### 💰 **Enrichissement Pappers (Optionnel)** :
```env
VITE_PAPPERS_API_KEY=votre_cle_pappers
```

### 🤖 **Analyse IA des devis (Requis pour scoring)** :
```env
# Option A : OpenAI
VITE_OPENAI_API_KEY=sk-...

# Option B : Claude (Anthropic)
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_AI_PRIMARY_PROVIDER=claude
```

---

## 📊 Tableau récapitulatif

| Variable | Statut Actuel | Requis | Gratuit | Impact si manquante |
|----------|---------------|--------|---------|---------------------|
| `VITE_SUPABASE_URL` | ❌ Manquante | ✅ Oui | ✅ Oui | Application ne fonctionne pas |
| `VITE_SUPABASE_ANON_KEY` | ❌ Manquante | ✅ Oui | ✅ Oui | Authentification impossible |
| `VITE_B2B_ENABLED` | ✅ Configurée | ✅ Oui | ✅ Oui | Module B2B désactivé |
| `VITE_PAPPERS_API_KEY` | ❌ Manquante | ❌ Non | ❌ Non | Pas de données financières enrichies |
| `VITE_OPENAI_API_KEY` | ❌ Manquante | ⚠️ Oui* | ❌ Non | Analyses de devis échouent |
| `VITE_ANTHROPIC_API_KEY` | ❌ Manquante | ⚠️ Oui* | ❌ Non | Alternative à OpenAI |

**\*** Au moins une des deux APIs IA est requise pour l'analyse automatique des devis.

---

## 🚨 Erreurs probables actuelles

### Erreur 1 : Application ne charge pas
```javascript
Error: import.meta.env.VITE_SUPABASE_URL is undefined
```
**Cause** : Variables Next.js au lieu de Vite
**Solution** : Ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`

### Erreur 2 : Analyses échouent avec "IA non configurée"
```javascript
status: 'FAILED'
metadata: {
  error: "Moteur d'analyse IA non configuré"
}
```
**Cause** : Pas de clé OpenAI ou Claude
**Solution** : Ajouter `VITE_OPENAI_API_KEY` ou `VITE_ANTHROPIC_API_KEY`

### Erreur 3 : Vérification SIRET retourne "Non disponible"
```javascript
raison_sociale: "Non disponible"
forme_juridique: "Non disponible"
```
**Cause** : SIRET inexistant dans base SIRENE
**Solution** : Vérifier le numéro SIRET saisi

---

## ✅ Checklist de configuration

- [ ] Ajouter `VITE_SUPABASE_URL` dans Vercel
- [ ] Ajouter `VITE_SUPABASE_ANON_KEY` dans Vercel
- [ ] Vérifier que `VITE_B2B_ENABLED=true`
- [ ] (Optionnel) Ajouter `VITE_PAPPERS_API_KEY`
- [ ] (Requis pour IA) Ajouter `VITE_OPENAI_API_KEY` ou `VITE_ANTHROPIC_API_KEY`
- [ ] Redéployer l'application après ajout des variables
- [ ] Tester l'onboarding B2B avec un SIRET réel
- [ ] Tester l'analyse d'un devis

---

## 📚 Documentation

- **Variables Vite** : https://vitejs.dev/guide/env-and-mode.html
- **Supabase** : https://supabase.com/docs/guides/getting-started
- **API Pappers** : https://www.pappers.fr/api
- **OpenAI API** : https://platform.openai.com/docs
- **Claude API** : https://console.anthropic.com/docs

---

## 🆘 Support

Si vous avez des questions :
1. Vérifiez les logs Vercel (Runtime Logs)
2. Vérifiez la console navigateur (F12)
3. Consultez `docs/B2B_APIS_OPEN_SOURCE.md` pour les APIs gratuites
4. Consultez `GUIDE_IMPLEMENTATION_B2B.md` pour l'analyse IA
