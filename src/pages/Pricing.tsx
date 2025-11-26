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
      description: 'Analyse de devis reçus pour aide à la décision'
    },
    {
      key: 'B2B' as const,
      label: 'B2B',
      icon: <Building className="w-4 h-4" />,
      title: 'Professionnels BTP',
      description: 'Assistant optimisation devis avant envoi'
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
              ÉCOSYSTÈME COMMERCIAL TORP
            </h1>
            <p className="text-xl text-muted-foreground mb-2">
              Architecture Multi-Segments B2C • B2B • B2B2C • B2G
            </p>
            <p className="text-muted-foreground mb-8">
              Le premier service d'expertise technique accessible à tous les acteurs du secteur BTP
            </p>

            {/* Vision Stratégique */}
            <div className="bg-gradient-hero text-white rounded-xl p-6 mb-8">
              <h2 className="text-2xl font-bold mb-3">🎯 VISION STRATÉGIQUE GLOBALE</h2>
              <p className="text-white/90 mb-2">
                <strong>TORP révolutionne l'écosystème BTP français</strong> en proposant le premier service d'expertise technique accessible à tous les acteurs du secteur
              </p>
              <p className="text-white/80 text-sm">
                Innovation disruptive : Transformation du conseil BTP de service élitiste en infrastructure numérique démocratisée
              </p>
            </div>

            {/* Toggle type d'utilisateur */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 bg-muted rounded-lg p-1 w-full max-w-2xl">
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

          {/* Section Synergies Inter-Segments */}
          <div className="mt-16 space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                🔄 Synergies Inter-Segments
              </h2>
              <p className="text-lg text-muted-foreground">
                Écosystème vertueux auto-alimenté
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
                <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  B2B → B2C
                </h3>
                <p className="text-sm text-muted-foreground">
                  QR Code sur devis → Accès analyse flash gratuite → Upsell automatique
                </p>
              </div>

              <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
                <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  B2C → B2B
                </h3>
                <p className="text-sm text-muted-foreground">
                  Suivi paiements invite entreprises → Inscription gratuite → Conversion B2B
                </p>
              </div>

              <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
                <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  B2B2C → Multiplication
                </h3>
                <p className="text-sm text-muted-foreground">
                  1 prescripteur = 50+ certifications/an → Usage systématique → Network effects
                </p>
              </div>

              <div className="bg-primary-light border border-primary/20 rounded-lg p-6">
                <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  B2G → Légitimité
                </h3>
                <p className="text-sm text-muted-foreground">
                  Service public légitime TORP → Caution institutionnelle → Adoption généralisée
                </p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-16">
            <h3 className="text-2xl font-bold text-center text-foreground mb-8">
              Questions fréquentes
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Comment fonctionnent les synergies ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Chaque segment renforce les autres : QR codes B2B attirent B2C, suivi paiements B2C convertit B2B, prescripteurs B2B2C multiplient l'usage, collectivités B2G légitiment l'ensemble.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Puis-je changer de segment ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Oui, l'évolution entre segments est naturelle et encouragée selon vos besoins.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Puis-je tester gratuitement ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Oui, nous proposons des périodes d'essai pour tous les segments professionnels (B2B, B2B2C, B2G).
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Support inclus dans tous les segments ?</h4>
                  <p className="text-sm text-muted-foreground">
                    Le support est inclus avec des niveaux différents : email (Standard), téléphone (Business), dédié (Premium).
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