/**
 * FAQ Section
 * Frequently asked questions
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const FAQ = () => {
  const faqs = [
    {
      question: "TORP est-il vraiment gratuit ?",
      answer:
        "Oui ! L'analyse de votre premier devis est entièrement gratuite, sans carte bancaire ni engagement. Pour les particuliers, nous proposons également des formules premium avec fonctionnalités avancées (suivi de chantier, paiements sécurisés, etc.).",
    },
    {
      question: "Comment l'IA analyse-t-elle mon devis ?",
      answer:
        "Notre algorithme vérifie plus de 150 critères : cohérence des prix avec le marché local, fiabilité de l'entreprise (SIRET, assurances, litiges), conformité technique aux normes, délais réalistes, et détection d'anomalies ou surcoûts cachés. Tout est basé sur notre base de données de +500K devis analysés.",
    },
    {
      question: "Mes données sont-elles sécurisées ?",
      answer:
        "Absolument. Vos documents sont chiffrés de bout en bout (AES-256), hébergés sur des serveurs européens certifiés ISO 27001, et conformes au RGPD. Vous pouvez supprimer vos données à tout moment depuis votre compte. Nous ne vendons jamais vos données à des tiers.",
    },
    {
      question: "Quels types de travaux pouvez-vous analyser ?",
      answer:
        "Nous analysons tous types de travaux : rénovation (salle de bain, cuisine), construction neuve, extension, électricité, plomberie, chauffage, toiture, isolation, menuiserie, peinture, carrelage, etc. Du particulier aux marchés publics.",
    },
    {
      question: "L'analyse remplace-t-elle un expert ?",
      answer:
        "TORP est un outil d'aide à la décision très puissant, mais ne remplace pas un conseil juridique ou technique personnalisé. Pour des projets complexes (+100K€) ou situations particulières, nous recommandons de consulter également un architecte ou maître d'œuvre.",
    },
    {
      question: "Puis-je analyser plusieurs devis et les comparer ?",
      answer:
        "Oui ! Notre outil de comparaison multi-devis est disponible dès le plan gratuit. Vous pouvez uploader jusqu'à 5 devis simultanément et obtenir un tableau comparatif détaillé avec recommandations.",
    },
    {
      question: "Que faire si l'entreprise refuse mon contre-devis ?",
      answer:
        "Nos conseils de négociation sont basés sur des données de marché réelles. Si une entreprise refuse systématiquement de justifier ses tarifs, c'est souvent un signal d'alerte. Nous pouvons vous mettre en relation avec notre réseau d'artisans certifiés TORP.",
    },
    {
      question: "Comment devenir artisan/entreprise certifié(e) TORP ?",
      answer:
        "Il suffit de créer un compte professionnel B2B. Après vérification de vos certifications et assurances, vous recevrez votre badge de confiance TORP. L'abonnement démarre à 49€/mois avec génération illimitée de devis certifiés.",
    },
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Questions fréquentes
          </h2>
          <p className="text-lg text-muted-foreground">
            Tout ce que vous devez savoir sur TORP
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border rounded-lg px-6 bg-card"
              >
                <AccordionTrigger className="text-left font-semibold hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact CTA */}
        <div className="text-center mt-12 pt-12 border-t">
          <p className="text-muted-foreground mb-4">
            Vous avez une autre question ?
          </p>
          <a
            href="mailto:support@torp.app"
            className="text-primary font-semibold hover:underline"
          >
            Contactez notre support →
          </a>
        </div>
      </div>
    </section>
  );
};
