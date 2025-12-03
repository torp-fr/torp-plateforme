import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  FileText,
  Clock,
  Euro,
  BarChart3,
  CheckCircle,
  Shield,
  TrendingUp,
  Upload
} from "lucide-react";

export const Dashboard = () => {
  // Présentation des fonctionnalités du dashboard (pas de données mockées)
  const features = [
    {
      title: "Analyse de devis",
      description: "Score TORP sur 1000 points",
      icon: FileText,
    },
    {
      title: "Suivi projets",
      description: "Timeline et étapes",
      icon: Clock,
    },
    {
      title: "Budget maîtrisé",
      description: "Détection des surcoûts",
      icon: Euro,
    },
    {
      title: "Score détaillé",
      description: "5 axes d'analyse",
      icon: BarChart3,
    }
  ];

  const advantages = [
    {
      icon: CheckCircle,
      title: "Vérification entreprise",
      description: "SIRET, certifications RGE, assurances"
    },
    {
      icon: TrendingUp,
      title: "Comparaison prix marché",
      description: "Analyse des prix vs. référentiel local"
    },
    {
      icon: Shield,
      title: "Protection complète",
      description: "Détection des clauses abusives"
    }
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Tableau de bord intelligent
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Suivez l'analyse de vos devis, l'avancement de vos projets et la gestion financière
          </p>
        </div>

        {/* Features Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} variant="gradient" className="animate-fade-in">
              <CardHeader className="pb-2">
                <feature.icon className="h-6 w-6 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-foreground mb-1">
                  {feature.title}
                </div>
                <div className="text-sm text-muted-foreground">
                  {feature.description}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Advantages Section */}
        <Card variant="elevated" className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">Ce que TORP analyse pour vous</CardTitle>
              <Link to="/analyze">
                <Button size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Analyser un devis
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {advantages.map((advantage, index) => (
                <div key={index} className="flex items-start gap-4 p-4 bg-background rounded-lg border">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <advantage.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{advantage.title}</h4>
                    <p className="text-sm text-muted-foreground">{advantage.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-8 text-center p-6 bg-primary/5 rounded-lg border border-primary/20">
              <h3 className="text-lg font-semibold mb-2">Prêt à sécuriser vos projets ?</h3>
              <p className="text-muted-foreground mb-4">
                Uploadez votre premier devis et obtenez une analyse complète en quelques minutes.
              </p>
              <Link to="/analyze">
                <Button size="lg" variant="hero">
                  <Upload className="h-4 w-4 mr-2" />
                  Commencer maintenant
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
