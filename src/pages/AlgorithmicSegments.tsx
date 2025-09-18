import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackButton } from "@/components/BackButton";
import { 
  Building, 
  Home, 
  FileText, 
  TrendingUp, 
  Heart, 
  Calculator, 
  Target,
  CheckCircle,
  AlertTriangle,
  Clock,
  Award,
  Shield,
  Zap
} from "lucide-react";

const AlgorithmicSegments = () => {
  const segments = [
    {
      id: "audit-entreprise",
      title: "Audit Entreprise & Notation",
      icon: <Building className="h-6 w-6" />,
      subtitle: "Comment nous évaluons la fiabilité des entreprises",
      color: "bg-blue-500",
      description: "Imaginez que vous cherchez un plombier pour refaire votre salle de bain à 15 000€. Comment savoir si cette entreprise sera encore là dans 6 mois pour honorer sa garantie décennale ? Notre audit entreprise répond exactement à cette question en analysant sa solidité financière et sa réputation réelle."
    },
    {
      id: "analyse-client",
      title: "Analyse Client & Contexte Habitat",
      icon: <Home className="h-6 w-6" />,
      subtitle: "Personnalisation selon votre environnement",
      color: "bg-green-500",
      description: "Refaire une cuisine ne coûte pas pareil à Neuilly-sur-Seine et à Guéret dans la Creuse. Notre analyse contextuelle adapte automatiquement nos conseils à votre situation géographique, économique et technique réelle."
    },
    {
      id: "analyse-devis",
      title: "Analyse Devis & Extraction Données",
      icon: <FileText className="h-6 w-6" />,
      subtitle: "Lecture intelligente de vos devis",
      color: "bg-purple-500",
      description: "Un devis BTP peut faire 20 pages avec 150 lignes techniques. Notre cerveau artificiel le lit, le comprend, et en extrait automatiquement toutes les informations importantes en 60 secondes."
    },
    {
      id: "benchmark-prix",
      title: "Benchmark Prix & Marché",
      icon: <TrendingUp className="h-6 w-6" />,
      subtitle: "Comparaison avec les prix du marché",
      color: "bg-orange-500",
      description: "Est-ce que 350€/m² pour de la peinture, c'est normal ? Notre benchmark répond précisément à cette question en comparant chaque ligne de votre devis aux prix réels du marché."
    },
    {
      id: "carnet-sante",
      title: "Carnet de Santé Bâtiment",
      icon: <Heart className="h-6 w-6" />,
      subtitle: "Suivi et maintenance préventive",
      color: "bg-red-500",
      description: "Votre maison est comme vous : elle a besoin d'un suivi médical régulier. Notre carnet de santé digital trace l'historique de votre bâtiment et anticipe ses futurs besoins."
    },
    {
      id: "scoring-financier",
      title: "Scoring Financier Projet",
      icon: <Calculator className="h-6 w-6" />,
      subtitle: "Évaluation de la faisabilité financière",
      color: "bg-indigo-500",
      description: "Avant de vous conseiller des travaux à 25 000€, nous vérifions discrètement que ce budget est cohérent avec votre situation. Pas question de vous endetter inconsidérément !"
    },
    {
      id: "recommandations",
      title: "Recommandations Personnalisées",
      icon: <Target className="h-6 w-6" />,
      subtitle: "Conseils adaptés à votre profil",
      color: "bg-pink-500",
      description: "Deux clients avec le même projet n'ont pas les mêmes besoins. Notre IA adapte ses conseils à votre profil, vos contraintes, et votre façon de communiquer."
    }
  ];

  const renderSegmentContent = (segmentId: string) => {
    switch (segmentId) {
      case "audit-entreprise":
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-500" />
                    Santé Financière (40% du score)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Notre robot interroge automatiquement Infogreffe pour récupérer les trois derniers bilans comptables. Il examine le chiffre d'affaires, analyse les ratios financiers comme un banquier.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">Exemple concret :</p>
                    <p className="text-sm text-blue-800 mt-1">
                      Si une entreprise de plomberie a 50 000€ de trésorerie mais 200 000€ de dettes fournisseurs, notre algorithme détecte un risque de cessation de paiement dans les 6 mois. Elle perd automatiquement 15 points sur 40 dans cette catégorie.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-green-500" />
                    Réputation Digitale (25% du score)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Notre système récupère automatiquement tous les avis Google, Pages Jaunes, sites spécialisés. Notre IA lit chaque avis et comprend le sentiment réel.
                  </p>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-green-900">Exemple concret :</p>
                    <p className="text-sm text-green-800 mt-1">
                      Une entreprise a 4,2 étoiles sur Google, mais notre IA détecte que 60% des avis récents mentionnent des "retards de livraison". Elle perd des points malgré sa note globale correcte.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-purple-500" />
                    Conformité Réglementaire (20%)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Vérification en temps réel des assurances, cotisations URSSAF, certifications RGE et Qualibat.
                  </p>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-purple-900">Alerte automatique :</p>
                    <p className="text-sm text-purple-800 mt-1">
                      Une entreprise prétend être RGE mais sa certification a expiré il y a 3 mois. Vous ne pourrez pas bénéficier des aides publiques.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-500" />
                    Expérience & Portfolio (15%)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Évaluation de l'expertise réelle : ancienneté, projets similaires, compétences techniques spécifiques.
                  </p>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-orange-900">Analyse intelligente :</p>
                    <p className="text-sm text-orange-800 mt-1">
                      Pour une pompe à chaleur : l'entreprise n'a que 3 photos de PAC contre 50 de plomberie classique. Ce n'est pas son cœur de métier.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gradient-to-r from-blue-50 to-green-50">
              <CardHeader>
                <CardTitle>Impact sur votre décision</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-5 gap-4 text-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <div className="font-bold text-green-800">Note A</div>
                    <div className="text-xs text-green-600">90-100%</div>
                    <div className="text-xs mt-1">Entreprise premium</div>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <div className="font-bold text-blue-800">Note B</div>
                    <div className="text-xs text-blue-600">75-89%</div>
                    <div className="text-xs mt-1">Entreprise fiable</div>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <div className="font-bold text-yellow-800">Note C</div>
                    <div className="text-xs text-yellow-600">60-74%</div>
                    <div className="text-xs mt-1">Vigilance recommandée</div>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <div className="font-bold text-orange-800">Note D</div>
                    <div className="text-xs text-orange-600">45-59%</div>
                    <div className="text-xs mt-1">Entreprise risquée</div>
                  </div>
                  <div className="p-3 bg-red-100 rounded-lg">
                    <div className="font-bold text-red-800">Note E</div>
                    <div className="text-xs text-red-600">0-44%</div>
                    <div className="text-xs mt-1">À éviter</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "analyse-client":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Comment nous analysons votre contexte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Home className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <h4 className="font-semibold">Enquête Géographique</h4>
                    <p className="text-sm text-muted-foreground">Analyse satellite, cadastre, DVF, INSEE</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <Calculator className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <h4 className="font-semibold">Profil Économique</h4>
                    <p className="text-sm text-muted-foreground">Revenus médians, taux propriétaires</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <Zap className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <h4 className="font-semibold">Analyse Technique</h4>
                    <p className="text-sm text-muted-foreground">DPE, matériaux, contraintes</p>
                  </div>
                </div>

                <div className="bg-green-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3">Exemple d'analyse automatique :</h4>
                  <div className="space-y-2 text-sm text-green-800">
                    <p>• Votre maison fait environ 120m² (analyse satellite + cadastre)</p>
                    <p>• Elle a été construite en 1985 (base LOVAC)</p>
                    <p>• Le m² se vend autour de 2 800€ dans votre quartier (DVF derniers 6 mois)</p>
                    <p>• Vous êtes probablement propriétaire (croisement données INSEE)</p>
                    <p>• Aucune contrainte monument historique dans un rayon de 500m</p>
                  </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Impact sur vos recommandations :</h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <p><strong>Niveau de gamme adapté :</strong> Avec un profil "revenus 45k€, maison 2800€/m²", nous privilégions du "milieu de gamme plus"</p>
                    <p><strong>Alertes pertinentes :</strong> "Votre DPE actuel est F. Ces travaux vous feront passer en D et économiser 800€/an"</p>
                    <p><strong>Arguments de négociation :</strong> "Dans votre secteur, ce type de travaux se facture entre X et Y €/m²"</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "analyse-devis":
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-500" />
                    Lecture Intelligente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Notre système examine votre devis comme le ferait un expert : détection de la qualité, amélioration automatique des scans flous, utilisation de trois moteurs de reconnaissance optique simultanés.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Google Vision (le plus performant)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Microsoft Azure (excellent sur les tableaux)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Tesseract (très bon sur les documents techniques)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-500" />
                    Compréhension Contextuelle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Notre IA ne se contente pas de lire les mots, elle comprend le BTP.
                  </p>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-orange-900">Exemple :</p>
                    <p className="text-sm text-orange-800 mt-1 font-mono">
                      "Fourniture et pose carrelage 60x60 rectifié, joint 2mm, colle C2S1"
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-orange-700">
                      <p>→ C'est du carrelage grand format de qualité</p>
                      <p>→ Le joint 2mm indique une finition soignée</p>
                      <p>→ La colle C2S1 est adaptée aux grandes dalles</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Validation Croisée Automatique</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4 text-blue-500" />
                      <span>Cohérence des quantités</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span>Réalisme des délais</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Award className="h-4 w-4 text-blue-500" />
                      <span>Qualifications requises</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-blue-500" />
                      <span>Détection d'aberrations</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg mt-4">
                  <p className="text-sm font-medium text-red-900">Alerte détectée :</p>
                  <p className="text-sm text-red-800 mt-1">
                    Le devis indique "Pose parquet 40m²" mais aussi "Fourniture parquet 35m²". 
                    Il manque 5m² de parquet dans les fournitures, ou la surface de pose est surévaluée.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "benchmark-prix":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notre Base de Référence Prix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="font-semibold text-blue-900">Prix Officiels</div>
                    <div className="text-sm text-blue-700 mt-1">Batiprix, INSEE, FFB</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="font-semibold text-green-900">Prix Réels</div>
                    <div className="text-sm text-green-700 mt-1">Base TORP, marchés publics</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="font-semibold text-purple-900">Contexte Local</div>
                    <div className="text-sm text-purple-700 mt-1">Coefficients géographiques</div>
                  </div>
                </div>

                <div className="bg-orange-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-orange-900 mb-3">Adaptation géographique automatique :</h4>
                  <div className="grid sm:grid-cols-2 gap-4 text-sm text-orange-800">
                    <div>
                      <p>• Paris intramuros : coefficient x1,35</p>
                      <p>• Proche banlieue : coefficient x1,20</p>
                    </div>
                    <div>
                      <p>• Métropoles régionales : coefficient x1,05</p>
                      <p>• Zones rurales : coefficient x0,85</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analyse Ligne par Ligne</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-semibold text-green-900">PRIX CORRECT</span>
                    </div>
                    <p className="text-sm text-green-800">
                      Fourniture et pose carrelage 60x60 : proposé 45€/m², marché local 38-52€/m² → Dans la fourchette haute mais acceptable
                    </p>
                  </div>

                  <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <span className="font-semibold text-yellow-900">PRIX ÉLEVÉ</span>
                    </div>
                    <p className="text-sm text-yellow-800">
                      Main d'œuvre électricité : proposé 65€/h, marché local 45-55€/h → Surcoût de +20%, négociation recommandée
                    </p>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <span className="font-semibold text-red-900">PRIX EXCESSIF</span>
                    </div>
                    <p className="text-sm text-red-800">
                      +20% versus marché, attention ! Demander une révision sur les postes X et Y (surcoût de 1 250€)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "carnet-sante":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Carnet de Santé Digital de votre Bâtiment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Reconstitution Automatique de l'Historique</h4>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>• Permis de construire et modifications</p>
                      <p>• Historique des DPE successifs</p>
                      <p>• Interventions et réparations</p>
                      <p>• Garanties et dates d'expiration</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Surveillance Proactive</h4>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>• Âge des équipements surveillé</p>
                      <p>• Alertes maintenance préventive</p>
                      <p>• Mises aux normes à planifier</p>
                      <p>• Optimisation énergétique continue</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-lg mt-6">
                  <h4 className="font-semibold text-blue-900 mb-3">Exemple de reconstitution automatique :</h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <p>• Maison construite en 1985</p>
                    <p>• Extension déclarée en 2003</p>
                    <p>• Changement de chaudière en 2015 (visible sur DPE)</p>
                    <p>• Réfection toiture en 2018 (permis retrouvé)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommandations Prédictives</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      <span className="font-semibold">2026 - Révision étanchéité toiture</span>
                    </div>
                    <p className="text-sm text-yellow-700">Budget estimé : 2 500€</p>
                  </div>

                  <div className="p-4 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <span className="font-semibold">2028 - Remplacement chaudière</span>
                    </div>
                    <p className="text-sm text-orange-700">Budget estimé : 4 500€</p>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-red-600" />
                      <span className="font-semibold">2030 - Rénovation électricité</span>
                    </div>
                    <p className="text-sm text-red-700">Budget estimé : 8 000€</p>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg mt-6">
                  <h4 className="font-semibold text-green-900 mb-2">Bénéfices Concrets :</h4>
                  <div className="space-y-1 text-sm text-green-800">
                    <p>• Planification financière : étalez vos investissements</p>
                    <p>• Valorisation : +3 à 5% à la revente avec carnet bien tenu</p>
                    <p>• Optimisation : suivez l'évolution de votre DPE</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "scoring-financier":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-indigo-500" />
                  Évaluation de votre Capacité Financière
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="font-semibold text-indigo-900">Estimation Discrète</div>
                    <div className="text-sm text-indigo-700 mt-1">Données publiques uniquement</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="font-semibold text-green-900">Analyse ROI</div>
                    <div className="text-sm text-green-700 mt-1">Retour sur investissement</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="font-semibold text-blue-900">Aides Disponibles</div>
                    <div className="text-sm text-blue-700 mt-1">Subventions et prêts</div>
                  </div>
                </div>

                <div className="bg-indigo-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-indigo-900 mb-3">Exemple d'évaluation automatique :</h4>
                  <div className="space-y-2 text-sm text-indigo-800">
                    <p>• Maison estimée 420k€ (base DVF des ventes récentes)</p>
                    <p>• Zone revenus médians 55k€/an (INSEE carroyage 200m)</p>
                    <p>• Propriétaire probable (profil socio-démographique)</p>
                    <p><strong>→ Capacité d'investissement travaux : 15k€ à 35k€</strong></p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analyse Coût/Bénéfice Automatique</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-900">Économies d'énergie</span>
                    </div>
                    <p className="text-sm text-green-800">Isolation à 12k€ → Économie 650€/an → ROI en 18 ans</p>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Home className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">Plus-value immobilière</span>
                    </div>
                    <p className="text-sm text-blue-800">Cuisine refaite à 18k€ → Plus-value +25k€ → ROI immédiat positif</p>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold text-purple-900">Confort et usage</span>
                    </div>
                    <p className="text-sm text-purple-800">Aménagement combles à 22k€ → +25m² habitables → 880€/m² gagné</p>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg mt-6">
                  <h4 className="font-semibold text-yellow-900 mb-2">Aides identifiées automatiquement :</h4>
                  <div className="space-y-1 text-sm text-yellow-800">
                    <p>• MaPrimeRénov' : 4 500€ si isolation + chauffage</p>
                    <p>• Éco-PTZ : Prêt 30k€ à 0% si bouquet de travaux</p>
                    <p>• Aides locales : Votre commune subventionne l'isolation à 25%</p>
                    <p>• CEE : 1 200€ de prime Certificats Économies Énergie</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Verdict Final</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-100 rounded-lg text-center">
                    <div className="text-2xl mb-2">🟢</div>
                    <div className="font-semibold text-green-900">PROJET VIABLE</div>
                    <div className="text-sm text-green-700 mt-1">Budget cohérent, ROI positif</div>
                  </div>
                  <div className="p-4 bg-yellow-100 rounded-lg text-center">
                    <div className="text-2xl mb-2">🟡</div>
                    <div className="font-semibold text-yellow-900">PROJET À ÉTALER</div>
                    <div className="text-sm text-yellow-700 mt-1">Étaler sur 2-3 ans recommandé</div>
                  </div>
                  <div className="p-4 bg-red-100 rounded-lg text-center">
                    <div className="text-2xl mb-2">🔴</div>
                    <div className="font-semibold text-red-900">PROJET À REVOIR</div>
                    <div className="text-sm text-red-700 mt-1">Budget excessif, alternatives proposées</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "recommandations":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-pink-500" />
                  Profiling Comportemental Automatique
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="font-semibold text-blue-900">Expert Amateur</div>
                      <div className="text-sm text-blue-700 mt-1">Vous posez beaucoup de questions techniques</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="font-semibold text-green-900">Optimiseur Budget</div>
                      <div className="text-sm text-green-700 mt-1">Vous vous focalisez sur les prix</div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <div className="font-semibold text-orange-900">Pressé/Organisé</div>
                      <div className="text-sm text-orange-700 mt-1">Vous mentionnez souvent les délais</div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="font-semibold text-purple-900">Design-Oriented</div>
                      <div className="text-sm text-purple-700 mt-1">Vous parlez esthétique et tendances</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Adaptation du Discours selon votre Profil</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="font-semibold text-blue-900 mb-2">Pour un "Expert Amateur" :</div>
                    <p className="text-sm text-blue-800 italic">
                      "L'isolation en polyuréthane projeté offre un lambda de 0,025 W/m.K, soit 20% plus performant que la laine de roche traditionnelle"
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="font-semibold text-green-900 mb-2">Pour un "Optimiseur Budget" :</div>
                    <p className="text-sm text-green-800 italic">
                      "Cette solution coûte 15% plus cher à l'achat mais vous fait économiser 300€/an. Amortie en 3 ans."
                    </p>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="font-semibold text-purple-900 mb-2">Pour un "Design-Oriented" :</div>
                    <p className="text-sm text-purple-800 italic">
                      "Cette finition s'harmonise parfaitement avec les tendances actuelles du style scandinave moderne"
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommandations Contextuelles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-pink-50 rounded-lg">
                      <div className="font-semibold text-pink-900">Famille avec enfants</div>
                      <div className="text-sm text-pink-700">→ Priorité sécurité et facilité d'entretien</div>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                      <div className="font-semibold text-indigo-900">Couple de retraités</div>
                      <div className="text-sm text-indigo-700">→ Focus accessibilité et confort thermique</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-teal-50 rounded-lg">
                      <div className="font-semibold text-teal-900">Jeune actif</div>
                      <div className="text-sm text-teal-700">→ Solutions connectées et évolutives</div>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <div className="font-semibold text-yellow-900">Investisseur locatif</div>
                      <div className="text-sm text-yellow-700">→ Optimisation rentabilité/maintenance</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-6 rounded-lg mt-6">
                  <h4 className="font-semibold text-purple-900 mb-3">Votre résultat personnalisé :</h4>
                  <div className="space-y-2 text-sm text-purple-800">
                    <p>• Plan d'action priorisé selon VOS critères</p>
                    <p>• Scripts de négociation adaptés à VOTRE profil</p>
                    <p>• Alternatives cohérentes avec VOTRE budget</p>
                    <p>• Planning réaliste selon VOS contraintes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return <div>Contenu en cours de développement...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <BackButton />
        
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Analyse Exhaustive des Segments Algorithmiques TORP
          </h1>
          <p className="text-xl text-muted-foreground">
            Découvrez comment notre intelligence artificielle analyse et évalue chaque aspect de vos projets de travaux
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6 mb-8">
          {segments.slice(0, 4).map((segment, index) => (
            <Card key={segment.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className={`w-12 h-12 rounded-full ${segment.color} flex items-center justify-center text-white mx-auto mb-3`}>
                  {segment.icon}
                </div>
                <CardTitle className="text-lg">{segment.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{segment.subtitle}</p>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {segments.slice(4).map((segment, index) => (
            <Card key={segment.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="text-center">
                <div className={`w-12 h-12 rounded-full ${segment.color} flex items-center justify-center text-white mx-auto mb-3`}>
                  {segment.icon}
                </div>
                <CardTitle className="text-lg">{segment.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{segment.subtitle}</p>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card className="mb-8">
          <CardHeader className="text-center bg-gradient-to-r from-blue-50 to-purple-50">
            <CardTitle className="text-2xl">L'Intelligence Collective TORP</CardTitle>
            <p className="text-muted-foreground mt-2">
              Cette approche narrative démontre la sophistication de notre algorithme tout en restant compréhensible. 
              Chaque segment raconte une histoire : celle de votre projet analysé par une intelligence artificielle bienveillante et experte.
            </p>
          </CardHeader>
        </Card>

        <Tabs defaultValue={segments[0].id} className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-8">
            {segments.map((segment) => (
              <TabsTrigger 
                key={segment.id} 
                value={segment.id}
                className="text-xs p-2"
              >
                <div className="flex flex-col items-center gap-1">
                  {segment.icon}
                  <span className="hidden sm:block">{segment.title.split(' ')[0]}</span>
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          {segments.map((segment) => (
            <TabsContent key={segment.id} value={segment.id} className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full ${segment.color} flex items-center justify-center text-white`}>
                      {segment.icon}
                    </div>
                    <div>
                      <CardTitle className="text-2xl">{segment.title}</CardTitle>
                      <p className="text-muted-foreground">{segment.subtitle}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 p-6 rounded-lg mb-6">
                    <h3 className="font-semibold text-lg mb-3">Pourquoi ce segment ?</h3>
                    <p className="text-muted-foreground leading-relaxed">{segment.description}</p>
                  </div>
                  
                  {renderSegmentContent(segment.id)}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default AlgorithmicSegments;