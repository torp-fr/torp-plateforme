# Guide de mise en œuvre — Pompe à chaleur air/eau pour chauffage et ECS

## 1. Présentation du système

Une pompe à chaleur (PAC) air/eau extrait les calories contenues dans l'air extérieur pour les transférer au circuit hydraulique de chauffage et/ou de production d'eau chaude sanitaire (ECS). Elle est caractérisée par son coefficient de performance (COP) qui représente le rapport entre l'énergie thermique produite et l'énergie électrique consommée.

Pour les PAC air/eau dimensionnées conformément à la RE 2020, le COP saisonnier (SCOP) doit être supérieur ou égal à 2,5 en zone H1 et 2,7 en zones H2 et H3.

## 2. Pré-requis de chantier

### 2.1 Espace disponible

- Unité extérieure : dégagement d'au moins 0,5 m sur les côtés, 1,0 m à l'avant (soufflage), 0,3 m à l'arrière.
- Unité intérieure (module hydraulique) : local technique ventilé, température comprise entre +5 °C et +40 °C.
- Distance maximale entre unité extérieure et module hydraulique : selon fabricant (généralement ≤ 25 m pour les liaisons frigorifiques pré-chargées).

### 2.2 Accès électrique

- Alimentation dédiée : disjoncteur différentiel 30 mA type A, calibre selon puissance nominale.
- Section minimale des câbles : selon NF C 15-100 et tableau constructeur.
- Mise à la terre obligatoire.

### 2.3 Circuit hydraulique

- Pression maximale du circuit : 3 bar (vérifier la compatibilité du vase d'expansion).
- Qualité de l'eau : pH compris entre 6 et 9, TH ≤ 25 °f (prévoir adoucisseur si besoin).
- Filtre anti-magnétite obligatoire sur le retour chaudière/PAC.
- Désembouage du réseau existant avant raccordement.

## 3. Étapes d'installation

### 3.1 Pose de l'unité extérieure

1. Fixer le châssis anti-vibratile sur dalle béton ou structure métallique (vérifier le niveau).
2. Respecter les orientations de soufflage indiquées par le fabricant (éviter soufflage vers la façade, vers une fenêtre ou vers l'espace public).
3. Dans les régions à risque de gel, surélever l'unité de 15 cm minimum au-dessus du niveau de neige habituel.
4. Prévoir un bac de récupération des condensats avec écoulement vers un réseau d'eaux pluviales ou un puisard. La mise à l'égout des condensats est interdite sans neutralisation du pH.

### 3.2 Liaisons frigorifiques

Le circuit frigorifique doit être réalisé par un technicien titulaire de l'attestation de capacité conformément au règlement CE n°842/2006 et au décret n°2015-1790.

- Utiliser uniquement des tubes cuivre déshydraté, recuit, spécial frigorigène.
- Calorifuger les liaisons avec isolant cellulaire fermé, épaisseur ≥ 13 mm.
- Après raccordement, réaliser un test d'étanchéité à l'azote sec (pression selon fluide frigorigène : R410A → 40 bar, R32 → 40 bar, R290 → 25 bar).
- Effectuer le tirage au vide (≤ 200 µmHg) avant mise en service.
- Le charge en fluide frigorigène est réalisée uniquement par le technicien certifié.

### 3.3 Raccordement hydraulique

1. Connecter les liaisons aller/retour en respectant le sens de circulation indiqué sur le module hydraulique.
2. Installer les vannes d'isolement avant/après le module pour faciliter la maintenance.
3. Raccorder le vase d'expansion (pression de pré-gonflage = pression statique + 0,2 bar).
4. Raccorder le circuit ECS si production intégrée (ballon tampon ou ballon ECS dédié avec serpentin).
5. Purger l'ensemble du circuit hydraulique.
6. Effectuer un essai de pression hydraulique à 1,5 × pression maximale (min. 4,5 bar).
7. Contrôler l'absence de fuite sur toutes les connexions.

### 3.4 Raccordement électrique

- Câblage selon le schéma électrique fourni par le fabricant.
- Connexion de la sonde extérieure (météo) sur l'emplacement prévu.
- Connexion des sondes de température circuit(s) (départ, retour, ECS).
- Connexion des thermostats d'ambiance ou du système de régulation (fil pilote, bus KNX/ModBus selon équipement).
- Vérification du serrage de tous les borniers.
- Contrôle de l'isolement avant mise sous tension.

## 4. Mise en service

### 4.1 Paramétrage de la loi d'eau

La loi d'eau définit la température de départ du circuit de chauffage en fonction de la température extérieure. Elle doit être adaptée au type d'émetteurs :

| Émetteur                        | Température départ max | Pente loi d'eau indicative |
|---------------------------------|------------------------|----------------------------|
| Plancher chauffant basse temp.  | 35 °C                  | 0,4 à 0,6                  |
| Radiateurs basse température    | 45 °C                  | 0,7 à 0,9                  |
| Radiateurs haute température    | 70 °C                  | 1,2 à 1,5                  |
| Ventilo-convecteurs             | 45 °C                  | 0,8 à 1,0                  |

### 4.2 Paramétrage ECS

- Température de consigne du ballon ECS : 55 °C (pasteurisation quotidienne à 60 °C recommandée).
- Plage de fonctionnement nocturne (ECS) : programmation entre 23 h et 6 h pour bénéficier de l'heure creuse.
- Résistance d'appoint : désactiver en saison estivale pour maximiser le COP.

### 4.3 Vérification des performances

Après 72 h de fonctionnement en conditions normales :
- Relever la puissance électrique absorbée (W) et la puissance thermique produite (W).
- Calculer le COP instantané : COP = P_thermique / P_électrique.
- Comparer avec le COP certifié Eurovent (conditions A7/W35 ou A2/W35 selon saison).
- Un COP mesuré inférieur de plus de 15 % au COP certifié nécessite un diagnostic complémentaire.

## 5. Maintenance préventive

### 5.1 Opérations annuelles

- Nettoyage de l'échangeur air (évaporateur) à l'eau propre ou aspirateur (sens inverse du soufflage).
- Vérification du niveau de charge en fluide frigorigène (recherche de fuites par détecteur électronique).
- Contrôle de la pression du circuit hydraulique et du vase d'expansion.
- Vérification des connexions électriques et serrage des borniers.
- Nettoyage du filtre anti-magnétite et du filtre anti-particules.
- Contrôle du pH et de l'inhibiteur de corrosion dans le circuit hydraulique.
- Test des sécurités (pressostat haute pression, pressostat basse pression, limiteur thermique).

### 5.2 Carnet d'entretien

Un carnet d'entretien doit être tenu à jour et conservé pendant toute la durée de vie de l'installation. Il mentionne :
- Date et nature des interventions ;
- Nom et numéro d'attestation de capacité du technicien ;
- Charges et recharges de fluide frigorigène (quantité, nature) ;
- Résultats des tests d'étanchéité.

## 6. Aide publique — Conditions d'éligibilité MaPrimeRénov'

Pour être éligible à MaPrimeRénov' (arrêté du 14 janvier 2020 modifié) :
- L'équipement doit remplacer une chaudière au fioul, au charbon ou au gaz.
- Le SCOP doit être ≥ 3,4 (mesuré selon EN 14511 ou EN 14825).
- L'installation doit être réalisée par un artisan certifié RGE mention « Installations de pompes à chaleur ».
- Le logement doit être achevé depuis plus de 2 ans.

Le montant de l'aide varie selon les revenus du ménage et la zone climatique (de 3 000 € à 10 000 €).
