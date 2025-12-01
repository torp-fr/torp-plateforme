# 🧪 Guide de Test des Services API B2B

> **Tests complets des 3 services API B2B**

---

## 📋 Prérequis

Avant de commencer :
- ✅ Migration SQL (007) appliquée
- ✅ Buckets Storage créés
- ✅ Policies RLS actives
- ✅ Application en cours d'exécution (`npm run dev`)
- ✅ Utilisateur connecté en B2B

---

## 🔐 Se connecter comme utilisateur B2B

### Option 1 : Console navigateur

Ouvre la console (F12) et exécute :

```javascript
// Importer le client Supabase
import { supabase } from '@/lib/supabase';

// Se connecter (ou créer un compte)
const { data, error } = await supabase.auth.signUp({
  email: 'test-pro@entreprise.fr',
  password: 'password123',
  options: {
    data: {
      user_type: 'B2B',
      name: 'Test Pro',
    }
  }
});

console.log('User créé:', data);

// Vérifier qu'on est connecté
const { data: { user } } = await supabase.auth.getUser();
console.log('User connecté:', user?.email);
```

---

## 📝 TEST 1 : Service Company (Profils Entreprise)

### 1.1 Vérifier SIRET (Mock)

```javascript
import { verifySiret } from '@/services/api/pro/companyService';

// Test avec un SIRET valide (format)
const result = await verifySiret('12345678901234');
console.log('✅ SIRET vérifié:', result);

// Résultat attendu:
// {
//   valid: true,
//   data: {
//     siren: '123456789',
//     siret: '12345678901234',
//     raison_sociale: 'ENTREPRISE TEST MOCK',
//     ...
//   }
// }

// Test avec un SIRET invalide
const invalid = await verifySiret('123'); // Trop court
console.log('❌ SIRET invalide:', invalid);
// { valid: false, error: 'Format SIRET invalide (14 chiffres requis)' }
```

### 1.2 Créer un profil entreprise

```javascript
import { createCompanyProfile } from '@/services/api/pro/companyService';

const profile = await createCompanyProfile({
  siret: '12345678901234',
  siren: '123456789',
  raison_sociale: 'Test Entreprise SARL',
  forme_juridique: 'SARL',
  code_naf: '4120A',
  adresse: '123 Rue du Test',
  code_postal: '75001',
  ville: 'Paris',
  telephone: '0123456789',
  email: 'contact@test-entreprise.fr',
  site_web: 'https://test-entreprise.fr',
  siret_verifie: false,
  user_id: 'auto-filled', // Ne pas spécifier, sera auto-rempli
});

console.log('✅ Profil créé:', profile);
```

### 1.3 Récupérer son profil

```javascript
import { getCompanyProfile } from '@/services/api/pro/companyService';

const myProfile = await getCompanyProfile();
console.log('📋 Mon profil:', myProfile);
```

### 1.4 Mettre à jour le profil

```javascript
import { updateCompanyProfile } from '@/services/api/pro/companyService';

const updated = await updateCompanyProfile(profile.id, {
  telephone: '0987654321',
  site_web: 'https://new-site.fr',
});

console.log('✏️ Profil mis à jour:', updated);
```

---

## 📄 TEST 2 : Service Documents

### 2.1 Créer un fichier de test

```javascript
// Créer un fichier PDF de test
const testFile = new File(
  ['Test KBIS Content'],
  'test-kbis.pdf',
  { type: 'application/pdf' }
);
```

### 2.2 Upload d'un document

```javascript
import { uploadCompanyDocument } from '@/services/api/pro/documentService';

const doc = await uploadCompanyDocument({
  company_id: profile.id, // ID du profil créé précédemment
  type: 'KBIS',
  nom: 'Kbis Test 2024',
  file: testFile,
  date_emission: '2024-01-15',
  date_expiration: '2024-12-31',
  numero_document: 'KBIS-123456',
  emetteur: 'Greffe du Tribunal de Commerce',
});

console.log('✅ Document uploadé:', doc);
console.log('📎 URL du fichier:', doc.file_url);
```

