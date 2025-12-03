import { useState } from 'react';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import { Users, Building } from 'lucide-react';
import B2CPricing from '@/components/pricing/B2CPricing';
import B2BPricing from '@/components/pricing/B2BPricing';

export default function Pricing() {
  const [userType, setUserType] = useState<'B2C' | 'B2B'>('B2C');

  const segments = [
    {
      key: 'B2C' as const,
      label: 'B2C',
      icon: <Users className="w-4 h-4" />,
      title: 'Particuliers',
      description: 'Analyse de devis pour aide à la décision'
    },
    {
      key: 'B2B' as const,
      label: 'B2B',
      icon: <Building className="w-4 h-4" />,
      title: 'Professionnels BTP',
      description: 'Certification et valorisation de vos devis'
    }
  ];

  const renderCurrentSegment = () => {
    switch (userType) {
      case 'B2C': return <B2CPricing />;
      case 'B2B': return <B2BPricing />;
      default: return <B2CPricing />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          {/* En-tête */}
          <div className="text-center mb-12">
            <div className="mb-6">
              <BackButton to="/dashboard" label="Dashboard" />
            </div>

            <h1 className="text-4xl font-bold text-foreground mb-4">
              Tarifs TORP
            </h1>
            <p className="text-xl text-muted-foreground mb-2">
              Une solution pour les particuliers et les professionnels
            </p>
            <p className="text-muted-foreground mb-8">
              Analysez vos devis en toute transparence
            </p>

            {/* Toggle type d'utilisateur */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="grid grid-cols-2 bg-muted rounded-lg p-1 w-full max-w-md">
                {segments.map((segment) => (
                  <button
                    key={segment.key}
                    onClick={() => setUserType(segment.key)}
                    className={`px-3 py-4 rounded-md text-sm font-medium transition-colors flex flex-col items-center gap-2 ${
                      userType === segment.key
                        ? 'bg-background text-foreground shadow-soft'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {segment.icon}
                      <span className="font-bold">{segment.label}</span>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-medium">{segment.title}</div>
                      <div className="text-xs opacity-75">{segment.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contenu du segment sélectionné */}
          <div className="mb-16">
            {renderCurrentSegment()}
          </div>

          {/* FAQ Section */}
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-center text-foreground mb-8">
              Questions fréquentes
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Comment fonctionne l'analyse ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Uploadez votre devis et notre IA l'analyse en quelques minutes selon nos critères de qualité, prix et conformité.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Puis-je changer d'offre ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Oui, vous pouvez évoluer entre les offres selon vos besoins à tout moment.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Y a-t-il un essai gratuit ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Oui, la première analyse est gratuite pour les particuliers. Les professionnels peuvent tester pendant 14 jours.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Le support est-il inclus ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Oui, le support par email est inclus dans toutes les offres. Les offres Pro incluent un support prioritaire.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
