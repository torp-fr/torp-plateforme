/**
 * Solutions Section - Refonte
 * Présente B2C et B2B dans un message positif et rassembleur
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Check, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const Solutions = () => {
  const navigate = useNavigate();

  const solutions = [
    {
      icon: User,
      title: "Particuliers",
      badge: "B2C",
      tagline: "Des devis clairs pour vos projets",
      description: "Vous rénovez votre maison ? Obtenez une analyse transparente de vos devis pour prendre les meilleures décisions.",
      features: [
        "Analyse complète de vos devis",
        "Vérification de la cohérence des prix",
        "Validation des informations entreprise",
        "Accompagnement personnalisé",
      ],
      cta: "Analyser mon devis",
      link: "/analyze",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Building2,
      title: "Professionnels BTP",
      badge: "B2B",
      tagline: "Valorisez votre expertise",
      description: "Démarquez-vous avec des devis certifiés qui rassurent vos clients et mettent en avant votre professionnalisme.",
      features: [
        "Certification de vos devis",
        "Badge de confiance reconnu",
        "Tableau de bord professionnel",
        "Démarquage qualité",
      ],
      cta: "Découvrir l'offre Pro",
      link: "/register",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      popular: true,
    },
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="secondary" className="mb-4 gap-2">
            <Heart className="h-4 w-4" />
            Une solution pour tous
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Particuliers et professionnels réunis
          </h2>
          <p className="text-lg text-muted-foreground">
            TORP crée un pont de confiance entre ceux qui commandent et ceux qui réalisent.
            Ensemble, construisons des relations durables basées sur la transparence.
          </p>
        </div>

        {/* Solutions Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {solutions.map((solution, index) => (
            <Card
              key={`solution-${index}`}
              className={`relative border-2 hover:border-primary/50 transition-all hover:shadow-lg group ${
                solution.popular ? 'border-primary' : ''
              }`}
            >
              {solution.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="bg-primary">
                    ⭐ Recommandé
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className={`w-16 h-16 rounded-xl ${solution.bgColor} flex items-center justify-center mb-4`}>
                  <solution.icon className={`h-8 w-8 ${solution.color}`} />
                </div>
                <Badge variant="outline" className="w-fit mb-2">
                  {solution.badge}
                </Badge>
                <CardTitle className="text-2xl">{solution.title}</CardTitle>
                <p className="text-base font-semibold text-primary">
                  {solution.tagline}
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                <p className="text-muted-foreground leading-relaxed">
                  {solution.description}
                </p>

                <ul className="space-y-3">
                  {solution.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => navigate(solution.link)}
                  variant={solution.popular ? "default" : "outline"}
                  className="w-full"
                  size="lg"
                >
                  {solution.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Connecting message */}
        <div className="mt-16 text-center max-w-2xl mx-auto">
          <div className="p-6 rounded-xl bg-muted/50 border border-border">
            <p className="text-foreground font-medium mb-2">
              💡 Notre conviction
            </p>
            <p className="text-muted-foreground">
              Les meilleurs projets naissent d'une collaboration transparente.
              TORP met les outils en place pour que particuliers et professionnels
              puissent travailler ensemble en toute sérénité.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