### 2.3 Lister les documents

```javascript
import { listCompanyDocuments } from '@/services/api/pro/documentService';

const documents = await listCompanyDocuments(profile.id);
console.log('📂 Liste des documents:', documents);
```

### 2.4 Vérifier les documents expirant

```javascript
import { checkExpiringDocuments } from '@/services/api/pro/documentService';

const expiring = await checkExpiringDocuments(profile.id);
console.log('⚠️ Documents expirant bientôt:', expiring);
```

### 2.5 Supprimer un document

```javascript
import { deleteCompanyDocument } from '@/services/api/pro/documentService';

await deleteCompanyDocument(doc.id);
console.log('🗑️ Document supprimé');
```

---

## 📊 TEST 3 : Service Analyses (Le plus complet)

### 3.1 Créer un fichier devis de test

```javascript
// Créer un fichier PDF de devis de test
const devisFile = new File(
  ['Devis Rénovation - 25 000€ HT'],
  'devis-renovation.pdf',
  { type: 'application/pdf' }
);
```

### 3.2 Créer une nouvelle analyse

```javascript
import { createAnalysis } from '@/services/api/pro/analysisService';

const analysis = await createAnalysis({
  company_id: profile.id,
  reference_devis: 'DEV-2024-001',
  nom_projet: 'Rénovation complète maison',
  montant_ht: 25000,
  montant_ttc: 30000,
  file: devisFile,
});

console.log('✅ Analyse créée (status PENDING):', analysis);
console.log('⏳ Attendre 5 secondes pour l\'analyse mock...');
```

### 3.3 Vérifier le résultat de l'analyse (après 5 sec)

```javascript
import { getAnalysis } from '@/services/api/pro/analysisService';

// Attendre que l'analyse mock se termine (5 secondes)
setTimeout(async () => {
  const result = await getAnalysis(analysis.id);
  console.log('✅ Analyse terminée:', result);
  console.log('📊 Score total:', result.score_total, '/1000');
  console.log('🎓 Grade:', result.grade);
  console.log('💡 Recommandations:', result.recommandations);
}, 5000);
```

### 3.4 Lister toutes les analyses

```javascript
import { listAnalyses } from '@/services/api/pro/analysisService';

const analyses = await listAnalyses(profile.id);
console.log('📋 Liste des analyses:', analyses);

// Avec filtres
const completed = await listAnalyses(profile.id, { status: 'COMPLETED' });
console.log('✅ Analyses terminées:', completed);
```

### 3.5 Générer un ticket TORP

```javascript
import { generateTicket } from '@/services/api/pro/analysisService';

// Attendre que l'analyse soit terminée (status: COMPLETED)
const ticket = await generateTicket(analysis.id);

console.log('🎟️ Ticket généré:');
console.log('   Code:', ticket.ticket_code); // Ex: TORP-ABC123XY
console.log('   URL publique:', `${window.location.origin}/t/${ticket.ticket_code}`);
console.log('   QR Code:', ticket.qr_code_url);
console.log('   PDF:', ticket.ticket_url);
```

### 3.6 Récupérer via ticket_code (sans auth)

```javascript
import { getAnalysisByTicketCode } from '@/services/api/pro/analysisService';

// Cette fonction est publique (pas besoin d'être connecté)
const publicAnalysis = await getAnalysisByTicketCode(ticket.ticket_code);
console.log('🌐 Analyse publique (via QR):', publicAnalysis);
```

### 3.7 Tracker une consultation de ticket

```javascript
import { trackTicketView } from '@/services/api/pro/analysisService';

// Simuler un scan de QR code
await trackTicketView(ticket.ticket_code, 'qr_scanned', {
  source: 'mobile',
  device: 'iPhone 15',
});

console.log('📍 Événement de tracking enregistré');
```

### 3.8 Voir les statistiques de tracking

