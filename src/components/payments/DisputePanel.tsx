/**
 * DisputePanel - Gestion des litiges de paiement
 * Interface pour ouvrir, suivre et résoudre les litiges
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { DisputeService } from '@/services/payment/dispute.service';
import type { Dispute, DisputeStatus, DisputeReason, DisputeProof, DisputeEvent } from '@/types/payment.types';
import {
  AlertTriangle,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  Upload,
  FileText,
  Image,
  Video,
  Scale,
  Gavel,
  UserCircle,
  Calendar,
  Euro,
  ChevronRight,
  Send,
  Loader2,
  Eye,
  Plus,
  X,
  Shield,
  ArrowRight
} from 'lucide-react';

interface DisputePanelProps {
  contractId: string;
  userId: string;
  userRole: 'client' | 'enterprise' | 'mediator';
}

export function DisputePanel({ contractId, userId, userRole }: DisputePanelProps) {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showNewDisputeDialog, setShowNewDisputeDialog] = useState(false);
  const [showDisputeDetailDialog, setShowDisputeDetailDialog] = useState(false);
  const [showAddProofDialog, setShowAddProofDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Formulaire nouveau litige
  const [newDisputeForm, setNewDisputeForm] = useState({
    reason: '' as DisputeReason | '',
    titre: '',
    description: '',
    montantConteste: '',
    milestoneId: '',
    paymentId: ''
  });

  // Formulaire message/preuve
  const [messageForm, setMessageForm] = useState({
    message: '',
    files: [] as File[]
  });

  useEffect(() => {
    loadDisputes();
  }, [contractId]);

  const loadDisputes = async () => {
    setLoading(true);
    const result = await DisputeService.getDisputesByContract(contractId);
    if (result.disputes) {
      setDisputes(result.disputes);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: DisputeStatus) => {
    switch (status) {
      case 'opened': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'under_review': return <Eye className="h-4 w-4 text-blue-600" />;
      case 'mediation': return <Scale className="h-4 w-4 text-purple-600" />;
      case 'resolved_client': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'resolved_enterprise': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'escalated': return <Gavel className="h-4 w-4 text-red-600" />;
      case 'closed': return <XCircle className="h-4 w-4 text-gray-600" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: DisputeStatus) => {
    const labels: Record<DisputeStatus, string> = {
      opened: 'Ouvert',
      under_review: 'En examen',
      mediation: 'Médiation',
      resolved_client: 'Résolu (Client)',
      resolved_enterprise: 'Résolu (Entreprise)',
      escalated: 'Escaladé',
      closed: 'Fermé'
    };
    return labels[status] || status;
  };

  const getStatusVariant = (status: DisputeStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'resolved_client':
      case 'resolved_enterprise': return 'default';
      case 'under_review':
      case 'mediation': return 'secondary';
      case 'escalated': return 'destructive';
      default: return 'outline';
    }
  };

  const getReasonLabel = (reason: DisputeReason) => {
    const labels: Record<DisputeReason, string> = {
      non_conformity: 'Non-conformité',
      delay: 'Retard',
      quality: 'Qualité insuffisante',
      incomplete: 'Travaux incomplets',
      price_dispute: 'Contestation de prix',
      communication: 'Problème de communication',
      damage: 'Dommages causés',
      abandonment: 'Abandon de chantier',
      other: 'Autre'
    };
    return labels[reason] || reason;
  };

  const getEventIcon = (type: DisputeEvent['type']) => {
    switch (type) {
      case 'status_change': return <ArrowRight className="h-3 w-3" />;
      case 'message': return <MessageSquare className="h-3 w-3" />;
      case 'proof_added': return <Upload className="h-3 w-3" />;
      case 'assignment': return <UserCircle className="h-3 w-3" />;
      case 'resolution': return <Gavel className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const handleCreateDispute = async () => {
    if (!newDisputeForm.reason || !newDisputeForm.titre || !newDisputeForm.description) {
      toast({
        title: 'Informations manquantes',
        description: 'Veuillez remplir tous les champs obligatoires.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    const result = await DisputeService.createDispute({
      contractId,
      paymentId: newDisputeForm.paymentId || undefined,
      milestoneId: newDisputeForm.milestoneId || undefined,
      reason: newDisputeForm.reason as DisputeReason,
      titre: newDisputeForm.titre,
      description: newDisputeForm.description,
      montantConteste: newDisputeForm.montantConteste
        ? parseFloat(newDisputeForm.montantConteste)
        : undefined
    }, userId);

    setSubmitting(false);

    if (result.error) {
      toast({
        title: 'Erreur',
        description: result.error,
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Litige ouvert',
      description: 'Votre litige a été enregistré. TORP va l\'examiner.'
    });

    setShowNewDisputeDialog(false);
    setNewDisputeForm({
      reason: '',
      titre: '',
      description: '',
      montantConteste: '',
      milestoneId: '',
      paymentId: ''
    });
    loadDisputes();
  };

  const handleAddMessage = async () => {
    if (!selectedDispute || !messageForm.message) return;

    setSubmitting(true);

    const result = await DisputeService.addMessage(
      selectedDispute.id,
      messageForm.message,
      userId
    );

    setSubmitting(false);

    if (result.error) {
      toast({
        title: 'Erreur',
        description: result.error,
        variant: 'destructive'
      });
      return;
    }

    toast({ title: 'Message envoyé' });
    setMessageForm({ message: '', files: [] });
    loadDisputes();

    // Mettre à jour le litige sélectionné
    const updated = disputes.find(d => d.id === selectedDispute.id);
    if (updated) {
      setSelectedDispute(updated);
    }
  };

  const handleAddProof = async () => {
    if (!selectedDispute || messageForm.files.length === 0) return;

    setSubmitting(true);

    // Convertir les fichiers en preuves
    for (const file of messageForm.files) {
      const proofType = file.type.startsWith('image/') ? 'photo' :
                        file.type.startsWith('video/') ? 'video' : 'document';

      const proof: Omit<DisputeProof, 'id'> = {
        type: proofType,
        nom: file.name,
        fichier: URL.createObjectURL(file), // En prod: upload vers storage
        dateAjout: new Date(),
        description: messageForm.message
      };

      await DisputeService.addProof(selectedDispute.id, proof, userId);
    }

    setSubmitting(false);

    toast({ title: 'Preuves ajoutées' });
    setMessageForm({ message: '', files: [] });
    setShowAddProofDialog(false);
    loadDisputes();
  };

  const handleAcceptResolution = async (accept: boolean) => {
    if (!selectedDispute) return;

    setSubmitting(true);

    // Pour le médiateur: résoudre le litige
    if (userRole === 'mediator') {
      const result = await DisputeService.resolve(
        selectedDispute.id,
        {
          resolutionType: 'compromise',
          description: messageForm.message || 'Résolution par médiation',
          montant: selectedDispute.montantConteste
        },
        userId
      );

      if (result.error) {
        toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    toast({
      title: accept ? 'Résolution acceptée' : 'Résolution refusée',
      description: accept
        ? 'Le litige est maintenant fermé.'
        : 'Le litige sera escaladé.'
    });
    loadDisputes();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Litiges
              </CardTitle>
              <CardDescription>
                Gestion des litiges et réclamations
              </CardDescription>
            </div>
            {userRole !== 'mediator' && (
              <Button onClick={() => setShowNewDisputeDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ouvrir un litige
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {disputes.filter(d => d.status === 'opened').length}
                </p>
                <p className="text-sm text-muted-foreground">Ouverts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Scale className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {disputes.filter(d => d.status === 'mediation').length}
                </p>
                <p className="text-sm text-muted-foreground">En médiation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {disputes.filter(d => ['resolved_client', 'resolved_enterprise', 'closed'].includes(d.status)).length}
                </p>
                <p className="text-sm text-muted-foreground">Résolus</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Euro className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {disputes.reduce((sum, d) => sum + (d.montantConteste || 0), 0).toLocaleString('fr-FR')}€
                </p>
                <p className="text-sm text-muted-foreground">Contesté</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des litiges */}
      <div className="space-y-4">
        {disputes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Scale className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Aucun litige en cours</p>
              <p className="text-sm text-muted-foreground mt-1">
                Les litiges apparaîtront ici si vous en ouvrez un.
              </p>
            </CardContent>
          </Card>
        ) : (
          disputes.map((dispute) => (
            <Card key={dispute.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      dispute.status === 'opened' ? 'bg-orange-100 dark:bg-orange-900/30' :
                      dispute.status === 'mediation' ? 'bg-purple-100 dark:bg-purple-900/30' :
                      ['resolved_client', 'resolved_enterprise'].includes(dispute.status) ? 'bg-green-100 dark:bg-green-900/30' :
                      'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      {getStatusIcon(dispute.status)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{dispute.titre}</CardTitle>
                        <Badge variant={getStatusVariant(dispute.status)}>
                          {getStatusLabel(dispute.status)}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1">
                        {dispute.reference} • {getReasonLabel(dispute.reason)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    {dispute.montantConteste && (
                      <p className="font-bold text-lg">
                        {dispute.montantConteste.toLocaleString('fr-FR')}€
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {new Date(dispute.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {dispute.description}
                </p>

                {/* Preuves */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {dispute.preuvesDemandeur.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <Upload className="h-3 w-3 mr-1" />
                      {dispute.preuvesDemandeur.length} preuve(s) demandeur
                    </Badge>
                  )}
                  {dispute.preuvesDefendeur.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <Upload className="h-3 w-3 mr-1" />
                      {dispute.preuvesDefendeur.length} preuve(s) défendeur
                    </Badge>
                  )}
                  {dispute.deadlineReponse && (
                    <Badge variant={new Date(dispute.deadlineReponse) < new Date() ? 'destructive' : 'secondary'} className="text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      Réponse avant {new Date(dispute.deadlineReponse).toLocaleDateString('fr-FR')}
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDispute(dispute);
                      setShowDisputeDetailDialog(true);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Voir détails
                  </Button>

                  {['opened', 'under_review', 'mediation'].includes(dispute.status) && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDispute(dispute);
                          setShowAddProofDialog(true);
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Ajouter preuve
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedDispute(dispute);
                          setShowDisputeDetailDialog(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Répondre
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog nouveau litige */}
      <Dialog open={showNewDisputeDialog} onOpenChange={setShowNewDisputeDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ouvrir un litige</DialogTitle>
            <DialogDescription>
              Décrivez votre réclamation. TORP examinera votre demande.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motif du litige *</Label>
              <Select
                value={newDisputeForm.reason}
                onValueChange={(v) => setNewDisputeForm(prev => ({ ...prev, reason: v as DisputeReason }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un motif" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="non_conformity">Non-conformité des travaux</SelectItem>
                  <SelectItem value="delay">Retard de livraison</SelectItem>
                  <SelectItem value="quality">Qualité insuffisante</SelectItem>
                  <SelectItem value="incomplete">Travaux incomplets</SelectItem>
                  <SelectItem value="price_dispute">Contestation de prix</SelectItem>
                  <SelectItem value="communication">Problème de communication</SelectItem>
                  <SelectItem value="damage">Dommages causés</SelectItem>
                  <SelectItem value="abandonment">Abandon de chantier</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                placeholder="Résumé court du problème"
                value={newDisputeForm.titre}
                onChange={(e) => setNewDisputeForm(prev => ({ ...prev, titre: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Description détaillée *</Label>
              <Textarea
                placeholder="Décrivez le problème en détail..."
                value={newDisputeForm.description}
                onChange={(e) => setNewDisputeForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Montant contesté (optionnel)</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  className="pl-9"
                  value={newDisputeForm.montantConteste}
                  onChange={(e) => setNewDisputeForm(prev => ({ ...prev, montantConteste: e.target.value }))}
                />
              </div>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Protection TORP</AlertTitle>
              <AlertDescription>
                Votre litige sera examiné par notre équipe de médiation.
                Les paiements concernés seront automatiquement bloqués.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDisputeDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateDispute} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ouvrir le litige
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog détails litige */}
      <Dialog open={showDisputeDetailDialog} onOpenChange={setShowDisputeDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDispute?.titre}</DialogTitle>
            <DialogDescription>
              {selectedDispute?.reference}
            </DialogDescription>
          </DialogHeader>

          {selectedDispute && (
            <div className="space-y-6">
              {/* Infos principales */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Statut</span>
                  <p className="mt-1">
                    <Badge variant={getStatusVariant(selectedDispute.status)}>
                      {getStatusIcon(selectedDispute.status)}
                      <span className="ml-1">{getStatusLabel(selectedDispute.status)}</span>
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Motif</span>
                  <p className="font-medium mt-1">{getReasonLabel(selectedDispute.reason)}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Montant contesté</span>
                  <p className="font-bold text-lg mt-1">
                    {selectedDispute.montantConteste?.toLocaleString('fr-FR') || '-'}€
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Date d'ouverture</span>
                  <p className="font-medium mt-1">
                    {new Date(selectedDispute.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div>
                <span className="text-sm font-medium">Description</span>
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedDispute.description}
                </p>
              </div>

              {/* Timeline / Historique */}
              <div>
                <span className="text-sm font-medium">Historique</span>
                <div className="mt-3 space-y-3">
                  {selectedDispute.historique.map((event, index) => (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          {getEventIcon(event.type)}
                        </div>
                        {index < selectedDispute.historique.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-3">
                        <p className="text-sm">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(event.date).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zone de message */}
              {['opened', 'under_review', 'mediation'].includes(selectedDispute.status) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label>Ajouter un message</Label>
                    <Textarea
                      placeholder="Votre message..."
                      value={messageForm.message}
                      onChange={(e) => setMessageForm(prev => ({ ...prev, message: e.target.value }))}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddProofDialog(true);
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Ajouter preuve
                      </Button>
                      <Button onClick={handleAddMessage} disabled={!messageForm.message || submitting}>
                        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Send className="h-4 w-4 mr-2" />
                        Envoyer
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Boutons de résolution (médiateur) */}
              {userRole === 'mediator' && selectedDispute.status === 'mediation' && (
                <>
                  <Separator />
                  <div className="flex gap-3">
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => handleAcceptResolution(true)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Résoudre en faveur du client
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => handleAcceptResolution(true)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Résoudre en faveur de l'entreprise
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisputeDetailDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ajout preuve */}
      <Dialog open={showAddProofDialog} onOpenChange={setShowAddProofDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter des preuves</DialogTitle>
            <DialogDescription>
              Photos, documents, vidéos pour appuyer votre réclamation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6">
              <input
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    setMessageForm(prev => ({
                      ...prev,
                      files: [...prev.files, ...Array.from(files)]
                    }));
                  }
                }}
                className="hidden"
                id="proof-upload-dispute"
              />
              <label
                htmlFor="proof-upload-dispute"
                className="flex flex-col items-center cursor-pointer"
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Cliquez ou glissez vos fichiers ici
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  Images, vidéos, PDF, documents
                </span>
              </label>
            </div>

            {messageForm.files.length > 0 && (
              <div className="space-y-2">
                {messageForm.files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      {file.type.startsWith('image/') ? (
                        <Image className="h-4 w-4" />
                      ) : file.type.startsWith('video/') ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMessageForm(prev => ({
                          ...prev,
                          files: prev.files.filter((_, i) => i !== index)
                        }));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Description (optionnel)</Label>
              <Textarea
                placeholder="Décrivez ce que montrent ces preuves..."
                value={messageForm.message}
                onChange={(e) => setMessageForm(prev => ({ ...prev, message: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProofDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddProof} disabled={messageForm.files.length === 0 || submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter les preuves
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
