import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Header } from '@/components/Header';
import { BackButton } from '@/components/BackButton';
import { 
  Calculator, 
  Building2, 
  CreditCard, 
  CheckCircle, 
  Clock,
  FileText,
  TrendingUp,
  Shield,
  Percent,
  Euro
} from 'lucide-react';

interface BankPartner {
  id: string;
  name: string;
  logo: string;
  minRate: number;
  maxRate: number;
  maxAmount: number;
  processingTime: string;
  specialties: string[];
  advantages: string[];
}

interface LoanSimulation {
  amount: number;
  duration: number;
  rate: number;
  monthlyPayment: number;
  totalCost: number;
  totalInterest: number;
}

export default function FinancingPlatform() {
  const [loanAmount, setLoanAmount] = useState(15000);
  const [loanDuration, setLoanDuration] = useState(60);
  const [selectedProject] = useState({
    name: 'Rénovation cuisine complète',
    amount: 15000,
    torpScore: 'A+',
    cctp: true
  });

  const bankPartners: BankPartner[] = [
    {
      id: '1',
      name: 'Crédit Agricole',
      logo: '🏦',
      minRate: 2.5,
      maxRate: 4.2,
      maxAmount: 75000,
      processingTime: '48h',
      specialties: ['Rénovation énergétique', 'Gros travaux'],
      advantages: ['Taux préférentiel TORP', 'Réponse rapide', 'Accompagnement dédié']
    },
    {
      id: '2',
      name: 'BNP Paribas',
      logo: '🏛️',
      minRate: 2.8,
      maxRate: 4.5,
      maxAmount: 100000,
      processingTime: '72h',
      specialties: ['Travaux d\'extension', 'Rénovation complète'],
      advantages: ['Score TORP pris en compte', 'Conditions négociées', 'Assurance incluse']
    },
    {
      id: '3',
      name: 'Société Générale',
      logo: '🏢',
      minRate: 2.3,
      maxRate: 4.0,
      maxAmount: 80000,
      processingTime: '24h',
      specialties: ['Eco-rénovation', 'Domotique'],
      advantages: ['Réponse express', 'Bonus score A+', 'Frais réduits']
    }
  ];

  const calculateLoan = (amount: number, duration: number, rate: number): LoanSimulation => {
    const monthlyRate = rate / 100 / 12;
    const monthlyPayment = (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -duration));
    const totalCost = monthlyPayment * duration;
    const totalInterest = totalCost - amount;

    return {
      amount,
      duration,
      rate,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100
    };
  };

  const getBestRate = (partner: BankPartner) => {
    // Bonus pour score TORP A+
    const torpBonus = selectedProject.torpScore === 'A+' ? 0.3 : 0;
    // Bonus pour CCTP
    const cctpBonus = selectedProject.cctp ? 0.2 : 0;
    
    return Math.max(partner.minRate, partner.minRate - torpBonus - cctpBonus);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <BackButton to="/project-tracking" label="Suivi projet" />
          </div>

          {/* En-tête */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Financement de votre projet
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Solutions de financement adaptées à votre projet TORP
            </p>
          </div>

          {/* Projet sélectionné */}
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Projet à financer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{selectedProject.name}</h3>
                  <p className="text-muted-foreground">Montant : {selectedProject.amount.toLocaleString()}€</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className="bg-success/10 text-success border-success">
                    Score TORP {selectedProject.torpScore}
                  </Badge>
                  {selectedProject.cctp && (
                    <Badge className="bg-info/10 text-info border-info">
                      CCTP inclus
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Simulateur de prêt */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Simulateur de prêt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="loan-amount">Montant souhaité</Label>
                  <div className="relative mt-1">
                    <Input
                      id="loan-amount"
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(Number(e.target.value))}
                      className="pr-8"
                    />
                    <Euro className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="loan-duration">Durée (mois)</Label>
                  <Input
                    id="loan-duration"
                    type="number"
                    value={loanDuration}
                    onChange={(e) => setLoanDuration(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <div className="p-4 bg-muted/20 rounded-lg">
                  <h4 className="font-medium mb-3">Avantages TORP</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <span>Score {selectedProject.torpScore} : -0.3% sur le taux</span>
                    </div>
                    {selectedProject.cctp && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <span>CCTP inclus : -0.2% sur le taux</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button className="w-full">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Lancer la simulation
                </Button>
              </CardContent>
            </Card>

            {/* Partenaires bancaires */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-6">Nos partenaires bancaires</h2>
              <div className="space-y-6">
                {bankPartners.map((partner) => {
                  const bestRate = getBestRate(partner);
                  const simulation = calculateLoan(loanAmount, loanDuration, bestRate);
                  
                  return (
                    <Card key={partner.id} className="border-border hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{partner.logo}</span>
                            <div>
                              <CardTitle className="text-lg">{partner.name}</CardTitle>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Réponse en {partner.processingTime}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  Jusqu'à {partner.maxAmount.toLocaleString()}€
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              {bestRate.toFixed(1)}%
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Taux négocié TORP
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-3">
                            <h4 className="font-medium text-sm">Spécialités</h4>
                            <div className="space-y-1">
                              {partner.specialties.map((specialty, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {specialty}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-medium text-sm">Avantages</h4>
                            <div className="space-y-1">
                              {partner.advantages.map((advantage, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                  <CheckCircle className="w-3 h-3 text-success" />
                                  <span>{advantage}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-medium text-sm">Simulation</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span>Mensualité :</span>
                                <span className="font-medium">{simulation.monthlyPayment}€</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Coût total :</span>
                                <span className="font-medium">{simulation.totalCost.toLocaleString()}€</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground">
                                <span>Intérêts :</span>
                                <span>{simulation.totalInterest.toLocaleString()}€</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                          <Button className="flex-1">
                            <CreditCard className="w-4 h-4 mr-2" />
                            Demander ce financement
                          </Button>
                          <Button variant="outline">
                            En savoir plus
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Informations complémentaires */}
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Sécurité et transparence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Vos avantages TORP</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-success" />
                          <span>Taux préférentiels négociés</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-success" />
                          <span>Dossier pré-qualifié grâce au score TORP</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-success" />
                          <span>Réponse accélérée (24-72h)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-success" />
                          <span>Accompagnement personnalisé</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3">Sécurité et conformité</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-info" />
                          <span>Banques partenaires agréées</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-info" />
                          <span>Données cryptées et sécurisées</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-info" />
                          <span>Conformité RGPD</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-info" />
                          <span>Sans engagement</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}