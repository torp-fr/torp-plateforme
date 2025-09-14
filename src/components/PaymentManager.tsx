import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useApp, UserType } from '@/context/AppContext';
import { 
  CreditCard, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Euro,
  FileText,
  Send,
  Eye
} from 'lucide-react';

interface PaymentRequest {
  id: string;
  projectId: string;
  amount: number;
  description: string;
  type: 'acompte' | 'avancement' | 'solde' | 'materiel' | 'autre';
  status: 'pending' | 'paid' | 'rejected';
  createdAt: string;
  dueDate: string;
  milestone?: string;
}

interface PaymentManagerProps {
  projectId: string;
  userType: UserType;
  projectAmount: string;
}

const mockPaymentRequests: PaymentRequest[] = [
  {
    id: '1',
    projectId: '1',
    amount: 4560,
    description: 'Acompte 30% à la signature du devis',
    type: 'acompte',
    status: 'paid',
    createdAt: '2024-03-15',
    dueDate: '2024-03-20',
    milestone: 'Signature du contrat'
  },
  {
    id: '2',
    projectId: '1',
    amount: 6080,
    description: 'Paiement intermédiaire - 40% à la livraison des matériaux',
    type: 'avancement',
    status: 'pending',
    createdAt: '2024-03-18',
    dueDate: '2024-03-25',
    milestone: 'Livraison matériaux'
  },
  {
    id: '3',
    projectId: '1',
    amount: 4560,
    description: 'Solde final à la réception des travaux',
    type: 'solde',
    status: 'pending',
    createdAt: '2024-03-20',
    dueDate: '2024-04-15',
    milestone: 'Réception travaux'
  }
];