```javascript
import { getTicketTracking } from '@/services/api/pro/analysisService';

const events = await getTicketTracking(analysis.id);
console.log('📈 Événements de tracking:', events);

// Vérifier le compteur de vues
const updated = await getAnalysis(analysis.id);
console.log('👁️ Nombre de vues:', updated.ticket_view_count);
```

---

## ✅ Vérifications dans Supabase Dashboard

### Vérifier les données dans les tables

Dans **Supabase Dashboard > Table Editor** :

**1. pro_company_profiles**
```sql
SELECT * FROM pro_company_profiles;
```
→ Devrait contenir ton profil entreprise

**2. company_documents**
```sql
SELECT id, company_id, type, nom, statut FROM company_documents;
```
→ Devrait contenir tes documents uploadés

**3. pro_devis_analyses**
```sql
SELECT id, reference_devis, status, score_total, grade FROM pro_devis_analyses;
```
→ Devrait contenir ton analyse avec le score

**4. ticket_tracking_events**
```sql
SELECT * FROM ticket_tracking_events;
```
→ Devrait contenir les événements de tracking

---

## 🗂️ Vérifier les fichiers dans Storage

Dans **Supabase Dashboard > Storage** :

**1. Bucket company-documents**
- Clique sur `company-documents`
- Tu devrais voir ton dossier : `[user_id]/`
- Dedans : `test-kbis.pdf`

**2. Bucket devis-analyses**
- Clique sur `devis-analyses`
- Tu devrais voir : `[user_id]/devis-renovation.pdf`

**3. Bucket tickets-torp**
- Vide pour l'instant (génération PDF à implémenter)

---

## 🎯 Tests de Sécurité RLS

### Test 1 : Impossible d'accéder aux données d'un autre user

```javascript
// Essayer de récupérer le profil d'un autre utilisateur
const { data, error } = await supabase
  .from('pro_company_profiles')
  .select('*')
  .eq('user_id', 'autre-user-id')
  .single();

console.log('Erreur attendue (RLS):', error);
// Devrait retourner null (pas d'accès)
```

### Test 2 : Impossible d'uploader dans le dossier d'un autre

```javascript
// Essayer d'uploader dans le dossier d'un autre user
const { error } = await supabase.storage
  .from('company-documents')
  .upload('autre-user-id/hack.pdf', testFile);

console.log('Erreur attendue (RLS):', error);
// Devrait échouer (permission denied)
```

---

## 📊 Résultat Attendu (Tout OK ✅)

Si tous les tests passent :

```
✅ Service Company
  ✓ Vérification SIRET (mock)
  ✓ Création profil entreprise
  ✓ Récupération profil
  ✓ Mise à jour profil

✅ Service Documents
  ✓ Upload document (Storage + DB)
  ✓ Liste documents
  ✓ Vérification documents expirant
  ✓ Suppression document

✅ Service Analyses
  ✓ Création analyse
  ✓ Analyse IA (mock, 5 secondes)
  ✓ Récupération résultats (score + grade)
  ✓ Génération ticket TORP
  ✓ Récupération publique via code
  ✓ Tracking consultations

✅ Sécurité RLS
  ✓ Isolation des données par user
  ✓ Impossible d'accéder aux fichiers d'autrui
```

---

## 🐛 Troubleshooting

### Erreur : "User not authenticated"
**Solution :** Vérifie que tu es bien connecté :
```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log(user); // Doit retourner un objet user
```

### Erreur : "Bucket not found"
**Solution :** Vérifie que les 3 buckets existent dans Storage Dashboard.

### Erreur : "Permission denied"
**Solution :** Vérifie que les RLS policies sont bien créées (12 policies).

### Analyse reste en status PENDING
**Solution :** Normal, l'analyse mock prend 5 secondes. Attends et rafraîchis.

---

## 🚀 Prochaine Étape

Une fois tous les services testés et validés :
1. 🎨 Créer les composants UI réutilisables
2. 📄 Implémenter les pages React
3. 🔌 Configurer le routing
4. 🤖 (Optionnel) Intégrer une vraie IA pour l'analyse

---

**Tous les services API B2B sont maintenant fonctionnels ! 🎉**
