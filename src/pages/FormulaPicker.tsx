import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import { 
  Shield, 
  Star, 
  CheckCircle, 
  FileText, 
  BarChart3, 
  Lightbulb,
  CreditCard,
  Timer,
  Building
} from 'lucide-react';

interface Formula {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  pro?: boolean;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface Insurance {
  id: string;
  name: string;
  description: string;
  coverage: string;
  price: number;
  recommended?: boolean;
}

export default function FormulaPicker() {
  const [selectedFormula, setSelectedFormula] = useState<string | null>(null);
  const [selectedInsurances, setSelectedInsurances] = useState<string[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const formulas: Formula[] = [
    {
      id: 'simple',
      name: 'Analyse Simple',
      price: 9.99,
      description: 'Score TORP + explications de base',
      features: [
        'Score TORP détaillé (A-E)',
        'Analyse de conformité basique', 
        'Points d\'attention principaux',
        'Rapport PDF téléchargeable',
        'Temps d\'analyse: 3 minutes'
      ],
      icon: BarChart3,
      color: 'text-info',
      bgColor: 'bg-info/10'
    },
    {
      id: 'premium',
      name: 'Analyse Premium',
      price: 24.99,
      description: 'Analyse complète + recommandations',
      features: [
        'Tout de l\'analyse simple',
        'Comparaison marché régional',
        'Recommandations de négociation',
        'Questions à poser à l\'artisan',
        'Analyse des prix détaillée',
        'Support prioritaire',
        'Temps d\'analyse: 5 minutes'
      ],
      popular: true,
      icon: Star,
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    },
    {
      id: 'cctp',
      name: 'Avec CCTP',
      price: 49.99,
      description: 'Score A+ garanti + audit technique complet',
      features: [
        'Tout de l\'analyse premium',
        'CCTP (Cahier des Clauses Techniques)',
        'Score A+ garanti (95+/100)',
        'Audit technique approfondi',
        'Conformité DTU vérifiée',
        'Accompagnement expert',
        'Garantie satisfaction',
        'Temps d\'analyse: 10 minutes'
      ],
      pro: true,
      icon: FileText,
      color: 'text-success',
      bgColor: 'bg-success/10'
    }
  ];

  const insurances: Insurance[] = [
    {
      id: 'quality',
      name: 'Garantie Qualité Plus',
      description: 'Protection contre les malfaçons et retards',
      coverage: 'Remboursement jusqu\'à 5 000€ en cas de malfaçons',
      price: 29.99,
      recommended: true
    },
    {
      id: 'satisfaction',
      name: 'Satisfaction Client',
      description: 'Garantie de satisfaction ou remboursement',
      coverage: 'Médiation gratuite + remboursement si insatisfaction',
      price: 19.99
    },
    {
      id: 'legal',
      name: 'Protection Juridique',
      description: 'Assistance juridique en cas de litige',
      coverage: 'Prise en charge frais d\'avocat jusqu\'à 3 000€',
      price: 39.99
    }
  ];

  const selectedFormulaData = formulas.find(f => f.id === selectedFormula);
  const totalPrice = (selectedFormulaData?.price || 0) + 
    selectedInsurances.reduce((sum, id) => {
      const insurance = insurances.find(i => i.id === id);
      return sum + (insurance?.price || 0);
    }, 0);

  const handleInsuranceToggle = (insuranceId: string) => {
    setSelectedInsurances(prev => 
      prev.includes(insuranceId) 
        ? prev.filter(id => id !== insuranceId)
        : [...prev, insuranceId]
    );
  };

  const handlePayment = async () => {
    if (!selectedFormula) {
      toast({
        title: 'Formule non sélectionnée',
        description: 'Veuillez choisir une formule d\'analyse.',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessingPayment(true);

    // Simulation du processus de paiement (2 secondes)
    setTimeout(() => {
      toast({
        title: 'Paiement simulé avec succès !',
        description: `Formule ${selectedFormulaData?.name} activée pour ${totalPrice.toFixed(2)}€`,
      });

      setIsProcessingPayment(false);
      
      // Stocker les données de la formule pour l'analyse
      const formulaData = {
        formula: selectedFormula,
        insurances: selectedInsurances,
        price: totalPrice,
        timestamp: Date.now()
      };
      
      sessionStorage.setItem('selectedFormula', JSON.stringify(formulaData));
      
      // Rediriger directement vers l'analyse en cours
      navigate('/analyzing', { 
        state: { 
          ...location.state,
          formula: formulaData,
          paymentCompleted: true
        }
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <BackButton />
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                Choisissez votre formule d'analyse
              </h1>
              <p className="text-xl text-muted-foreground">
                Sélectionnez le niveau d'analyse qui correspond à vos besoins
              </p>
            </div>
          </div>

          {/* Sélection des formules */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {formulas.map((formula) => {
              const Icon = formula.icon;
              const isSelected = selectedFormula === formula.id;
              
              return (
                <Card 
                  key={formula.id}
                  className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    isSelected ? 'ring-2 ring-primary' : ''
                  } ${formula.popular ? 'border-warning' : formula.pro ? 'border-success' : ''}`}
                  onClick={() => setSelectedFormula(formula.id)}
                >
                  {formula.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-warning text-warning-foreground">
                        Plus populaire
                      </Badge>
                    </div>
                  )}
                  {formula.pro && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-success text-success-foreground">
                        Recommandé Pro
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center">
                    <div className={`w-16 h-16 rounded-full ${formula.bgColor} flex items-center justify-center mx-auto mb-4`}>
                      <Icon className={`w-8 h-8 ${formula.color}`} />
                    </div>
                    <CardTitle className="text-xl">{formula.name}</CardTitle>
                    <div className="text-3xl font-bold text-primary">
                      {formula.price}€
                    </div>
                    <p className="text-muted-foreground">{formula.description}</p>
                  </CardHeader>
                  
                  <CardContent>
                    <ul className="space-y-2">
                      {formula.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button 
                      className={`w-full mt-6 ${isSelected ? 'bg-primary' : 'bg-muted'}`}
                      variant={isSelected ? 'default' : 'outline'}
                    >
                      {isSelected ? 'Sélectionnée' : 'Choisir cette formule'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Assurances complémentaires */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Assurances complémentaires (optionnelles)
              </CardTitle>
              <p className="text-muted-foreground">
                Protégez-vous avec nos garanties supplémentaires
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {insurances.map((insurance) => {
                  const isSelected = selectedInsurances.includes(insurance.id);
                  
                  return (
                    <div
                      key={insurance.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleInsuranceToggle(insurance.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold">{insurance.name}</h4>
                        {insurance.recommended && (
                          <Badge variant="secondary" className="text-xs">
                            Recommandé
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {insurance.description}
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        {insurance.coverage}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">
                          +{insurance.price}€
                        </span>
                        <CheckCircle className={`w-5 h-5 ${
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Récapitulatif et paiement */}
          {selectedFormula && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Récapitulatif de votre commande
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span>Formule {selectedFormulaData?.name}</span>
                    <span className="font-semibold">{selectedFormulaData?.price}€</span>
                  </div>
                  
                  {selectedInsurances.map(id => {
                    const insurance = insurances.find(i => i.id === id);
                    return insurance ? (
                      <div key={id} className="flex justify-between items-center py-2 border-b">
                        <span>{insurance.name}</span>
                        <span className="font-semibold">+{insurance.price}€</span>
                      </div>
                    ) : null;
                  })}
                  
                  <div className="flex justify-between items-center py-3 text-lg font-bold border-t-2">
                    <span>Total</span>
                    <span className="text-primary">{totalPrice.toFixed(2)}€</span>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold">Ce qui est inclus :</h4>
                      <ul className="text-sm space-y-1">
                        {selectedFormulaData?.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-success" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Timer className="w-4 h-4" />
                        <span>Analyse disponible immédiatement après paiement</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building className="w-4 h-4" />
                        <span>Paiement sécurisé - Satisfaction garantie</span>
                      </div>
                      
                      <Button 
                        onClick={handlePayment}
                        disabled={isProcessingPayment}
                        className="w-full"
                        size="lg"
                      >
                        {isProcessingPayment ? (
                          <>
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                            Traitement...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Procéder au paiement - {totalPrice.toFixed(2)}€
                          </>
                        )}
                      </Button>
                      
                      <p className="text-xs text-center text-muted-foreground">
                        En procédant au paiement, vous acceptez nos conditions générales de vente.
                        Paiement sécurisé par Stripe.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}