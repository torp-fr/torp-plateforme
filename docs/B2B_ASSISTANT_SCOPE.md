# 🏗️ TORP B2B - Assistant d'Optimisation de Devis

> **Documentation technique du périmètre B2B clarifiée**
> Version: 1.0 - MVP Pragmatique

---

## 📋 TABLE DES MATIÈRES

1. [Vision B2B](#vision-b2b)
2. [Différences B2C vs B2B](#différences-b2c-vs-b2b)
3. [Fonctionnalités B2B MVP](#fonctionnalités-b2b-mvp)
4. [Fonctionnalités SUPPRIMÉES](#fonctionnalités-supprimées)
5. [Cas d'usage B2B](#cas-dusage-b2b)
6. [Architecture technique](#architecture-technique)

---

## 🎯 VISION B2B

### Objectif Principal

**TORP B2B est un assistant qui aide les professionnels BTP à optimiser LEURS PROPRES devis AVANT de les envoyer à leurs clients.**

### Ce que TORP B2B N'EST PAS

❌ Un marketplace de matériaux
❌ Un CRM de gestion client
❌ Un outil de gestion d'équipe
❌ Un système de financement de projets
❌ Une plateforme de mise en relation pros/clients

### Ce que TORP B2B EST

✅ Un assistant d'analyse et d'optimisation de devis
✅ Un outil d'amélioration du taux de signature
✅ Un système de notation de transparence (score TORP)
✅ Un générateur de QR codes de certification
✅ Un tracker de devis avec lien de suivi client

---

## 🔄 DIFFÉRENCES B2C vs B2B

### B2C - Particuliers

**Contexte:** Le particulier a REÇU un devis d'un professionnel

**Objectif:** Analyser le devis reçu pour aider à la décision

**Actions:**
- ✅ Upload du devis PDF reçu
- ✅ Analyse du score TORP du professionnel
- ✅ Vérification de la fiabilité de l'entreprise
- ✅ Recommandations pour négocier
- ✅ Aide à la prise de décision (accepter/refuser)

**Workflow:**
```
Particulier reçoit devis → Upload dans TORP → Analyse + Recommandations → Décision éclairée
```

---

### B2B - Professionnels BTP

**Contexte:** Le professionnel va ENVOYER son devis à un client

**Objectif:** Optimiser son propre devis avant envoi pour améliorer le taux de signature

**Actions:**
- ✅ Upload de SON devis avant envoi
- ✅ Analyse du score TORP qu'il obtiendra
- ✅ Recommandations d'amélioration du devis
- ✅ Suggestions pour augmenter la transparence
- ✅ Génération du QR code de certification
- ✅ Création d'un lien de tracking pour le client
- ✅ Badge "TORP Pro" pour supports marketing

**Workflow:**
```
Pro crée devis → Upload dans TORP → Recommandations → Optimisation → Certification + QR → Envoi au client
```

---

## ✨ FONCTIONNALITÉS B2B MVP

### 1. Analyse de Devis Pro

**Description:** Analyse du devis du professionnel avec notation TORP

**Fonctionnalités:**
- Upload du devis (PDF, image, texte)
- Calcul du score TORP (Transparence, Offre, Robustesse, Prix)
- Détection des points faibles
- Identification des éléments manquants

**Livrables:**
- Score TORP global (A+, A, B+, B, C, etc.)
- Détail des 4 critères (T, O, R, P)
- Rapport d'analyse complet

---

### 2. Recommandations d'Optimisation IA

**Description:** Suggestions concrètes pour améliorer le devis

**Types de recommandations:**
- **Transparence:** "Ajoutez les détails des matériaux utilisés"
- **Offre:** "Précisez le délai d'exécution en jours ouvrés"
- **Robustesse:** "Incluez la garantie décennale explicitement"
- **Prix:** "Détaillez le coût de la main d'œuvre"

**Format:**
- 3-5 recommandations prioritaires
- Impact estimé sur le score (+0.3pts, +0.5pts, etc.)
- Niveau de difficulté (Facile, Moyen, Avancé)
- Exemples de formulation

---

### 3. Certification TORP Pro

**Description:** Badge de certification pour valoriser le professionnalisme

**Éléments:**
- **Logo TORP Pro** à insérer sur le devis
- **Score visible** (ex: "Score TORP: B+ - 8.2/10")
- **QR Code de certification** généré automatiquement

**Avantages:**
- Différenciation concurrentielle
- Rassure le client sur la qualité
- Traçabilité et transparence

---

### 4. QR Code et Tracking

**Description:** Système de suivi et d'accès rapide pour le client final

**Fonctionnement:**

1. **Génération QR Code:**
   - Créé automatiquement après analyse
   - Lié à une URL unique (ex: `torp.fr/devis/abc123`)
   - À imprimer sur le devis

2. **Scan client:**
   - Le client scanne le QR code
   - Accède instantanément au résumé de l'analyse TORP
   - Voit le score et les garanties

3. **Tracking:**
   - Le pro voit si le client a scanné le QR
   - Timestamp de consultation
   - Nombre de consultations

**Bénéfices:**
- Transparence totale
- Confiance renforcée
- Modernité du processus

---

### 5. Assistant IA Conversationnel

**Description:** Chat IA pour accompagner le professionnel

**Cas d'usage:**
- "Comment améliorer mon score Transparence ?"
- "Quelle formulation utiliser pour les garanties ?"
- "Comment justifier ce prix au client ?"

**Fonctionnalités:**
- Réponses contextuelles basées sur l'analyse du devis
- Suggestions de templates de texte
- Explications pédagogiques sur le scoring TORP

---

## ❌ FONCTIONNALITÉS SUPPRIMÉES

### Supprimé du scope B2B (Phase 1)

| Fonctionnalité | Raison | Alternative |
|----------------|--------|-------------|
| **Marketplace matériaux** | Hors périmètre MVP | Le pro utilise ses fournisseurs habituels |
| **Gestion d'équipe** | Complexité excessive | Focus sur l'individuel pour le MVP |
| **Planning équipe** | Hors scope TORP | Outils de planning dédiés (ex: Monday, Trello) |
| **Multi-projet** | Trop complexe pour MVP | Gestion séquentielle des devis |
| **ClientPortfolio** | CRM-like, hors scope | Le pro utilise son CRM existant |
| **FinancingPlatform** | Nécessite partenariats | Non prioritaire pour MVP |

---

## 📖 CAS D'USAGE B2B

### Cas 1: Nouveau devis à envoyer

**Contexte:** Marc, électricien, vient de créer un devis pour une rénovation complète

**Workflow:**

1. Marc upload son devis PDF dans TORP
2. TORP analyse et donne un score: **B (7.8/10)**
3. Recommandations:
   - "Ajoutez la norme NFC 15-100 pour la Robustesse (+0.4pts)"
   - "Détaillez les références des matériaux pour la Transparence (+0.3pts)"
   - "Précisez le délai en jours pour l'Offre (+0.2pts)"
4. Marc applique les 3 suggestions
5. Nouveau score: **A- (8.7/10)**
6. TORP génère:
   - Badge TORP Pro avec score
   - QR Code de certification
   - Lien de tracking
7. Marc imprime le badge sur son devis et l'envoie au client
8. Le client scanne le QR, voit l'analyse TORP → **confiance accrue**
9. Taux de signature: **+34%**

---

### Cas 2: Amélioration d'un devis refusé

**Contexte:** Sophie, plombière, a vu son devis refusé par un client

**Workflow:**

1. Sophie upload le devis refusé dans TORP
2. Analyse: **C+ (6.2/10)** - faible score Transparence
3. TORP identifie:
   - Manque détails matériaux ❌
   - Pas de garanties mentionnées ❌
   - Prix global sans décomposition ❌
4. Sophie reformule son devis en suivant les recommandations
5. Nouveau score: **B+ (8.4/10)**
6. Elle renvoie la version optimisée au client
7. **Devis accepté** ✅

---

## 🏗️ ARCHITECTURE TECHNIQUE

### Structure des composants B2B conservés

```
src/
├── pages/
│   ├── B2BDashboard.tsx              ← Dashboard principal B2B
│   └── ImprovedB2BDashboard.tsx      ← Version améliorée (sans marketplace/équipe)
│
├── components/
│   ├── pricing/
│   │   └── B2BPricing.tsx            ← Tarifs B2B (mode gratuit actif)
│   │
│   ├── AdvancedAnalytics.tsx         ← Analytics scoring devis
│   ├── ActiveAssistant.tsx           ← Chat IA assistant
│   └── PaymentManager.tsx            ← Gestion paiements (inactif en mode gratuit)
│
└── services/
    ├── scoringService.ts             ← Calcul score TORP
    └── qrCodeService.ts              ← Génération QR codes
```

### Données B2B simplifiées

**Table: `b2b_quotes`**
```sql
CREATE TABLE b2b_quotes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  quote_file_url TEXT,
  torp_score JSONB,  -- {overall: 8.2, T: 8.5, O: 7.8, R: 8.9, P: 7.6}
  recommendations JSONB[],
  qr_code_url TEXT,
  tracking_url TEXT,
  status TEXT,  -- 'draft', 'sent', 'viewed', 'accepted', 'rejected'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Table: `quote_tracking_events`**
```sql
CREATE TABLE quote_tracking_events (
  id UUID PRIMARY KEY,
  quote_id UUID REFERENCES b2b_quotes(id),
  event_type TEXT,  -- 'qr_scanned', 'link_viewed', 'pdf_downloaded'
  timestamp TIMESTAMP,
  user_agent TEXT,
  ip_address TEXT
);
```

---

## 🎯 ROADMAP POST-MVP

### Phase 2 (Après validation MVP)

- Templates de devis par métier (électricien, plombier, maçon, etc.)
- Comparaison avec moyennes du secteur
- Export multi-formats (PDF, Word, Excel)
- Intégration calendrier (Google Cal, Outlook)

### Phase 3 (Si demande utilisateurs)

- API REST pour intégration CRM existants
- Application mobile (upload photos de devis terrain)
- Signature électronique intégrée
- Multi-utilisateurs (TPE/PME avec équipes)

---

## 📞 SUPPORT & FEEDBACK

Pour toute question sur le périmètre B2B:
- Consulter la documentation complète dans `/docs`
- Vérifier les exemples de code dans `/examples/b2b`
- Ouvrir une issue GitHub pour suggestions

---

**Document maintenu par:** Équipe TORP
**Dernière mise à jour:** 26 Novembre 2025
**Version:** 1.0 - MVP Pragmatique
