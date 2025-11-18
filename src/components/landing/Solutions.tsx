/**
 * Solutions Section
 * Present different user segments
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Landmark, Target, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const Solutions = () => {
  const navigate = useNavigate();

  const solutions = [
    {
      icon: User,
      title: "Particuliers",
      badge: "B2C",
      tagline: "Protégez-vous des arnaques",
      description: "Vous rénovez votre maison ? Analysez vos devis avant de signer.",
      features: [
        "Analyse gratuite du premier devis",
        "Détection des surcoûts cachés",
        "Vérification entreprise (SIRET, assurances)",
        "Conseils de négociation personnalisés",
      ],
      cta: "Analyser mon devis",
      link: "/b2c-dashboard",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Building2,
      title: "Entreprises BTP",
      badge: "B2B",
      tagline: "Valorisez votre expertise",
      description: "Démarquez-vous avec un label qualité reconnu par vos clients.",
      features: [
        "Certification TORP pour vos devis",
        "Badge de confiance digitale",
        "Tableau de bord professionnel",
        "Génération automatique de devis certifiés",
      ],
      cta: "Découvrir l'offre Pro",
      link: "/improved-b2b-dashboard",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      popular: true,
    },
    {
      icon: Landmark,
      title: "Collectivités",
      badge: "B2G",
      tagline: "Observatoire des marchés",
      description: "Pilotez vos marchés publics avec des données fiables et transparentes.",
      features: [
        "Dashboard d'analyse des marchés publics",
        "Comparaison multi-critères",
        "Détection d'anomalies automatique",
        "Rapports d'audit conformité",
      ],
      cta: "Demander une démo",
      link: "/collectivites-dashboard",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: Target,
      title: "Prescripteurs",
      badge: "B2B2C",
      tagline: "Accompagnez vos clients",
      description: "Architectes, courtiers, agents immobiliers : proposez un service premium.",
      features: [
        "Plateforme white-label",
        "Multi-clients illimités",
        "Commissions sur les projets",
        "Support prioritaire dédié",
      ],
      cta: "Devenir partenaire",
      link: "/prescripteurs-dashboard",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="secondary" className="mb-4">
            Pour tous les acteurs du BTP
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Une solution adaptée à vos besoins
          </h2>
          <p className="text-lg text-muted-foreground">
            Que vous soyez particulier, professionnel ou institution, TORP vous apporte transparence et confiance
          </p>
        </div>

        {/* Solutions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {solutions.map((solution, index) => (
            <Card
              key={index}
              className={`relative border-2 hover:border-primary/50 transition-all hover:shadow-lg group ${
                solution.popular ? 'border-primary' : ''
              }`}
            >
              {solution.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="bg-primary">
                    Populaire
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className={`w-12 h-12 rounded-xl ${solution.bgColor} flex items-center justify-center mb-4`}>
                  <solution.icon className={`h-6 w-6 ${solution.color}`} />
                </div>
                <Badge variant="outline" className="w-fit mb-2">
                  {solution.badge}
                </Badge>
                <CardTitle className="text-xl">{solution.title}</CardTitle>
                <p className="text-sm font-semibold text-primary">
                  {solution.tagline}
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  {solution.description}
                </p>

                <ul className="space-y-2">
                  {solution.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => navigate(solution.link)}
                  variant={solution.popular ? "default" : "outline"}
                  className="w-full"
                >
                  {solution.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