export function PaymentManager({ projectId, userType, projectAmount }: PaymentManagerProps) {
  const [paymentRequests, setPaymentRequests] = useState(mockPaymentRequests);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newRequest, setNewRequest] = useState({
    amount: '',
    description: '',
    type: 'avancement' as const,
    dueDate: '',
    milestone: ''
  });
  const { toast } = useToast();

  const handleCreateRequest = () => {
    if (!newRequest.amount || !newRequest.description || !newRequest.dueDate) {
      toast({
        title: 'Informations manquantes',
        description: 'Veuillez remplir tous les champs obligatoires.',
        variant: 'destructive'
      });
      return;
    }

    const request: PaymentRequest = {
      id: Date.now().toString(),
      projectId,
      amount: parseFloat(newRequest.amount),
      description: newRequest.description,
      type: newRequest.type,
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0],
      dueDate: newRequest.dueDate,
      milestone: newRequest.milestone
    };

    setPaymentRequests(prev => [request, ...prev]);
    setNewRequest({
      amount: '',
      description: '',
      type: 'avancement',
      dueDate: '',
      milestone: ''
    });
    setShowNewRequest(false);

    toast({
      title: 'Demande créée',
      description: 'La demande de paiement a été envoyée au client.',
    });
  };

  const handlePayment = (requestId: string) => {
    setPaymentRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, status: 'paid' as const }
          : req
      )
    );

    toast({
      title: 'Paiement effectué',
      description: 'Le paiement a été enregistré avec succès.',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return CheckCircle;
      case 'pending': return Clock;
      case 'rejected': return AlertCircle;
      default: return Clock;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'acompte': return 'Acompte';
      case 'avancement': return 'Avancement';
      case 'solde': return 'Solde';
      case 'materiel': return 'Matériel';
      case 'autre': return 'Autre';
      default: return type;
    }
  };

  const totalPaid = paymentRequests
    .filter(req => req.status === 'paid')
    .reduce((sum, req) => sum + req.amount, 0);

  const totalProject = parseFloat(projectAmount.replace(/[^0-9]/g, '')) || 0;

  return (
    <div className="space-y-6">
      {/* Résumé financier */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="w-5 h-5" />
            Suivi financier du projet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {totalProject.toLocaleString()}€
              </div>
              <div className="text-sm text-muted-foreground">Montant total</div>
            </div>
            <div className="text-center p-4 bg-success/10 rounded-lg">
              <div className="text-2xl font-bold text-success">
                {totalPaid.toLocaleString()}€
              </div>
              <div className="text-sm text-muted-foreground">Déjà payé</div>
            </div>
            <div className="text-center p-4 bg-warning/10 rounded-lg">
              <div className="text-2xl font-bold text-warning">
                {(totalProject - totalPaid).toLocaleString()}€
              </div>
              <div className="text-sm text-muted-foreground">Restant dû</div>
            </div>
          </div>
          
          {/* Barre de progression */}
          <div className="mt-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Progression des paiements</span>
              <span>{Math.round((totalPaid / totalProject) * 100)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-success h-3 rounded-full transition-all duration-500"
                style={{ width: `${(totalPaid / totalProject) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions selon le type d'utilisateur */}
      {userType === 'B2B' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Demandes de paiement</CardTitle>
              <Button onClick={() => setShowNewRequest(!showNewRequest)}>
                <Send className="w-4 h-4 mr-2" />
                Nouvelle demande
              </Button>
            </div>
          </CardHeader>
          
          {showNewRequest && (
            <CardContent className="border-t">
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Montant (€) *</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={newRequest.amount}
                      onChange={(e) => setNewRequest({...newRequest, amount: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Type de paiement *</Label>
                    <Select
                      value={newRequest.type}
                      onValueChange={(value: any) => setNewRequest({...newRequest, type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="acompte">Acompte</SelectItem>
                        <SelectItem value="avancement">Avancement travaux</SelectItem>
                        <SelectItem value="materiel">Matériel</SelectItem>
                        <SelectItem value="solde">Solde final</SelectItem>
                        <SelectItem value="autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Date d'échéance *</Label>
                    <Input
                      type="date"
                      value={newRequest.dueDate}
                      onChange={(e) => setNewRequest({...newRequest, dueDate: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Étape associée</Label>
                    <Input
                      placeholder="Ex: Livraison matériaux"
                      value={newRequest.milestone}
                      onChange={(e) => setNewRequest({...newRequest, milestone: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Description *</Label>
                  <Textarea
                    placeholder="Motif et détails du paiement..."
                    value={newRequest.description}
                    onChange={(e) => setNewRequest({...newRequest, description: e.target.value})}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleCreateRequest}>
                    Envoyer la demande
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewRequest(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Liste des demandes de paiement */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des paiements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paymentRequests.map((request) => {
              const StatusIcon = getStatusIcon(request.status);
              
              return (
                <div key={request.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getStatusColor(request.status)}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {request.status === 'paid' ? 'Payé' : request.status === 'pending' ? 'En attente' : 'Refusé'}
                        </Badge>
                        <Badge variant="outline">
                          {getTypeLabel(request.type)}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-foreground">{request.description}</h4>
                      {request.milestone && (
                        <p className="text-sm text-muted-foreground">
                          Étape : {request.milestone}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-foreground">
                        {request.amount.toLocaleString()}€
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Échéance : {new Date(request.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  {userType === 'B2C' && request.status === 'pending' && (
                    <div className="flex gap-2 pt-3 border-t">
                      <Button onClick={() => handlePayment(request.id)}>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Payer maintenant
                      </Button>
                      <Button variant="outline">
                        <Eye className="w-4 h-4 mr-2" />
                        Voir détails
                      </Button>
                    </div>
                  )}
                  
                  {userType === 'B2B' && (
                    <div className="flex gap-2 pt-3 border-t">
                      <Button variant="outline" size="sm">
                        <FileText className="w-4 h-4 mr-2" />
                        Facture
                      </Button>
                      {request.status === 'pending' && (
                        <Button variant="outline" size="sm">
                          <Calendar className="w-4 h-4 mr-2" />
                          Relancer
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}