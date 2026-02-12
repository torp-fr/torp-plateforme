/**
 * ReserveForm - Formulaire de création/édition de réserve
 * Avec support photos et classification IA
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Camera,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  MapPin,
  Building2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useReserves } from '@/hooks/phase4/useReserves';
import { cn } from '@/lib/utils';
import type { Reserve, ReserveGravite } from '@/types/phase4.types';

interface ReserveFormProps {
  chantierId: string;
  oprSessionId?: string;
  reserves?: Reserve[];
  disabled?: boolean;
  onReserveCreated?: (reserve: Reserve) => void;
}

const LOTS = [
  { code: 'GO', nom: 'Gros oeuvre' },
  { code: 'CHARP', nom: 'Charpente' },
  { code: 'COUV', nom: 'Couverture' },
  { code: 'MENU_EXT', nom: 'Menuiseries extérieures' },
  { code: 'MENU_INT', nom: 'Menuiseries intérieures' },
  { code: 'PLOMB', nom: 'Plomberie' },
  { code: 'ELEC', nom: 'Électricité' },
  { code: 'CHAUF', nom: 'Chauffage / Climatisation' },
  { code: 'PLAT', nom: 'Plâtrerie' },
  { code: 'CARREL', nom: 'Carrelage' },
  { code: 'PEINT', nom: 'Peinture' },
  { code: 'REV_SOL', nom: 'Revêtements de sol' },
  { code: 'VRD', nom: 'VRD / Extérieurs' },
];

const GRAVITE_CONFIG: Record<ReserveGravite, { label: string; color: string; description: string }> = {
  mineure: {
    label: 'Mineure',
    color: 'bg-blue-100 text-blue-700',
    description: 'Esthétique, n\'empêche pas l\'usage',
  },
  majeure: {
    label: 'Majeure',
    color: 'bg-orange-100 text-orange-700',
    description: 'Fonctionnel mais non bloquant',
  },
  grave: {
    label: 'Grave',
    color: 'bg-red-100 text-red-700',
    description: 'Usage compromis',
  },
  non_conformite_substantielle: {
    label: 'Bloquante',
    color: 'bg-red-500 text-white',
    description: 'Empêche la réception',
  },
};

export function ReserveForm({
  chantierId,
  oprSessionId,
  reserves = [],
  disabled,
  onReserveCreated,
}: ReserveFormProps) {
  const { createReserve, updateStatus, relanceEntreprise, stats, isCreating, isRelancing } =
    useReserves({ chantierId, oprSessionId });

  const [showForm, setShowForm] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [formData, setFormData] = useState({
    nature: '',
    description: '',
    localisation: '',
    piece: '',
    lot: '',
    entrepriseId: '',
    entrepriseNom: '',
    gravite: '' as ReserveGravite | '',
    photos: [] as string[],
    coutEstime: '',
  });
  const [aiSuggestion, setAiSuggestion] = useState<{
    gravite: ReserveGravite;
    delai: number;
    justification: string;
  } | null>(null);

  const resetForm = () => {
    setFormData({
      nature: '',
      description: '',
      localisation: '',
      piece: '',
      lot: '',
      entrepriseId: '',
      entrepriseNom: '',
      gravite: '',
      photos: [],
      coutEstime: '',
    });
    setAiSuggestion(null);
  };

  const handleClassifyWithAI = async () => {
    if (!formData.description) return;

    setIsClassifying(true);
    try {
      // Placeholder for AI reserve classification (removed)
    } catch (error) {
      console.error('AI classification error:', error);
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.description || !formData.localisation || !formData.gravite) return;

    createReserve({
      lot: formData.lot,
      piece: formData.piece,
      localisation: formData.localisation,
      nature: formData.nature || 'Réserve',
      description: formData.description,
      gravite: formData.gravite as ReserveGravite,
      entrepriseId: formData.entrepriseId,
      entrepriseNom: formData.entrepriseNom,
      photos: formData.photos,
      coutEstime: formData.coutEstime ? parseFloat(formData.coutEstime) : undefined,
      oprSessionId,
    });

    setShowForm(false);
    resetForm();
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Simuler upload - en production utiliser Supabase Storage
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
    <div className="space-y-4">
      {/* Stats rapides */}
      <div className="grid grid-cols-5 gap-3">
        <div className="p-3 bg-muted rounded-lg text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.ouvertes}</div>
          <div className="text-xs text-muted-foreground">Ouvertes</div>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.enCours}</div>
          <div className="text-xs text-muted-foreground">En cours</div>
        </div>
        <div className="p-3 bg-red-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600">{stats.bloquantes}</div>
          <div className="text-xs text-muted-foreground">Bloquantes</div>
        </div>
        <div className="p-3 bg-green-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{stats.levees}</div>
          <div className="text-xs text-muted-foreground">Levées</div>
        </div>
      </div>

      {/* Bouton nouvelle réserve */}
      {!disabled && !showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une réserve
        </Button>
      )}

      {/* Formulaire */}
      {showForm && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Nouvelle réserve
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nature et description */}
            <div className="space-y-2">
              <Label>Nature du défaut</Label>
              <Input
                value={formData.nature}
                onChange={(e) => setFormData((prev) => ({ ...prev, nature: e.target.value }))}
                placeholder="Ex: Fissure, Infiltration, Défaut de finition..."
              />
            </div>

            <div className="space-y-2">
              <Label>Description détaillée *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Décrivez précisément le défaut constaté..."
                rows={3}
              />
            </div>

            {/* Localisation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lot concerné</Label>
                <Select
                  value={formData.lot}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, lot: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un lot" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOTS.map((lot) => (
                      <SelectItem key={lot.code} value={lot.code}>
                        {lot.code} - {lot.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pièce</Label>
                <Input
                  value={formData.piece}
                  onChange={(e) => setFormData((prev) => ({ ...prev, piece: e.target.value }))}
                  placeholder="Ex: Chambre 1, SDB..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Localisation précise *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={formData.localisation}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, localisation: e.target.value }))
                  }
                  placeholder="Ex: Mur nord, sous la fenêtre"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Entreprise */}
            <div className="space-y-2">
              <Label>Entreprise responsable</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={formData.entrepriseNom}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, entrepriseNom: e.target.value }))
                  }
                  placeholder="Nom de l'entreprise"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Classification IA */}
            {formData.description && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Classification IA</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClassifyWithAI}
                    disabled={isClassifying}
                  >
                    {isClassifying ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyse...
                      </>
                    ) : (
                      'Analyser'
                    )}
                  </Button>
                </div>

                {aiSuggestion && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Gravité suggérée :</span>
                      <Badge className={GRAVITE_CONFIG[aiSuggestion.gravite].color}>
                        {GRAVITE_CONFIG[aiSuggestion.gravite].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Délai recommandé : {aiSuggestion.delai} jours</span>
                    </div>
                    <p className="text-muted-foreground italic">{aiSuggestion.justification}</p>
                  </div>
                )}
              </div>
            )}

            {/* Gravité */}
            <div className="space-y-2">
              <Label>Gravité *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(GRAVITE_CONFIG) as [ReserveGravite, typeof GRAVITE_CONFIG[ReserveGravite]][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, gravite: key }))}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        formData.gravite === key
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={config.color}>{config.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Photos */}
            <div className="space-y-2">
              <Label>Photos</Label>
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
            </div>

            {/* Coût estimé */}
            <div className="space-y-2">
              <Label>Coût estimé (optionnel)</Label>
              <Input
                type="number"
                value={formData.coutEstime}
                onChange={(e) => setFormData((prev) => ({ ...prev, coutEstime: e.target.value }))}
                placeholder="0.00"
                className="w-32"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.description || !formData.localisation || !formData.gravite || isCreating}
                className="flex-1"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des réserves existantes */}
      <div className="space-y-2">
        {reserves.map((reserve) => (
          <div
            key={reserve.id}
            className={cn(
              'flex items-start gap-3 p-3 border rounded-lg',
              reserve.statut === 'levee' && 'bg-green-50 border-green-200'
            )}
          >
            <Badge className={GRAVITE_CONFIG[reserve.gravite].color}>
              {GRAVITE_CONFIG[reserve.gravite].label}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="font-medium">
                #{reserve.numero} - {reserve.nature || reserve.description.slice(0, 50)}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {reserve.lot && `${reserve.lot} - `}
                {reserve.localisation}
              </div>
              {reserve.entrepriseNom && (
                <div className="text-sm text-muted-foreground">{reserve.entrepriseNom}</div>
              )}
              {reserve.dateEcheance && reserve.statut !== 'levee' && (
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  Échéance : {new Date(reserve.dateEcheance).toLocaleDateString('fr-FR')}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge
                variant={
                  reserve.statut === 'levee'
                    ? 'default'
                    : reserve.statut === 'contestee'
                    ? 'destructive'
                    : 'outline'
                }
              >
                {reserve.statut}
              </Badge>
              {reserve.statut === 'ouverte' && !disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => relanceEntreprise(reserve.id)}
                  disabled={isRelancing}
                >
                  Relancer
                </Button>
              )}
            </div>
          </div>
        ))}

        {reserves.length === 0 && !showForm && (
          <p className="text-center text-muted-foreground py-4">Aucune réserve enregistrée</p>
        )}
      </div>
    </div>
  );
}
