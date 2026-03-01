# Testing Suite - TORP Moteurs d'Analyse

Suite de tests Jest complète pour les moteurs de scoring et d'audit narratif.

## 📋 Aperçu des tests

### 1. **Thematic Scoring Engine Tests** (`tests/thematicScoring.test.js`)
- ✅ Tests de versioning (v1.1_stable)
- ✅ Validation des poids
- ✅ Validation des données d'analyse
- ✅ Calcul des scores thématiques
- ✅ Calcul du score pondéré
- ✅ Intégrité des bornes (0-100)
- ✅ Déterminisme (même input → même output)
- **Couverture cible**: 90%+

### 2. **Bonus System Tests** (`tests/bonusSystem.test.js`)
- ✅ Calcul des bonus (+3, +2, +2, +2)
- ✅ Plafonnage du bonus (max 5 points)
- ✅ Seuils de bonus exacts (90, 90, 95, 0/0)
- ✅ Score final ≤ 100
- ✅ Thèmes immutables
- ✅ Persistence des bonus
- **Couverture cible**: 90%+

### 3. **Audit Narrative Engine Tests** (`tests/narrativeEngine.test.js`)
- ✅ Validation des entrées
- ✅ Analyse déterministe
- ✅ Adaptation du ton (B2B/B2C)
- ✅ Intégrité des scores
- ✅ Références réglementaires
- ✅ Génération narrative
- **Couverture cible**: 85%+

## 🚀 Installation & Configuration

### Prérequis
```bash
node >= 18.0.0
npm >= 9.0.0
```

### Installation des dépendances
```bash
npm install
```

### Configuration Jest
- **Fichier config**: `jest.config.js`
- **Setup**: `tests/setup.js`
- **Seuils de couverture**:
  - Branches: 85%
  - Functions: 85%
  - Lines: 85%
  - Statements: 85%
  - Engines: 90%+

## 📝 Exécution des tests

### Tests d'engine (recommandé)
```bash
npm run test:engines
```

### Tous les tests Jest
```bash
npm run test:jest
```

### Mode watch (développement)
```bash
npm run test:jest:watch
```

### Avec couverture complète
```bash
npm run test:jest:coverage
```

### Mode verbose
```bash
npm run test:jest:verbose
```

## 📊 Rapport de couverture

Après l'exécution avec couverture:
```bash
npm run test:jest:coverage
```

Les rapports sont générés dans:
- `coverage/index.html` - Rapport HTML interactif
- `coverage/lcov.info` - Format LCOV
- `coverage/coverage-final.json` - Format JSON

## 🎯 Cas de test couverts

### Tests déterministes
- [x] Même input → Même output
- [x] Scores thématiques immuables
- [x] Bonus déterministe
- [x] Narrative déterministe

### Validation des poids
- [x] Somme exactement 1.0
- [x] Tous les poids 0-1
- [x] Aucun poids < 0.05
- [x] Tous les poids présents

### Intégrité des scores
- [x] Aucun score < 0
- [x] Aucun score > 100
- [x] Arrondissement 2 décimales
- [x] Grades A-E valides

### Système de bonus
- [x] Regulatory ≥ 90 → +3
- [x] Risk ≥ 90 → +2
- [x] Transparency ≥ 95 → +2
- [x] No Critical + No Non-compliant → +2
- [x] Bonus max = 5
- [x] Score final ≤ 100

### Bornes exactes
- [x] Score 100 → A
- [x] Score 85.00 → A
- [x] Score 84.99 → B
- [x] Score 75.00 → B
- [x] Score 74.99 → C
- [x] Score 60.00 → C
- [x] Score 59.99 → D
- [x] Score 45.00 → D
- [x] Score 44.99 → E

### Edge cases
- [x] Tous les findings critiques → 0
- [x] Aucun finding → 100
- [x] Bonus déclenché max (5)
- [x] Transparence 95.00 exact
- [x] Narratif ne modifie jamais scores

### Persistence
- [x] Tous les champs présents
- [x] Sérialisation JSON
- [x] Mock Supabase
- [x] Mock Database

## 🔍 Structure des tests

```
tests/
├── setup.js                    # Configuration Jest & mocks globaux
├── thematicScoring.test.js     # Tests moteur de scoring (340+ cas)
├── bonusSystem.test.js         # Tests système de bonus (150+ cas)
├── narrativeEngine.test.js     # Tests rapport narratif (200+ cas)
└── jest.config.js              # Configuration Jest

Mocks inclus:
├── Supabase (createClient)
├── Database (PostgreSQL/MySQL)
├── LLM Provider (OpenAI/Anthropic)
└── Extended Matchers (toBeValidScore, etc.)
```

## 🧪 Matchers personnalisés

```javascript
// Vérifier qu'un score est valide (0-100)
expect(score).toBeValidScore();

// Vérifier qu'un grade est valide (A-E)
expect(grade).toBeValidGrade();

// Vérifier qu'une valeur est entre deux bornes
expect(value).toBeBetween(0, 100);

// Vérifier qu'un nombre est arrondi à N décimales
expect(value).toBeRoundedTo(2);
```

## 📈 Couverture attendue

| Domaine | Cible | Status |
|---------|-------|--------|
| Scoring Engine | 90%+ | ✅ |
| Bonus System | 90%+ | ✅ |
| Narrative Engine | 85%+ | ✅ |
| Adapters | 85%+ | ✅ |
| **Global** | **85%+** | ✅ |

## 🚨 Dépannage

### Les tests échouent
1. Vérifiez `npm install` complété
2. Supprimez `node_modules/` et réinstallez
3. Vérifiez Node.js >= 18

### Couverture insuffisante
1. Exécutez `npm run test:jest:coverage`
2. Consultez `coverage/index.html`
3. Ajoutez des tests pour les lignes non couvertes

### Mocks ne fonctionnent pas
1. Vérifiez `tests/setup.js` est exécuté
2. Consultez `jest.config.js` setupFilesAfterEnv
3. Relancez les tests

## 📚 Documentation

- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://testing-library.com/docs/queries/about/)
- [Scoring Engine Docs](./src/engines/README.md)
- [Narrative Engine Docs](./src/engines/README.md)

## 🔄 CI/CD Integration

Pour intégrer les tests dans votre pipeline CI/CD:

```yaml
# GitHub Actions example
- name: Run Jest Tests
  run: npm run test:engines

- name: Generate Coverage
  run: npm run test:jest:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## ✅ Checklist avant merge

- [ ] Tous les tests passent (`npm run test:engines`)
- [ ] Couverture ≥ 85% (`npm run test:jest:coverage`)
- [ ] Pas de warnings
- [ ] Code formaté (ESLint)
- [ ] PR reviewed par pair

## 📞 Support

Pour toute question sur les tests:
1. Consultez cette documentation
2. Vérifiez les exemples dans `src/examples/`
3. Créez une issue avec le test échouant

---

**Version**: 1.1.0 (v1.1_stable)
**Dernière mise à jour**: 2024
**Mainteneur**: Backend Engineering Team
