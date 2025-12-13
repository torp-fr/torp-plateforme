/**
 * PaymentDashboard - Tableau de bord des paiements et contrats
 * Vue d'ensemble financière avec indicateurs anti-fraude
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { PaymentService } from '@/services/payment/payment.service';
import type {
  Payment,
  PaymentStatus,
  PaymentType,
  ProjectContract,
  PaymentStats,
  FraudAlert
} from '@/types/payment.types';
import {
  Euro,
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  FileText,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  Building2,
  User,
  Wallet,
  Lock,
  Unlock,
  AlertCircle,
  XCircle,
  Loader2,
  Receipt,
  Banknote,
  PiggyBank,
  Scale
} from 'lucide-react';

interface PaymentDashboardProps {
  userId: string;
  userRole: 'client' | 'enterprise' | 'admin';
  contractId?: string;
}

export function PaymentDashboard({ userId, userRole, contractId }: PaymentDashboardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<ProjectContract[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<PaymentType | 'all'>('all');

  useEffect(() => {
    loadData();
  }, [userId, contractId]);

  const loadData = async () => {
    setLoading(true);

    // Charger les paiements
    const paymentsResult = contractId
      ? await PaymentService.getPaymentsByContract(contractId)
      : await PaymentService.getPaymentsByUser(userId);

    if (paymentsResult.payments) {
      setPayments(paymentsResult.payments);
    }

    // Charger les statistiques
    const statsResult = await PaymentService.getPaymentStats(userId, userRole);
    if (statsResult.stats) {
      setStats(statsResult.stats);
    }

    setLoading(false);
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case 'released': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'held': return <Lock className="h-4 w-4 text-blue-600" />;
      case 'processing': return <Loader2 className="h-4 w-4 text-orange-600 animate-spin" />;
      case 'pending':
      case 'awaiting_payment': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'disputed': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'refunded': return <RefreshCw className="h-4 w-4 text-purple-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-gray-600" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: PaymentStatus) => {
    const labels: Record<PaymentStatus, string> = {
      pending: 'En attente',
      awaiting_payment: 'Paiement attendu',
      processing: 'En cours',
      held: 'En séquestre',
      released: 'Libéré',
      refunded: 'Remboursé',
      disputed: 'En litige',
      cancelled: 'Annulé'
    };
    return labels[status] || status;
  };

  const getStatusVariant = (status: PaymentStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'released': return 'default';
      case 'held':
      case 'processing': return 'secondary';
      case 'disputed':
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getTypeIcon = (type: PaymentType) => {
    switch (type) {
      case 'deposit': return <PiggyBank className="h-4 w-4" />;
      case 'milestone': return <CheckCircle className="h-4 w-4" />;
      case 'final': return <Banknote className="h-4 w-4" />;
      case 'retention': return <Lock className="h-4 w-4" />;
      case 'penalty': return <AlertCircle className="h-4 w-4" />;
      case 'adjustment': return <Scale className="h-4 w-4" />;
      default: return <Euro className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: PaymentType) => {
    const labels: Record<PaymentType, string> = {
      deposit: 'Acompte',
      milestone: 'Jalon',
      final: 'Solde',
      retention: 'Retenue garantie',
      penalty: 'Pénalité',
      adjustment: 'Ajustement'
    };
    return labels[type] || type;
  };

  const filteredPayments = payments.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (typeFilter !== 'all' && p.paymentType !== typeFilter) return false;
    return true;
  });

  const handlePayNow = async (payment: Payment) => {
    const result = await PaymentService.createPayment({
      contractId: payment.contractId,
      milestoneId: payment.milestoneId,
      paymentType: payment.paymentType,
      montantHT: payment.montantHT,
      tauxTVA: payment.montantTVA / payment.montantHT * 100
    }, userId);

    if (result.clientSecret) {
      // Rediriger vers Stripe Checkout
      window.location.href = `/checkout?payment=${payment.id}&secret=${result.clientSecret}`;
    } else if (result.error) {
      toast({
        title: 'Erreur de paiement',
        description: result.error,
        variant: 'destructive'
      });
    }
  };

  const handleReleaseEscrow = async (payment: Payment) => {
    const result = await PaymentService.releasePayment(payment.id, userId);

    if (result.success) {
      toast({
        title: 'Paiement libéré',
        description: 'Les fonds ont été transférés à l\'entreprise.'
      });
      loadData();
    } else {
      toast({
        title: 'Erreur',
        description: result.error || 'Impossible de libérer le paiement.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total contracté</p>
                  <p className="text-2xl font-bold">
                    {stats.totalMontantContracte.toLocaleString('fr-FR')}€
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats.totalContrats} contrat(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {userRole === 'enterprise' ? 'Reçu' : 'Payé'}
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.totalPaye.toLocaleString('fr-FR')}€
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-600">
                  {((stats.totalPaye / stats.totalMontantContracte) * 100).toFixed(0)}% du total
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En séquestre</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.totalEnSequestre.toLocaleString('fr-FR')}€
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Fonds sécurisés par TORP
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.totalEnAttente.toLocaleString('fr-FR')}€
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                À payer prochainement
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alertes fraude (admin seulement) */}
      {userRole === 'admin' && stats && stats.fraude.alertesTotal > 0 && (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Alertes de sécurité</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {stats.fraude.alertesTotal} alerte(s) de fraude détectée(s), {stats.fraude.bloques} paiement(s) bloqué(s)
            </span>
            <Button size="sm" variant="outline">
              Voir les alertes
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tableau des paiements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Paiements
              </CardTitle>
              <CardDescription>
                Historique et gestion des paiements
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as PaymentStatus | 'all')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="awaiting_payment">Paiement attendu</SelectItem>
                  <SelectItem value="processing">En cours</SelectItem>
                  <SelectItem value="held">En séquestre</SelectItem>
                  <SelectItem value="released">Libéré</SelectItem>
                  <SelectItem value="disputed">En litige</SelectItem>
                  <SelectItem value="refunded">Remboursé</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as PaymentType | 'all')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="deposit">Acompte</SelectItem>
                  <SelectItem value="milestone">Jalon</SelectItem>
                  <SelectItem value="final">Solde</SelectItem>
                  <SelectItem value="retention">Retenue</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Montant TTC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                {userRole === 'admin' && <TableHead>Risque</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun paiement trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.reference}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(payment.paymentType)}
                        {getTypeLabel(payment.paymentType)}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {payment.montantTTC.toLocaleString('fr-FR')}€
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(payment.status)}>
                        {getStatusIcon(payment.status)}
                        <span className="ml-1">{getStatusLabel(payment.status)}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.paidAt
                        ? new Date(payment.paidAt).toLocaleDateString('fr-FR')
                        : payment.dueDate
                        ? new Date(payment.dueDate).toLocaleDateString('fr-FR')
                        : '-'}
                    </TableCell>
                    {userRole === 'admin' && (
                      <TableCell>
                        {payment.fraudScore > 50 ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {payment.fraudScore}
                          </Badge>
                        ) : payment.fraudScore > 25 ? (
                          <Badge variant="secondary">
                            {payment.fraudScore}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Action selon statut et rôle */}
                        {userRole === 'client' && payment.status === 'awaiting_payment' && (
                          <Button size="sm" onClick={() => handlePayNow(payment)}>
                            <CreditCard className="h-4 w-4 mr-1" />
                            Payer
                          </Button>
                        )}

                        {userRole === 'client' && payment.status === 'held' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleReleaseEscrow(payment)}
                          >
                            <Unlock className="h-4 w-4 mr-1" />
                            Libérer
                          </Button>
                        )}

                        {userRole === 'admin' && payment.requiresManualReview && (
                          <Button size="sm" variant="secondary">
                            <Eye className="h-4 w-4 mr-1" />
                            Examiner
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowPaymentDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Graphique de progression (si stats dispo) */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Répartition par statut
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.parStatut).map(([status, data]) => (
                <div key={status} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status as PaymentStatus)}
                      <span>{getStatusLabel(status as PaymentStatus)}</span>
                    </div>
                    <span className="font-medium">
                      {data.montant.toLocaleString('fr-FR')}€ ({data.count})
                    </span>
                  </div>
                  <Progress
                    value={(data.montant / stats.totalMontantContracte) * 100}
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog détails paiement */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du paiement</DialogTitle>
            <DialogDescription>
              {selectedPayment?.reference}
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <p className="font-medium flex items-center gap-2">
                    {getTypeIcon(selectedPayment.paymentType)}
                    {getTypeLabel(selectedPayment.paymentType)}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Statut</span>
                  <p>
                    <Badge variant={getStatusVariant(selectedPayment.status)}>
                      {getStatusIcon(selectedPayment.status)}
                      <span className="ml-1">{getStatusLabel(selectedPayment.status)}</span>
                    </Badge>
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Montant HT</span>
                  <p className="font-medium">{selectedPayment.montantHT.toLocaleString('fr-FR')}€</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">TVA</span>
                  <p className="font-medium">{selectedPayment.montantTVA.toLocaleString('fr-FR')}€</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Montant TTC</span>
                  <p className="text-xl font-bold">{selectedPayment.montantTTC.toLocaleString('fr-FR')}€</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Score fraude</span>
                  <p className="font-medium">
                    {selectedPayment.fraudScore > 50 ? (
                      <Badge variant="destructive">{selectedPayment.fraudScore}/100</Badge>
                    ) : selectedPayment.fraudScore > 25 ? (
                      <Badge variant="secondary">{selectedPayment.fraudScore}/100</Badge>
                    ) : (
                      <Badge variant="outline">{selectedPayment.fraudScore}/100</Badge>
                    )}
                  </p>
                </div>
              </div>

              {selectedPayment.fraudAlerts.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Alertes de sécurité</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm mt-2">
                      {selectedPayment.fraudAlerts.map((alert, i) => (
                        <li key={i}>{alert}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Historique des statuts */}
              <div className="space-y-2">
                <span className="text-sm font-medium">Historique</span>
                <div className="space-y-2">
                  {selectedPayment.statusHistory.map((change, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {new Date(change.changedAt).toLocaleString('fr-FR')}
                      </span>
                      <Badge variant="outline">{getStatusLabel(change.status)}</Badge>
                      {change.reason && (
                        <span className="text-muted-foreground">- {change.reason}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Fermer
            </Button>
            {selectedPayment && (
              <Button variant="outline">
                <Receipt className="h-4 w-4 mr-2" />
                Télécharger reçu
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
