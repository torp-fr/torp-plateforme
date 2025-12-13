/**
 * MilestoneTracker - Suivi et validation des jalons de paiement
 * Interface complète pour la gestion des jalons avec anti-fraude
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { MilestoneService } from '@/services/payment/milestone.service';
import type { PaymentMilestone, MilestoneProof, MilestoneStatus, FraudRiskLevel } from '@/types/payment.types';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Upload,
  Camera,
  FileText,
  Euro,
  Calendar,
  MapPin,
  Shield,
  Eye,
  Send,
  X,
  ChevronRight,
  AlertCircle,
  XCircle,
  Loader2,
  Image,
  File,
  Receipt,
  ClipboardCheck
} from 'lucide-react';

interface MilestoneTrackerProps {
  contractId: string;
  userRole: 'client' | 'enterprise';
  userId: string;
}

export function MilestoneTracker({ contractId, userRole, userId }: MilestoneTrackerProps) {
  const { toast } = useToast();
  const [milestones, setMilestones] = useState<PaymentMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState<PaymentMilestone | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showValidateDialog, setShowValidateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Formulaire de soumission
  const [submitForm, setSubmitForm] = useState({
    compteRendu: '',
    preuves: [] as File[]
  });

  // Formulaire de validation
  const [validateForm, setValidateForm] = useState({
    approved: true,
    commentaire: '',
    rejectionReason: ''
  });

  useEffect(() => {
    loadMilestones();
  }, [contractId]);

  const loadMilestones = async () => {
    setLoading(true);
    const result = await MilestoneService.getMilestonesByContract(contractId);
    if (result.milestones) {
      setMilestones(result.milestones);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: MilestoneStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'validated': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'submitted': return <Clock className="h-5 w-5 text-blue-600" />;
      case 'in_progress': return <Loader2 className="h-5 w-5 text-orange-600 animate-spin" />;
      case 'rejected': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: MilestoneStatus) => {
    const labels: Record<MilestoneStatus, string> = {
      pending: 'En attente',
      in_progress: 'En cours',
      submitted: 'Soumis',
      validated: 'Validé',
      rejected: 'Rejeté',
      completed: 'Complété'
    };
    return labels[status] || status;
  };

  const getStatusVariant = (status: MilestoneStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
      case 'validated': return 'default';
      case 'submitted':
      case 'in_progress': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const getRiskLevelColor = (level: FraudRiskLevel) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50';
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSubmitForm(prev => ({
        ...prev,
        preuves: [...prev.preuves, ...Array.from(files)]
      }));
    }
  };

  const removeFile = (index: number) => {
    setSubmitForm(prev => ({
      ...prev,
      preuves: prev.preuves.filter((_, i) => i !== index)
    }));
  };

  const handleSubmitMilestone = async () => {
    if (!selectedMilestone) return;

    setSubmitting(true);

    // Convertir les fichiers en preuves
    const preuves: Omit<MilestoneProof, 'id' | 'verifie'>[] = submitForm.preuves.map(file => ({
      type: file.type.startsWith('image/') ? 'photo' : 'document',
      nom: file.name,
      fichier: URL.createObjectURL(file), // En prod: upload vers storage
      dateAjout: new Date(),
      metadata: {}
    }));

    const result = await MilestoneService.submitMilestone(selectedMilestone.id, {
      preuves,
      compteRendu: submitForm.compteRendu
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
      title: 'Jalon soumis',
      description: 'Votre demande a été envoyée au client pour validation.'
    });

    setShowSubmitDialog(false);
    setSubmitForm({ compteRendu: '', preuves: [] });
    loadMilestones();
  };

  const handleValidateMilestone = async () => {
    if (!selectedMilestone) return;

    setSubmitting(true);

    const result = await MilestoneService.validateMilestone(selectedMilestone.id, {
      milestoneId: selectedMilestone.id,
      approved: validateForm.approved,
      rejectionReason: validateForm.approved ? undefined : validateForm.rejectionReason,
      commentaire: validateForm.commentaire
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
      title: validateForm.approved ? 'Jalon validé' : 'Jalon rejeté',
      description: validateForm.approved
        ? 'Le paiement sera traité automatiquement.'
        : 'L\'entreprise a été notifiée du rejet.'
    });

    setShowValidateDialog(false);
    setValidateForm({ approved: true, commentaire: '', rejectionReason: '' });
    loadMilestones();
  };

  // Calculs
  const totalMontant = milestones.reduce((sum, m) => sum + m.montantTTC, 0);
  const montantPaye = milestones
    .filter(m => m.status === 'completed')
    .reduce((sum, m) => sum + m.montantTTC, 0);
  const progressPct = totalMontant > 0 ? (montantPaye / totalMontant) * 100 : 0;

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
      {/* Vue d'ensemble */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Jalons de Paiement
          </CardTitle>
          <CardDescription>
            Suivi de l'avancement et des paiements du projet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{milestones.length}</div>
              <div className="text-sm text-muted-foreground">Jalons</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {montantPaye.toLocaleString('fr-FR')}€
              </div>
              <div className="text-sm text-muted-foreground">Payé</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {(totalMontant - montantPaye).toLocaleString('fr-FR')}€
              </div>
              <div className="text-sm text-muted-foreground">Restant</div>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {totalMontant.toLocaleString('fr-FR')}€
              </div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progression des paiements</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Liste des jalons */}
      <div className="space-y-4">
        {milestones.map((milestone, index) => (
          <Card key={milestone.id} className="overflow-hidden">
            <div className="flex">
              {/* Timeline connector */}
              <div className="w-16 flex flex-col items-center py-4 bg-muted/30">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  milestone.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                  milestone.status === 'submitted' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  milestone.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-gray-100 dark:bg-gray-800'
                }`}>
                  {getStatusIcon(milestone.status)}
                </div>
                {index < milestones.length - 1 && (
                  <div className={`w-0.5 flex-1 mt-2 ${
                    milestone.status === 'completed' ? 'bg-green-300' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        Jalon {milestone.numero}
                      </span>
                      <Badge variant={getStatusVariant(milestone.status)}>
                        {getStatusLabel(milestone.status)}
                      </Badge>
                      {milestone.fraudRiskLevel !== 'low' && (
                        <Badge className={getRiskLevelColor(milestone.fraudRiskLevel)}>
                          <Shield className="h-3 w-3 mr-1" />
                          Risque {milestone.fraudRiskLevel}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg">{milestone.designation}</h3>
                    {milestone.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {milestone.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      {milestone.montantTTC.toLocaleString('fr-FR')}€
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {milestone.pourcentageContrat}% du contrat
                    </div>
                  </div>
                </div>

                {/* Dates et conditions */}
                <div className="flex flex-wrap gap-4 text-sm mb-3">
                  {milestone.datePrevue && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Prévu: {new Date(milestone.datePrevue).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  {milestone.dateSoumission && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Send className="h-4 w-4" />
                      Soumis: {new Date(milestone.dateSoumission).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  {milestone.dateValidation && (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Validé: {new Date(milestone.dateValidation).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>

                {/* Conditions et livrables */}
                {milestone.conditionsDeclenchement.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Conditions requises:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {milestone.conditionsDeclenchement.map((cond, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {cond}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preuves fournies */}
                {milestone.preuves.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Preuves ({milestone.preuves.length}):
                    </span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {milestone.preuves.map((preuve) => (
                        <Button
                          key={preuve.id}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                        >
                          {preuve.type === 'photo' ? (
                            <Image className="h-3 w-3 mr-1" />
                          ) : preuve.type === 'bon_commande' ? (
                            <Receipt className="h-3 w-3 mr-1" />
                          ) : (
                            <File className="h-3 w-3 mr-1" />
                          )}
                          {preuve.nom}
                          {preuve.verifie && (
                            <CheckCircle className="h-3 w-3 ml-1 text-green-600" />
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alerte anti-fraude */}
                {milestone.verificationAuto?.alertes?.length > 0 && (
                  <Alert variant="destructive" className="mb-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Alertes de vérification</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside text-sm">
                        {milestone.verificationAuto.alertes.map((alerte, i) => (
                          <li key={i}>{alerte}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Motif de rejet */}
                {milestone.status === 'rejected' && milestone.rejectionReason && (
                  <Alert variant="destructive" className="mb-3">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Motif du rejet</AlertTitle>
                    <AlertDescription>
                      {milestone.rejectionReason}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t">
                  {userRole === 'enterprise' && ['pending', 'in_progress', 'rejected'].includes(milestone.status) && (
                    <Button
                      onClick={() => {
                        setSelectedMilestone(milestone);
                        setShowSubmitDialog(true);
                      }}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Soumettre pour validation
                    </Button>
                  )}

                  {userRole === 'client' && milestone.status === 'submitted' && (
                    <Button
                      onClick={() => {
                        setSelectedMilestone(milestone);
                        setShowValidateDialog(true);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Valider le jalon
                    </Button>
                  )}

                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    Détails
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Dialog de soumission (Entreprise) */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Soumettre le jalon pour validation</DialogTitle>
            <DialogDescription>
              {selectedMilestone?.designation} - {selectedMilestone?.montantTTC.toLocaleString('fr-FR')}€
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Upload de preuves */}
            <div className="space-y-2">
              <Label>Pièces justificatives</Label>
              <div className="border-2 border-dashed rounded-lg p-4">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="proof-upload"
                />
                <label
                  htmlFor="proof-upload"
                  className="flex flex-col items-center cursor-pointer"
                >
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Photos, bons de commande, factures, PV...
                  </span>
                </label>
              </div>

              {submitForm.preuves.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {submitForm.preuves.map((file, index) => (
                    <Badge key={index} variant="secondary" className="pr-1">
                      {file.name}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-1"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Compte-rendu */}
            <div className="space-y-2">
              <Label>Compte-rendu des travaux</Label>
              <Textarea
                placeholder="Décrivez les travaux réalisés pour ce jalon..."
                value={submitForm.compteRendu}
                onChange={(e) => setSubmitForm(prev => ({ ...prev, compteRendu: e.target.value }))}
                rows={4}
              />
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Vérification automatique</AlertTitle>
              <AlertDescription>
                TORP vérifiera automatiquement la cohérence de votre demande avec
                les conditions du jalon et les preuves fournies.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmitMilestone} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de validation (Client) */}
      <Dialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Validation du jalon</DialogTitle>
            <DialogDescription>
              {selectedMilestone?.designation} - {selectedMilestone?.montantTTC.toLocaleString('fr-FR')}€
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preuves à vérifier */}
            {selectedMilestone?.preuves && selectedMilestone.preuves.length > 0 && (
              <div className="space-y-2">
                <Label>Pièces justificatives fournies</Label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedMilestone.preuves.map((preuve) => (
                    <Button
                      key={preuve.id}
                      variant="outline"
                      className="justify-start h-auto py-2"
                    >
                      {preuve.type === 'photo' ? (
                        <Image className="h-4 w-4 mr-2" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      <div className="text-left">
                        <div className="text-sm">{preuve.nom}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(preuve.dateAjout).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Compte-rendu */}
            {selectedMilestone?.compteRendu && (
              <div className="space-y-2">
                <Label>Compte-rendu de l'entreprise</Label>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  {selectedMilestone.compteRendu}
                </div>
              </div>
            )}

            {/* Score de vérification */}
            {selectedMilestone?.verificationAuto && (
              <Alert className={selectedMilestone.verificationAuto.score >= 80 ? '' : 'border-orange-200'}>
                <Shield className="h-4 w-4" />
                <AlertTitle>Vérification TORP: {selectedMilestone.verificationAuto.score}/100</AlertTitle>
                <AlertDescription>
                  {selectedMilestone.verificationAuto.score >= 80
                    ? 'Les vérifications automatiques sont satisfaisantes.'
                    : 'Certains points nécessitent votre attention.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Choix validation/rejet */}
            <div className="space-y-3">
              <Label>Votre décision</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={validateForm.approved ? 'default' : 'outline'}
                  className="h-auto py-3"
                  onClick={() => setValidateForm(prev => ({ ...prev, approved: true }))}
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <div className="text-left">
                    <div>Valider</div>
                    <div className="text-xs opacity-70">Le paiement sera déclenché</div>
                  </div>
                </Button>
                <Button
                  variant={!validateForm.approved ? 'destructive' : 'outline'}
                  className="h-auto py-3"
                  onClick={() => setValidateForm(prev => ({ ...prev, approved: false }))}
                >
                  <XCircle className="h-5 w-5 mr-2" />
                  <div className="text-left">
                    <div>Rejeter</div>
                    <div className="text-xs opacity-70">Demander des corrections</div>
                  </div>
                </Button>
              </div>
            </div>

            {/* Motif de rejet */}
            {!validateForm.approved && (
              <div className="space-y-2">
                <Label>Motif du rejet *</Label>
                <Textarea
                  placeholder="Expliquez pourquoi vous rejetez ce jalon..."
                  value={validateForm.rejectionReason}
                  onChange={(e) => setValidateForm(prev => ({ ...prev, rejectionReason: e.target.value }))}
                  rows={3}
                />
              </div>
            )}

            {/* Commentaire */}
            <div className="space-y-2">
              <Label>Commentaire (optionnel)</Label>
              <Textarea
                placeholder="Ajouter un commentaire..."
                value={validateForm.commentaire}
                onChange={(e) => setValidateForm(prev => ({ ...prev, commentaire: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidateDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleValidateMilestone}
              disabled={submitting || (!validateForm.approved && !validateForm.rejectionReason)}
              variant={validateForm.approved ? 'default' : 'destructive'}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {validateForm.approved ? 'Valider et payer' : 'Rejeter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
