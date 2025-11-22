/**
 * How It Works Section
 * Explain the 3-step process
 */

import { Upload, Brain, FileCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const HowItWorks = () => {
  const steps = [
    {
      icon: Upload,
      title: "1. Uploadez votre devis",
      description:
        "Glissez-déposez votre devis PDF ou prenez une photo. Toutes les données sont chiffrées et sécurisées.",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Brain,
      title: "2. L'IA analyse en profondeur",
      description:
        "Notre algorithme vérifie +150 critères : prix, conformité, fiabilité de l'entreprise, risques détectés.",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: FileCheck,
      title: "3. Recevez votre rapport",
      description:
        "Note A-F, points forts/faibles, économies possibles et conseils de négociation personnalisés.",
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Comment ça marche ?
          </h2>
          <p className="text-lg text-muted-foreground">
            Une analyse complète de votre devis en seulement 3 étapes
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <Card key={index} className="relative border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl ${step.bgColor} flex items-center justify-center mb-6`}>
                  <step.icon className={`h-8 w-8 ${step.color}`} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>

                {/* Arrow connector (except for last step) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <svg
                      className="w-8 h-8 text-primary/30"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Prêt à analyser votre devis ?
          </p>
          <a
            href="#hero"
            className="text-primary font-semibold hover:underline inline-flex items-center gap-2"
          >
            Commencer maintenant
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
};
