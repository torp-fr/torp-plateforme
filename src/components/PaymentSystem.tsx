import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  Euro,
  FileText,
  Users,
  ArrowRight,
  Banknote,
  Camera,
  Calendar
} from 'lucide-react';
import { type PaymentStage, type PaymentSequestre, type ProjetTracking } from '@/types/torp';
import { usePayments, type Payment } from '@/hooks';

interface PaymentSystemProps {
  projet: ProjetTracking;
  userType: 'client' | 'artisan';
  onPaymentAction: (action: string, data: any) => void;
}

const PaymentSystem: React.FC<PaymentSystemProps> = ({ projet, userType, onPaymentAction }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Utilisation du hook usePayments - ZÉRO MOCK
  const { payments, milestones, stats, isLoading } = usePayments({ projectId: projet.id });

  // Transformer les paiements en format séquestre pour compatibilité UI
  const sequestres = useMemo<PaymentSequestre[]>(() => {
    if (!payments || payments.length === 0) return [];

    return payments.map((payment: Payment) => ({
      id: payment.id,
      projetId: projet.id,
      montant: payment.montant_demande || 0,
      dateCreation: new Date(payment.date_demande),
      dateLiberationPrevue: payment.date_validation ? new Date(payment.date_validation) : new Date(),
      status: payment.status === 'released' ? 'libere' :
              payment.status === 'held' ? 'en_attente' :
              payment.status === 'disputed' ? 'litige' : 'en_attente',
      commissionTorp: Math.round((payment.montant_demande || 0) * 0.015), // 1.5%
      justificationLiberation: payment.documents || [],
      dateLiberationReelle: payment.date_paiement ? new Date(payment.date_paiement) : undefined,
    }));
  }, [payments, projet.id]);

  const calculateProjectProgress = () => {
    const totalMontant = projet.etapesPaiement.reduce((sum, etape) => sum + etape.montant, 0);
    const montantPaye = projet.etapesPaiement
      .filter(etape => etape.status === 'paye' || etape.status === 'valide')
      .reduce((sum, etape) => sum + etape.montant, 0);
    return Math.round((montantPaye / totalMontant) * 100);
  };

  const getNextPayment = () => {
    return projet.etapesPaiement.find(etape => etape.status === 'en_attente');
  };

  const getTotalCommissions = () => {
    return sequestres.reduce((total, seq) => total + seq.commissionTorp, 0);
  };

  const progress = calculateProjectProgress();
  const nextPayment = getNextPayment();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header avec Statistiques */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Système de Paiements TORP</CardTitle>
                <p className="text-muted-foreground">
                  {userType === 'client' ? 'Gestion sécurisée de vos paiements' : 'Encaissements garantis'}
                </p>
              </div>
            </div>
            <Badge variant="success" className="text-lg px-4 py-2">
              Sécurisé par TORP
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary mb-1">
                {projet.montantTotal.toLocaleString()}€
              </div>
              <div className="text-sm text-muted-foreground">Budget Total</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-success mb-1">{progress}%</div>
              <div className="text-sm text-muted-foreground">Avancement</div>
              <Progress value={progress} className="mt-2 h-2" />
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-warning mb-1">
                {sequestres.filter(s => s.status === 'en_attente').length}
              </div>
              <div className="text-sm text-muted-foreground">Paiements Séquestrés</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground mb-1">
                {getTotalCommissions()}€
              </div>
              <div className="text-sm text-muted-foreground">
                {userType === 'client' ? 'Frais de service' : 'Commission TORP'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="sequestre">Séquestre</TabsTrigger>
          <TabsTrigger value="jalons">Jalons</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Prochain Paiement */}
            {nextPayment && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Prochain Paiement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{nextPayment.nom}</div>
                      <div className="text-sm text-muted-foreground">
                        Échéance : {nextPayment.dateEcheance.toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {nextPayment.montant.toLocaleString()}€
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {nextPayment.pourcentage}% du total
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="text-sm font-medium mb-2">Validation requise :</div>
                    <div className="flex items-center gap-2">
                      {nextPayment.typeValidation === 'photos' && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          Photos de chantier
                        </Badge>
                      )}
                      {nextPayment.typeValidation === 'signature' && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Signature client
                        </Badge>
                      )}
                    </div>
                  </div>

                  {userType === 'client' ? (
                    <Button 
                      className="w-full" 
                      onClick={() => onPaymentAction('pay', nextPayment)}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Effectuer le paiement
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => onPaymentAction('request_validation', nextPayment)}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Demander validation
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Flux de Paiement */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  Flux de Paiement Sécurisé
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
                    <div className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Paiement Client</div>
                      <div className="text-sm text-muted-foreground">
                        {userType === 'client' ? 'Vous payez via CB/Virement' : 'Client effectue le paiement'}
                      </div>
                    </div>
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-warning/5 rounded-lg">
                    <div className="bg-warning text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Séquestre TORP</div>
                      <div className="text-sm text-muted-foreground">
                        Montant bloqué 24-48h maximum
                      </div>
                    </div>
                    <Shield className="h-4 w-4 text-warning" />
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-success/5 rounded-lg">
                    <div className="bg-success text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Libération</div>
                      <div className="text-sm text-muted-foreground">
                        {userType === 'client' ? 'Après validation de votre part' : 'Virement vers votre compte'}
                      </div>
                    </div>
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-success" />
                    <span className="font-medium text-success">
                      Protection TORP : Médiation gratuite en cas de litige
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Statistiques de Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Performance du Projet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-lg font-bold text-success mb-2">
                    {projet.etapesPaiement.filter(e => e.status === 'paye').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Paiements réalisés</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-primary mb-2">3.2j</div>
                  <div className="text-sm text-muted-foreground">Délai moyen encaissement</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-warning mb-2">0</div>
                  <div className="text-sm text-muted-foreground">Litiges ouverts</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Séquestre */}
        <TabsContent value="sequestre" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compte Séquestre TORP
              </CardTitle>
              <p className="text-muted-foreground">
                Protection maximale pour {userType === 'client' ? 'vos paiements' : 'vos encaissements'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {sequestres.map((sequestre) => (
                <div key={sequestre.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        sequestre.status === 'libere' ? 'success' :
                        sequestre.status === 'en_attente' ? 'warning' :
                        sequestre.status === 'litige' ? 'destructive' : 'secondary'
                      }>
                        {sequestre.status.replace('_', ' ')}
                      </Badge>
                      <span className="font-medium">
                        {sequestre.montant.toLocaleString()}€
                      </span>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      Créé le {sequestre.dateCreation.toLocaleDateString()}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Commission TORP</span>
                      <span className="font-medium">{sequestre.commissionTorp}€ (1.5%)</span>
                    </div>
                    
                    {sequestre.status === 'en_attente' && (
                      <div className="flex justify-between">
                        <span>Libération prévue</span>
                        <span className="font-medium">
                          {sequestre.dateLiberationPrevue.toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {sequestre.dateLiberationReelle && (
                      <div className="flex justify-between">
                        <span>Libéré le</span>
                        <span className="font-medium text-success">
                          {sequestre.dateLiberationReelle.toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-muted-foreground">
                      <strong>Justifications :</strong> {sequestre.justificationLiberation.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Jalons */}
        <TabsContent value="jalons" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Planning de Paiements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {projet.etapesPaiement.map((etape, index) => (
                <div key={etape.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      etape.status === 'valide' ? 'bg-success text-white' :
                      etape.status === 'paye' ? 'bg-primary text-white' :
                      etape.status === 'litige' ? 'bg-destructive text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium">{etape.nom}</h4>
                      <span className="font-bold">{etape.montant.toLocaleString()}€</span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Échéance : {etape.dateEcheance.toLocaleDateString()}</span>
                      <Badge variant="outline">{etape.pourcentage}%</Badge>
                      <Badge variant="outline">{etape.typeValidation}</Badge>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {etape.status === 'valide' ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : etape.status === 'paye' ? (
                      <CreditCard className="h-5 w-5 text-primary" />
                    ) : etape.status === 'litige' ? (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Historique */}
        <TabsContent value="historique" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Historique des Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Simulation historique */}
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <div>
                      <div className="font-medium">Paiement acompte libéré</div>
                      <div className="text-sm text-muted-foreground">01/02/2024 - 14:32</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">15,000€</div>
                    <div className="text-sm text-muted-foreground">Commission : 225€</div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-warning" />
                    <div>
                      <div className="font-medium">Paiement mis en séquestre</div>
                      <div className="text-sm text-muted-foreground">15/02/2024 - 10:15</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">20,000€</div>
                    <div className="text-sm text-muted-foreground">En attente validation</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentSystem;