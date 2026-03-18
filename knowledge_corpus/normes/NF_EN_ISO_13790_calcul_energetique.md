# NF EN ISO 13790 — Calcul des besoins d'énergie pour le chauffage et le refroidissement des bâtiments

## 1. Domaine d'application

La présente norme internationale spécifie des méthodes de calcul des besoins annuels en énergie pour le chauffage et le refroidissement des espaces, destinées à la conception énergétique des bâtiments, aux bilans énergétiques réglementaires (RE 2020, DPE) et aux certifications volontaires (HQE, BREEAM, LEED).

Elle définit trois méthodes de calcul :
- **Méthode mensuelle** : calcul mois par mois des besoins thermiques (adaptée aux outils de certification).
- **Méthode saisonnière** : bilan sur la saison de chauffe ou de refroidissement (usage réglementaire simplifié).
- **Méthode horaire simplifiée** : intégration sur l'heure, plus précise mais plus coûteuse en temps de calcul.

## 2. Définitions et notations

| Symbole | Grandeur                                            | Unité |
|---------|-----------------------------------------------------|-------|
| Q_H     | Besoins de chauffage                                | kWh   |
| Q_C     | Besoins de refroidissement                          | kWh   |
| Q_int   | Apports internes (occupants, équipements, éclairage) | kWh  |
| Q_sol   | Apports solaires (vitrages, parois opaques)         | kWh   |
| Q_ht    | Déperditions totales par transmission et ventilation| kWh   |
| η_H     | Facteur d'utilisation des apports pour chauffage   | sans  |
| η_C     | Facteur d'utilisation des déperditions pour refroid.| sans  |
| γ_H     | Rapport apports/déperditions en chauffage           | sans  |
| τ       | Constante de temps du bâtiment                     | h     |

## 3. Calcul des besoins de chauffage (méthode mensuelle)

### 3.1 Principe général

Pour chaque mois `m`, les besoins de chauffage sont calculés par :

```
Q_H,nd = Q_ht - η_H × Q_sol+int
```

Où :
```
Q_ht       = H_tr × (θ_int - θ_ext) × t + Q_ve
Q_sol+int  = Q_sol + Q_int
```

Si `Q_ht < Q_sol+int` (gains supérieurs aux déperditions), les besoins de chauffage sont nuls.

### 3.2 Calcul de la constante de temps

```
τ = C_m / (H_tr + H_ve)
```

Où `C_m` est la capacité thermique interne effective du bâtiment (kWh/K) :

```
C_m = Σ (κ_j × A_j)    pour j ∈ {éléments de construction}
```

Les valeurs de `κ_j` (capacité thermique surfacique, kJ/(m²·K)) sont tabulées en annexe selon la nature des parois (béton lourd, brique, bois, plâtre).

### 3.3 Facteur d'utilisation des apports

Le facteur `η_H` dépend du rapport gains/déperditions `γ_H = Q_sol+int / Q_ht` et du paramètre de forme `a_H` :

```
Si γ_H ≠ 1 :  η_H = (1 - γ_H^a_H) / (1 - γ_H^(a_H+1))
Si γ_H = 1 :  η_H = a_H / (a_H + 1)
```

Avec `a_H = a_0 + τ / τ_H,0` où `a_0 = 1,0` et `τ_H,0 = 15 h`.

## 4. Calcul des besoins de refroidissement

### 4.1 Principe

```
Q_C,nd = Q_sol+int - η_C × Q_ht
```

Si `Q_sol+int < Q_ht`, les besoins de refroidissement sont nuls.

### 4.2 Facteur d'utilisation des déperditions

```
γ_C = Q_ht / Q_sol+int

Si γ_C ≠ 1 :  η_C = (1 - γ_C^a_C) / (1 - γ_C^(a_C+1))
```

Avec `a_C = a_0 + τ / τ_C,0` où `τ_C,0 = 30 h`.

## 5. Transmission thermique et ponts thermiques

### 5.1 Coefficient de déperdition par transmission

```
H_tr = Σ (A_i × U_i) + Σ (l_k × ψ_k) + Σ χ_j
```

Où :
- `A_i × U_i` : déperdition surfacique par les parois opaques et vitrages ;
- `l_k × ψ_k` : déperdition par les ponts thermiques linéiques (valeur ψ en W/(m·K)) ;
- `χ_j` : déperdition par les ponts thermiques ponctuels (en W/K).

### 5.2 Valeurs ψ des ponts thermiques linéiques courants

| Pont thermique             | Valeur ψ W/(m·K) — Réf. RE2020 |
|----------------------------|--------------------------------|
| Jonction plancher intermédiaire / mur extérieur | 0,50 |
| Jonction plancher bas / mur extérieur (sur terre plein) | 0,45 |
| Jonction toiture terrasse / mur extérieur | 0,10 |
| Tour de baie (fenêtre standard) | 0,15 |
| Tour de baie (fenêtre avec ITE) | 0,05 |
| Angle sortant de mur | 0,05 |
| Angle rentrant de mur | -0,10 |

## 6. Apports solaires

### 6.1 Apports solaires par les vitrages

```
Q_sol,w = Σ (A_sol,w,k × I_sol,k)
```

```
A_sol,w,k = F_sh,ob × g_gl × (1 - F_F) × A_w,k
```

Où :
- `F_sh,ob` : facteur de réduction pour masques solaires (horizon, ailettes, débords) ;
- `g_gl` : facteur solaire total du vitrage (SHGC), incluant les stores ;
- `F_F` : fraction de cadre sur la surface totale de la baie ;
- `A_w,k` : surface totale de la baie (vitrage + cadre).

### 6.2 Rayonnement solaire mensuel

Les données de rayonnement solaire sont issues des bases de données météorologiques (fichiers METEONORM, données INIES, stations Météo-France). Pour la France métropolitaine, les valeurs moyennes mensuelles sur plan horizontal varient entre 35 kWh/m² (décembre, Paris) et 215 kWh/m² (juillet, Marseille).

## 7. Apports internes

Les apports internes moyens sont estimés forfaitairement selon l'usage :

| Usage                          | Apports internes W/m² |
|--------------------------------|----------------------|
| Logement (occup. standard)     | 4,0                  |
| Bureau open space              | 15,0                 |
| Bureau cellulaire               | 10,0                 |
| Commerce                       | 25,0                 |
| Hôtel (chambre)                | 5,0                  |
| Hôpital (chambre)              | 8,0                  |
| Entrepôt logistique            | 3,0                  |
| Salle de classe (50 élèves)    | 18,0                 |

## 8. Application RE 2020

Dans le cadre de la RE 2020 (décret du 29 juillet 2021), le calcul des besoins bioclimatiques (Bbio) et des consommations conventionnelles (Cep, Cep,nr) utilise une version adaptée de la méthode mensuelle de l'ISO 13790, intégrée dans les moteurs de calcul TH-BCE 2020 agréés par le CSTB.

Le coefficient Bbio est calculé par :

```
Bbio = Q_H,nd / (S × DH_ref) + Q_C,nd / (S × DH_ref,C)
```

où `S` est la surface habitable et `DH_ref` les degrés-heures de référence pour la zone climatique considérée.

Les exigences RE 2020 sont :
- Bbio ≤ Bbio_max (variable selon zone et altitude)
- Cep ≤ Cep_max
- Cep,nr ≤ 4,5 × Cep,nr,max (énergie non renouvelable)
- IC_construction ≤ IC_construction_max (empreinte carbone)
