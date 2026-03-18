/**
 * FAQ Section - Refonte
 * Questions honnêtes sans faux chiffres
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
      question: "Comment fonctionne l'analyse de devis ?",
      answer:
        "TORP analyse votre devis selon plusieurs critères : cohérence des prix, informations de l'entreprise (SIRET, assurances), conformité technique, et détection de points d'attention. Notre objectif est de vous donner une vision claire et transparente pour prendre votre décision en toute confiance.",
    },
    {
      question: "Mes données sont-elles sécurisées ?",
      answer:
        "Absolument. Vos documents sont chiffrés, hébergés sur des serveurs européens, et conformes au RGPD. Vous gardez le contrôle total de vos données et pouvez les supprimer à tout moment depuis votre compte. Nous ne vendons jamais vos données à des tiers.",
    },
    {
      question: "Quels types de travaux peut-on analyser ?",
      answer:
        "Nous analysons tous types de travaux : rénovation (salle de bain, cuisine), construction neuve, extension, électricité, plomberie, chauffage, toiture, isolation, menuiserie, peinture, carrelage, etc. Notre solution s'adapte aussi bien aux particuliers qu'aux professionnels.",
    },
    {
      question: "L'analyse remplace-t-elle un expert ?",
      answer:
        "TORP est un outil d'aide à la décision, mais ne remplace pas un conseil juridique ou technique personnalisé. Pour des projets complexes ou situations particulières, nous recommandons de consulter également un architecte ou maître d'œuvre.",
    },
    {
      question: "Puis-je comparer plusieurs devis ?",
      answer:
        "Oui ! Notre outil permet de comparer plusieurs devis côte à côte pour vous aider à identifier le meilleur rapport qualité-prix et prendre une décision éclairée.",
    },
    {
      question: "Comment les professionnels peuvent-ils utiliser TORP ?",
      answer:
        "Les professionnels du BTP peuvent créer un compte professionnel pour bénéficier de fonctionnalités dédiées : certification de devis, badge de confiance, et outils de valorisation de leur expertise. Cela leur permet de se démarquer et de rassurer leurs clients.",
    },
    {
      question: "TORP est-il accessible à tous ?",
      answer:
        "Oui, notre mission est de rendre la transparence accessible à tous les acteurs du BTP. Nous proposons différentes formules adaptées aux particuliers comme aux professionnels. Consultez notre page Tarifs pour plus de détails.",
    },
    {
      question: "Comment puis-je contacter le support ?",
      answer:
        "Notre équipe support est disponible par email à support@torp.app. Nous nous efforçons de répondre rapidement à toutes vos questions pour vous accompagner au mieux dans votre projet.",
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
                key={`faq-${index}`}
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
            href="mailto:support@torp.fr"
            className="text-primary font-semibold hover:underline"
          >
            Contactez notre support →
          </a>
        </div>
      </div>
    </section>
  );
};
