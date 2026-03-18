/**
 * Testimonials Section
 * Social proof with real user testimonials
 */

import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Quote } from "lucide-react";

export const Testimonials = () => {
  const testimonials = [
    {
      name: "Marie Dupont",
      role: "Propriétaire",
      location: "Lyon",
      avatar: "👩",
      rating: 5,
      text: "J'ai économisé 2 300€ sur ma rénovation de cuisine grâce à TORP ! L'analyse m'a montré que 3 postes étaient surfacturés. Le négociation a été facile avec le rapport en main.",
      savings: "2 300€",
    },
    {
      name: "Thomas Martin",
      role: "Artisan plombier",
      location: "Toulouse",
      avatar: "👨",
      rating: 5,
      text: "Depuis que j'utilise la certification TORP, mes clients me font plus confiance. Mon taux de conversion a augmenté de 40% et je peux justifier mes tarifs facilement.",
      metric: "+40% de conversion",
    },
    {
      name: "Sophie Bernard",
      role: "Architecte",
      location: "Paris",
      avatar: "👩‍💼",
      rating: 5,
      text: "Je recommande TORP à tous mes clients. Ça me permet de valider les devis sans passer des heures à vérifier chaque ligne. Un vrai gain de temps et de crédibilité.",
      metric: "Gain de temps",
    },
    {
      name: "Jean Lefebvre",
      role: "Copropriété",
      location: "Bordeaux",
      avatar: "👴",
      rating: 5,
      text: "Pour notre copropriété de 45 lots, TORP nous a aidé à comparer 4 devis de ravalement. Nous avons choisi le meilleur rapport qualité/prix et économisé 12 000€ sur le budget.",
      savings: "12 000€",
    },
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ils nous font confiance
          </h2>
          <p className="text-lg text-muted-foreground">
            Découvrez les témoignages de nos utilisateurs satisfaits
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card key={`testimonial-${index}`} className="relative border-2 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                {/* Quote icon */}
                <Quote className="h-8 w-8 text-primary/20 mb-4" />

                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={`star-${i}`} className="text-yellow-500 text-lg">★</span>
                  ))}
                </div>

                {/* Text */}
                <p className="text-foreground mb-6 leading-relaxed">
                  "{testimonial.text}"
                </p>

                {/* Metric badge */}
                {(testimonial.savings || testimonial.metric) && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success font-semibold text-sm mb-6">
                    {testimonial.savings && `💰 ${testimonial.savings} économisés`}
                    {testimonial.metric && `📈 ${testimonial.metric}`}
                  </div>
                )}

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.role} • {testimonial.location}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trust indicators */}
        <div className="mt-16 pt-12 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            <div>
              <div className="text-3xl font-bold text-primary">4.9/5</div>
              <div className="text-sm text-muted-foreground mt-1">Note moyenne</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">50K+</div>
              <div className="text-sm text-muted-foreground mt-1">Utilisateurs</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">2M€</div>
              <div className="text-sm text-muted-foreground mt-1">Économisés</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary">98%</div>
              <div className="text-sm text-muted-foreground mt-1">Recommandation</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
