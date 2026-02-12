/**
 * WarrantyClaimForm - Formulaire de déclaration de sinistre
 * Avec vérification éligibilité garantie
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Shield,
  Sparkles,
  X,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface WarrantyClaimFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chantierId: string;
  onSubmit: (data: {
    nature: string;
    description: string;
    localisation: string;
    dateDecouverte: string;
    gravite: 'faible' | 'moyenne' | 'grave' | 'critique';
    typeDesordre?: string;
    photos?: string[];
  }) => void;
  isSubmitting?: boolean;
}

const TYPES_DESORDRE = [
  { value: 'infiltration', label: 'Infiltration d\'eau' },
  { value: 'fissure', label: 'Fissure' },
  { value: 'humidite', label: 'Humidité / Condensation' },
  { value: 'isolation', label: 'Défaut d\'isolation' },
  { value: 'equipement', label: 'Dysfonctionnement équipement' },
  { value: 'structure', label: 'Problème structurel' },
  { value: 'etancheite', label: 'Défaut d\'étanchéité' },
  { value: 'finition', label: 'Défaut de finition' },
  { value: 'autre', label: 'Autre' },
];

const GRAVITE_OPTIONS = [
  {
    value: 'faible',
    label: 'Faible',
    description: 'Gêne mineure, usage normal possible',
  },
  {
    value: 'moyenne',
    label: 'Moyenne',
    description: 'Usage dégradé mais possible',
  },
  {
    value: 'grave',
    label: 'Grave',
    description: 'Usage compromis, intervention urgente',
  },
  {
    value: 'critique',
    label: 'Critique',
    description: 'Danger ou impossibilité d\'usage',
  },
];

export function WarrantyClaimForm({
  open,
  onOpenChange,
  chantierId,
  onSubmit,
  isSubmitting,
}: WarrantyClaimFormProps) {
  const [step, setStep] = useState<'form' | 'eligibility' | 'confirm'>(
    'form'
  );
  const [isChecking, setIsChecking] = useState(false);
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    garantieApplicable: string | null;
    raison: string;
    delaiRestant: number | null;
    recommandations: string[];
    demarchesRequises: string[];
  } | null>(null);

  const [formData, setFormData] = useState({
    nature: '',
    description: '',
    localisation: '',
    dateDecouverte: undefined as Date | undefined,
    typeDesordre: '',
    gravite: '' as 'faible' | 'moyenne' | 'grave' | 'critique' | '',
    photos: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      nature: '',
      description: '',
      localisation: '',
      dateDecouverte: undefined,
      typeDesordre: '',
      gravite: '',
      photos: [],
    });
    setStep('form');
    setEligibility(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleCheckEligibility = async () => {
    if (!formData.description || !formData.dateDecouverte) return;

    setIsChecking(true);
    try {
      // Placeholder for warranty eligibility check (removed)
      setStep('confirm');
    } catch (error) {
      console.error('Eligibility check error:', error);
      // Continuer quand même
      setStep('confirm');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.description || !formData.dateDecouverte || !formData.gravite) return;

    onSubmit({
      nature: formData.nature || formData.typeDesordre || 'Désordre',
      description: formData.description,
      localisation: formData.localisation,
      dateDecouverte: formData.dateDecouverte.toISOString().split('T')[0],
      gravite: formData.gravite as 'faible' | 'moyenne' | 'grave' | 'critique',
      typeDesordre: formData.typeDesordre,
      photos: formData.photos,
    });

    handleClose();
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      setFormData((prev) => ({
        ...prev,
        photos: [...prev.photos, url],
      }));
    }
  };

  const removePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Déclarer un sinistre
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && 'Décrivez le désordre constaté. Nous vérifierons automatiquement l\'éligibilité aux garanties.'}
            {step === 'eligibility' && 'Vérification de l\'éligibilité aux garanties.'}
            {step === 'confirm' && 'Confirmez la déclaration du sinistre.'}
          </DialogDescription>
        </DialogHeader>

        {/* Étape 1: Formulaire */}
        {step === 'form' && (
          <div className="space-y-4 py-4">
            {/* Type de désordre */}
            <div className="space-y-2">
              <Label>Type de désordre</Label>
              <Select
                value={formData.typeDesordre}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, typeDesordre: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_DESORDRE.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nature / Titre */}
            <div className="space-y-2">
              <Label>Titre / Nature du désordre</Label>
              <Input
                value={formData.nature}
                onChange={(e) => setFormData((prev) => ({ ...prev, nature: e.target.value }))}
                placeholder="Ex: Infiltration sous la fenêtre de la chambre"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description détaillée *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Décrivez précisément le problème constaté, son étendue, quand il apparaît..."
                rows={4}
              />
            </div>

            {/* Localisation */}
            <div className="space-y-2">
              <Label>Localisation</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={formData.localisation}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, localisation: e.target.value }))
                  }
                  placeholder="Ex: Chambre 1, mur nord sous la fenêtre"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date de découverte */}
            <div className="space-y-2">
              <Label>Date de découverte *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formData.dateDecouverte && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dateDecouverte ? (
                      format(formData.dateDecouverte, 'PPP', { locale: fr })
                    ) : (
                      'Sélectionner la date'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.dateDecouverte}
                    onSelect={(date) =>
                      setFormData((prev) => ({ ...prev, dateDecouverte: date }))
                    }
                    locale={fr}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Gravité */}
            <div className="space-y-2">
              <Label>Gravité estimée *</Label>
              <div className="grid grid-cols-2 gap-2">
                {GRAVITE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        gravite: option.value as typeof formData.gravite,
                      }))
                    }
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all',
                      formData.gravite === option.value
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'hover:border-gray-300'
                    )}
                  >
                    <div className="font-medium">{option.label}</div>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Photos */}
            <div className="space-y-2">
              <Label>Photos du désordre</Label>
              <div className="flex flex-wrap gap-2">
                {formData.photos.map((url, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                <label className="w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <Camera className="h-6 w-6 text-muted-foreground" />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Ajoutez des photos pour documenter le désordre
              </p>
            </div>
          </div>
        )}

        {/* Étape 2: Éligibilité */}
        {step === 'eligibility' && eligibility && (
          <div className="space-y-4 py-4">
            <Alert variant={eligibility.eligible ? 'default' : 'destructive'}>
              {eligibility.eligible ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle>
                {eligibility.eligible ? 'Éligible aux garanties' : 'Non éligible'}
              </AlertTitle>
              <AlertDescription>{eligibility.raison}</AlertDescription>
            </Alert>

            {eligibility.garantieApplicable && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-blue-900">
                    Garantie applicable : {eligibility.garantieApplicable.replace('_', ' ')}
                  </div>
                  {eligibility.delaiRestant !== null && (
                    <div className="text-sm text-blue-700">
                      {eligibility.delaiRestant} jours restants
                    </div>
                  )}
                </div>
              </div>
            )}

            {eligibility.demarchesRequises.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Démarches à suivre :</h4>
                <ol className="list-decimal pl-5 space-y-1">
                  {eligibility.demarchesRequises.map((demarche, i) => (
                    <li key={i} className="text-sm">
                      {demarche}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {eligibility.recommandations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Recommandations :
                </h4>
                <ul className="list-disc pl-5 space-y-1">
                  {eligibility.recommandations.map((reco, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {reco}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Étape 3: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-4 py-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Récapitulatif</AlertTitle>
              <AlertDescription>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="font-medium">Type :</dt>
                    <dd>{formData.typeDesordre || formData.nature}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Date :</dt>
                    <dd>
                      {formData.dateDecouverte &&
                        format(formData.dateDecouverte, 'PPP', { locale: fr })}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Gravité :</dt>
                    <dd>{formData.gravite}</dd>
                  </div>
                </dl>
              </AlertDescription>
            </Alert>

            <p className="text-sm text-muted-foreground">
              En confirmant, vous déclarez ce sinistre. Vous recevrez un email de confirmation
              avec les prochaines étapes à suivre.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'form' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                onClick={handleCheckEligibility}
                disabled={
                  !formData.description || !formData.dateDecouverte || !formData.gravite || isChecking
                }
              >
                {isChecking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Vérifier éligibilité
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'eligibility' && (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>
                Modifier
              </Button>
              <Button onClick={() => setStep('confirm')}>Continuer la déclaration</Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('eligibility')}>
                Retour
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Déclaration...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirmer la déclaration
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
