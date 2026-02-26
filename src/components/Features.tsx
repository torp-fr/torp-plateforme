import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  BarChart3, 
  Shield, 
  CreditCard, 
  Users, 
  TrendingUp,
  CheckCircle,
  AlertTriangle
} from "lucide-react";

export const Features = () => {
  const features = [
    {
      icon: FileText,
      title: "Upload & Analyse",
      description: "Uploadez vos devis en un clic. Notre IA analyse automatiquement le contenu selon nos critères d'évaluation.",
      badge: "Automatique"
    },
    {
      icon: BarChart3,
      title: "Notation A-E",
      description: "Obtenez une note claire de A à E basée sur des critères transparents : prix, qualité, délais, garanties.",
      badge: "Transparent"
    },
    {
      icon: Shield,
      title: "Expertise valorisée",
      description: "Les entreprises de qualité sont mises en avant grâce à notre système de notation transparent.",
      badge: "Équitable"
    },
    {
      icon: CreditCard,
      title: "Gestion financière",
      description: "Suivez les acomptes, paiements et l'avancement financier de vos projets en temps réel.",
      badge: "Suivi complet"
    },
    {
      icon: Users,
      title: "Client & Entreprise",
      description: "Interface dédiée pour les clients B2C et tableau de bord professionnel pour les entreprises.",
      badge: "Dual-face"
    },
    {
      icon: TrendingUp,
      title: "Analytics",
      description: "Tableaux de bord et statistiques détaillées pour optimiser vos décisions et projets.",
      badge: "Insights"
    }
  ];

  const gradingSamples = [
    { grade: "A", label: "Excellent", description: "Devis complet, prix justifié, entreprise certifiée", color: "grade-a" },
    { grade: "B", label: "Très bon", description: "Bon rapport qualité-prix, quelques détails manquants", color: "grade-b" },
    { grade: "C", label: "Correct", description: "Devis acceptable, prix dans la moyenne du marché", color: "grade-c" },
    { grade: "D", label: "Attention", description: "Plusieurs points d'amélioration nécessaires", color: "grade-d" },
    { grade: "E", label: "À éviter", description: "Devis incomplet ou prix non justifié", color: "grade-e" }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Features Grid */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Comment fonctionne TORP ?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Une plateforme complète pour analyser, valider et gérer vos projets de travaux
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <Card key={`feature-${index}`} variant="interactive" className="animate-fade-in">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-primary-light rounded-lg">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant="secondary">{feature.badge}</Badge>
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Grading System */}
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-foreground mb-4">
            Système de notation
          </h3>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Chaque devis reçoit une note de A à E selon des critères objectifs et transparents
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {gradingSamples.map((grade, index) => (
            <Card key={`grade-${index}`} variant="elevated" className="text-center animate-fade-in">
              <CardHeader className="pb-2">
                <Badge 
                  variant={grade.color as any} 
                  className="text-lg py-2 px-4 font-bold"
                >
                  {grade.grade}
                </Badge>
                <CardTitle className="text-lg">{grade.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{grade.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};