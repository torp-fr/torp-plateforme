# DTU 60.11 — Règles de calcul des installations de plomberie sanitaire et des installations d'évacuation des eaux pluviales

## 1. Objet et domaine d'application

Le présent document technique unifié (DTU) fixe les règles de calcul applicables aux installations de plomberie sanitaire intérieure, notamment pour l'alimentation en eau froide et en eau chaude sanitaire, ainsi que pour l'évacuation des eaux usées et des eaux pluviales dans les bâtiments d'habitation, tertiaires et industriels.

Ce DTU s'applique :
- Aux installations nouvelles ;
- Aux extensions ou modifications substantielles d'installations existantes ;
- Aux bâtiments dont le permis de construire est postérieur à la date de publication de ce document.

## 2. Références normatives

Les documents suivants sont indispensables pour l'application du présent document :
- NF EN 806-1 : Spécifications relatives aux installations pour l'eau destinée à la consommation humaine à l'intérieur des bâtiments — Partie 1 : Généralités.
- NF EN 806-2 : Conception des installations.
- NF EN 806-3 : Dimensionnement des tuyauteries.
- NF EN 1717 : Protection contre la pollution de l'eau potable dans les installations hydrauliques.
- NF P 41-201 : DTU 60.1 — Plomberie sanitaire pour bâtiments à usage d'habitation.

## 3. Débit de base et débit simultané

### 3.1 Débit de base des appareils

Le débit de base (DN) d'un appareil sanitaire est le débit minimal que doit délivrer l'installation pour assurer le fonctionnement satisfaisant de l'appareil. Les valeurs sont données dans le tableau 1.

| Appareil               | Débit de base (l/s) | Diamètre minimal alimentation |
|------------------------|---------------------|-------------------------------|
| Lavabo / vasque        | 0,10                | DN 10                         |
| Baignoire              | 0,25                | DN 12                         |
| Douche                 | 0,15                | DN 10                         |
| WC à chasse d'eau      | 0,10                | DN 10                         |
| Lave-linge             | 0,20                | DN 12                         |
| Lave-vaisselle         | 0,15                | DN 10                         |
| Évier cuisine          | 0,20                | DN 12                         |

### 3.2 Débit simultané

Le débit simultané Qs est calculé par application de la formule de probabilité d'usage :

```
Qs = Qb × √(n × p × (1 - p)) + n × p × Qb
```

Où :
- Qb = débit de base unitaire (l/s)
- n  = nombre total d'appareils raccordés
- p  = probabilité d'usage simultané (0,01 pour logements collectifs)

## 4. Dimensionnement des canalisations d'alimentation

### 4.1 Vitesse de l'eau

La vitesse de circulation de l'eau dans les canalisations doit être comprise entre :
- 0,5 m/s minimum (pour éviter la stagnation et la prolifération de légionelles)
- 2,0 m/s maximum en parties courantes (pour éviter l'érosion et les bruits)
- 3,0 m/s maximum aux organes de robinetterie et aux piquages

### 4.2 Pertes de charge

Les pertes de charge régulières sont calculées par la formule de Darcy-Weisbach :

```
ΔP = λ × (L/D) × (ρ × v²/2)
```

Où :
- λ  = coefficient de frottement (formule de Colebrook-White)
- L  = longueur du tronçon (m)
- D  = diamètre intérieur (m)
- ρ  = masse volumique de l'eau (1 000 kg/m³ à 20 °C)
- v  = vitesse d'écoulement (m/s)

Les pertes de charge singulières (coudes, tés, vannes) sont exprimées en longueur équivalente de tuyauterie droite, conformément aux abaques de l'annexe A.

### 4.3 Pression disponible

La pression minimale garantie en tout point de puisage doit être :
- 1 bar (100 kPa) pour les appareils courants ;
- 1,5 bar (150 kPa) pour les douchettes thermostatiques ;
- 3 bar (300 kPa) maximum en pied de colonne montante.

Un réducteur de pression est obligatoire lorsque la pression réseau dépasse 3 bar.

## 5. Protection contre la pollution — Disconnecteurs

Conformément à la NF EN 1717, toute installation doit comporter des dispositifs de protection contre le retour d'eau contaminée vers le réseau public.

### 5.1 Classement des risques

| Catégorie de risque | Exemple                          | Dispositif requis          |
|---------------------|----------------------------------|----------------------------|
| 1 — Eau potable     | Réseau public                    | Aucun                      |
| 2 — Faible risque   | Chauffe-eau domestique           | BA (clapet anti-retour)    |
| 3 — Risque moyen    | Lave-vaisselle professionnel     | EA (disconnecteur contrôlable) |
| 4 — Risque élevé    | Réseau d'arrosage enterré        | GA (disconnecteur à zone de pression réduite) |
| 5 — Risque grave    | Substances toxiques              | Rupture de charge totale   |

## 6. Eau chaude sanitaire — Prévention de la légionellose

### 6.1 Températures réglementaires

En application de l'arrêté du 30 novembre 2005 modifié :
- Température de production : ≥ 60 °C
- Température de distribution (au point de puisage, après 1 min) : ≥ 50 °C
- Température maximale aux points de puisage accessibles aux usagers : 50 °C (mitigeurs thermostatiques obligatoires dans les établissements recevant du public)

### 6.2 Bouclage ECS

Un réseau de bouclage est obligatoire lorsque la longueur de la canalisation depuis le générateur jusqu'au point de puisage le plus éloigné dépasse 8 m. Le débit de bouclage est calculé pour maintenir une température minimale de 50 °C en tous points.

## 7. Essais et réception

### 7.1 Essai de pression

Avant mise en service, les canalisations d'alimentation sont soumises à un essai de pression hydraulique à 1,5 fois la pression maximale de service, maintenu pendant 30 minutes sans chute de pression supérieure à 0,2 bar.

### 7.2 Contrôle de la qualité de l'eau

Un rinçage complet du réseau est effectué avant la mise en service. Un contrôle bactériologique est réalisé dans les installations à risque légionelle (hôpitaux, établissements d'hébergement pour personnes âgées, hôtels).

## 8. Dispositions particulières — Bâtiments de grande hauteur (BGH)

Pour les bâtiments dont la hauteur dépasse 28 m, les colonnes montantes doivent être découpées en zones de pression indépendantes, chaque zone ne dépassant pas 40 m de hauteur. Des réducteurs de pression en tête de zone assurent le maintien dans les plages réglementaires.

## Annexe A — Longueurs équivalentes des accessoires (informative)

| Accessoire              | DN 15 | DN 20 | DN 25 | DN 32 | DN 40 |
|-------------------------|-------|-------|-------|-------|-------|
| Coude 90°               | 0,5   | 0,6   | 0,8   | 1,0   | 1,2   |
| Coude 45°               | 0,3   | 0,4   | 0,5   | 0,6   | 0,8   |
| Té passage direct       | 0,3   | 0,4   | 0,5   | 0,6   | 0,7   |
| Té passage dérivé       | 1,2   | 1,5   | 2,0   | 2,5   | 3,0   |
| Vanne d'arrêt (ouverte) | 0,2   | 0,2   | 0,3   | 0,4   | 0,5   |
| Robinet d'équerre       | 4,0   | 5,0   | 6,0   | 7,5   | 9,0   |

_Longueurs en mètres de tuyauterie droite équivalente._
