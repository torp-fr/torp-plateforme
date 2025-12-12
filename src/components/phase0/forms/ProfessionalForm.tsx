/**
 * Formulaire B2B professionnel Phase 0
 * Formulaire simplifié pour les professionnels qui connaissent leurs besoins
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, MapPin, Hammer, Euro, Calendar, FileText, Users,
  Upload, Check, Loader2, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { LOT_CATALOG, LotType, LotCategory, LotDefinition } from '@/types/phase0/lots.types';
import { WorkType } from '@/types/phase0/work-project.types';
import { PropertyType } from '@/types/phase0/property.types';
import { Phase0ProjectService } from '@/services/phase0/project.service';
import { EstimationService } from '@/services/phase0/estimation.service';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Schéma de validation Zod
const professionalFormSchema = z.object({
  // Entreprise
  companyName: z.string().min(2, 'Raison sociale requise'),
  siret: z.string().regex(/^\d{14}$/, 'SIRET invalide (14 chiffres)').optional().or(z.literal('')),
  contactName: z.string().min(2, 'Nom du contact requis'),
  contactRole: z.string().optional(),
  email: z.string().email('Email invalide'),
  phone: z.string().min(10, 'Téléphone requis'),

  // Bien
  propertyType: z.string().min(1, 'Type de bien requis'),
  address: z.string().min(5, 'Adresse requise'),
  postalCode: z.string().regex(/^\d{5}$/, 'Code postal invalide'),
  city: z.string().min(2, 'Ville requise'),
  livingArea: z.number().min(1, 'Surface requise'),
  yearBuilt: z.number().min(1800).max(new Date().getFullYear()).optional(),

  // Projet
  projectTitle: z.string().min(5, 'Titre requis (min 5 caractères)'),
  projectDescription: z.string().optional(),
  workType: z.string().min(1, 'Type de travaux requis'),
  selectedLots: z.array(z.string()).min(1, 'Sélectionnez au moins un lot'),

  // Budget et planning
  budgetMin: z.number().min(1, 'Budget minimum requis'),
  budgetMax: z.number().min(1, 'Budget maximum requis'),
  desiredStartDate: z.string().optional(),
  maxDurationMonths: z.number().optional(),
  finishLevel: z.string().default('standard'),

  // Documents
  hasPlans: z.boolean().default(false),
  hasDiagnostics: z.boolean().default(false),
  hasSpecifications: z.boolean().default(false),

  // Acceptations
  acceptTerms: z.boolean().refine(val => val === true, 'Vous devez accepter les conditions'),
});

type ProfessionalFormData = z.infer<typeof professionalFormSchema>;

const PROPERTY_TYPES: Array<{ value: PropertyType; label: string }> = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'building', label: 'Immeuble' },
  { value: 'commercial', label: 'Local commercial' },
  { value: 'office', label: 'Bureau' },
  { value: 'warehouse', label: 'Entrepôt' },
  { value: 'land', label: 'Terrain' },
];

const WORK_TYPES: Array<{ value: WorkType; label: string }> = [
  { value: 'new_construction', label: 'Construction neuve' },
  { value: 'extension', label: 'Extension' },
  { value: 'renovation', label: 'Rénovation' },
  { value: 'refurbishment', label: 'Réhabilitation' },
  { value: 'improvement', label: 'Amélioration' },
  { value: 'maintenance', label: 'Entretien' },
];

const CATEGORY_LABELS: Record<LotCategory, string> = {
  gros_oeuvre: 'Gros œuvre',
  second_oeuvre: 'Second œuvre',
  technique: 'Lots techniques',
  finitions: 'Finitions',
  exterieur: 'Extérieur',
  specifique: 'Spécifique',
};

interface ProfessionalFormProps {
  onSuccess?: (projectId: string) => void;
  className?: string;
}

export function ProfessionalForm({ onSuccess, className }: ProfessionalFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<LotCategory>>(new Set());
  const [activeTab, setActiveTab] = useState('company');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<ProfessionalFormData>({
    resolver: zodResolver(professionalFormSchema),
    defaultValues: {
      selectedLots: [],
      finishLevel: 'standard',
      hasPlans: false,
      hasDiagnostics: false,
      hasSpecifications: false,
      acceptTerms: false,
    },
    mode: 'onChange',
  });

  const selectedLots = watch('selectedLots') || [];
  const budgetMin = watch('budgetMin');
  const budgetMax = watch('budgetMax');
  const livingArea = watch('livingArea');

  // Grouper les lots par catégorie
  const lotsByCategory = useMemo(() => {
    const grouped: Record<LotCategory, LotDefinition[]> = {
      gros_oeuvre: [],
      second_oeuvre: [],
      technique: [],
      finitions: [],
      exterieur: [],
      specifique: [],
    };

    LOT_CATALOG.forEach((lot) => {
      grouped[lot.category].push(lot);
    });

    return grouped;
  }, []);

  // Toggle catégorie
  const toggleCategory = (category: LotCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Toggle lot
  const toggleLot = (lotType: string) => {
    const current = selectedLots;
    const updated = current.includes(lotType)
      ? current.filter((l) => l !== lotType)
      : [...current, lotType];
    setValue('selectedLots', updated, { shouldValidate: true });
  };

  // Estimation rapide
  const quickEstimate = useMemo(() => {
    if (selectedLots.length === 0 || !livingArea) return null;

    const mockProject = {
      property: {
        characteristics: { livingArea },
      },
      selectedLots: selectedLots.map(type => {
        const lot = LOT_CATALOG.find(l => l.type === type);
        return {
          id: type,
          projectId: '',
          type: type as LotType,
          number: lot?.number || '',
          category: lot?.category || 'specifique' as LotCategory,
          name: lot?.name || type,
          description: '',
          priority: 'medium' as const,
          isUrgent: false,
          selectedPrestations: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
    };

    return EstimationService.estimateProject(mockProject);
  }, [selectedLots, livingArea]);

  // Soumission
  const onSubmit = useCallback(async (data: ProfessionalFormData) => {
    if (!user?.id) {
      toast({
        title: 'Erreur',
        description: 'Vous devez être connecté pour créer un projet',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Construire le projet Phase 0
      const projectData = {
        owner: {
          identity: {
            type: 'b2b' as const,
            companyName: data.companyName,
            siret: data.siret || undefined,
            contactName: data.contactName,
          },
          contact: {
            email: data.email,
            phone: data.phone,
            preferredContactMethod: 'email' as const,
          },
        },
        property: {
          address: {
            street: data.address,
            postalCode: data.postalCode,
            city: data.city,
          },
          characteristics: {
            type: data.propertyType as PropertyType,
            livingArea: data.livingArea,
          },
          construction: {
            yearBuilt: data.yearBuilt,
          },
        },
        workProject: {
          general: {
            title: data.projectTitle,
            description: data.projectDescription,
          },
          scope: {
            workType: data.workType as WorkType,
          },
          budget: {
            totalEnvelope: {
              min: data.budgetMin,
              max: data.budgetMax,
            },
          },
          constraints: {
            temporal: {
              desiredStartDate: data.desiredStartDate ? new Date(data.desiredStartDate) : undefined,
              maxDurationMonths: data.maxDurationMonths,
            },
          },
          quality: {
            finishLevel: data.finishLevel as 'basic' | 'standard' | 'premium' | 'luxury',
          },
        },
      };

      const project = await Phase0ProjectService.createProject(user.id, projectData);

      // Ajouter les lots (via la mise à jour du projet)
      // Note: Dans une implémentation complète, on utiliserait LotService

      toast({
        title: 'Projet créé avec succès',
        description: `Référence: ${project.reference}`,
      });

      if (onSuccess) {
        onSuccess(project.id);
      } else {
        navigate(`/phase0/project/${project.id}`);
      }
    } catch (err) {
      console.error('Erreur création projet:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le projet',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, toast, onSuccess, navigate]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn('space-y-6', className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="company">
            <Building2 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Entreprise</span>
          </TabsTrigger>
          <TabsTrigger value="property">
            <MapPin className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Bien</span>
          </TabsTrigger>
          <TabsTrigger value="project">
            <Hammer className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Projet</span>
          </TabsTrigger>
          <TabsTrigger value="budget">
            <Euro className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Budget</span>
          </TabsTrigger>
        </TabsList>

        {/* Onglet Entreprise */}
        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informations entreprise</CardTitle>
              <CardDescription>
                Renseignez les informations de votre société
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Raison sociale *</Label>
                  <Input
                    id="companyName"
                    {...register('companyName')}
                    placeholder="Société Example SAS"
                  />
                  {errors.companyName && (
                    <p className="text-sm text-destructive">{errors.companyName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input
                    id="siret"
                    {...register('siret')}
                    placeholder="12345678900001"
                    maxLength={14}
                  />
                  {errors.siret && (
                    <p className="text-sm text-destructive">{errors.siret.message}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Nom du contact *</Label>
                  <Input
                    id="contactName"
                    {...register('contactName')}
                    placeholder="Jean Dupont"
                  />
                  {errors.contactName && (
                    <p className="text-sm text-destructive">{errors.contactName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactRole">Fonction</Label>
                  <Input
                    id="contactRole"
                    {...register('contactRole')}
                    placeholder="Directeur technique"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="contact@societe.fr"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...register('phone')}
                    placeholder="01 23 45 67 89"
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Bien */}
        <TabsContent value="property" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bien concerné</CardTitle>
              <CardDescription>
                Informations sur le bien objet des travaux
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Type de bien *</Label>
                <Controller
                  name="propertyType"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.propertyType && (
                  <p className="text-sm text-destructive">{errors.propertyType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse *</Label>
                <Input
                  id="address"
                  {...register('address')}
                  placeholder="15 rue de la Paix"
                />
                {errors.address && (
                  <p className="text-sm text-destructive">{errors.address.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Code postal *</Label>
                  <Input
                    id="postalCode"
                    {...register('postalCode')}
                    placeholder="75001"
                    maxLength={5}
                  />
                  {errors.postalCode && (
                    <p className="text-sm text-destructive">{errors.postalCode.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville *</Label>
                  <Input
                    id="city"
                    {...register('city')}
                    placeholder="Paris"
                  />
                  {errors.city && (
                    <p className="text-sm text-destructive">{errors.city.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="livingArea">Surface (m²) *</Label>
                  <Input
                    id="livingArea"
                    type="number"
                    {...register('livingArea', { valueAsNumber: true })}
                    placeholder="150"
                  />
                  {errors.livingArea && (
                    <p className="text-sm text-destructive">{errors.livingArea.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearBuilt">Année construction</Label>
                  <Input
                    id="yearBuilt"
                    type="number"
                    {...register('yearBuilt', { valueAsNumber: true })}
                    placeholder="1985"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Projet */}
        <TabsContent value="project" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description du projet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="projectTitle">Titre du projet *</Label>
                <Input
                  id="projectTitle"
                  {...register('projectTitle')}
                  placeholder="Réhabilitation bureaux 3e étage"
                />
                {errors.projectTitle && (
                  <p className="text-sm text-destructive">{errors.projectTitle.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Type de travaux *</Label>
                <Controller
                  name="workType"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez..." />
                      </SelectTrigger>
                      <SelectContent>
                        {WORK_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.workType && (
                  <p className="text-sm text-destructive">{errors.workType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectDescription">Description détaillée</Label>
                <Textarea
                  id="projectDescription"
                  {...register('projectDescription')}
                  placeholder="Décrivez le projet, les objectifs, les contraintes particulières..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sélection des lots */}
          <Card>
            <CardHeader>
              <CardTitle>
                Lots de travaux *
                {selectedLots.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedLots.length} sélectionné(s)
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {errors.selectedLots && (
                <p className="text-sm text-destructive">{errors.selectedLots.message}</p>
              )}

              {(Object.keys(lotsByCategory) as LotCategory[]).map((category) => {
                const lots = lotsByCategory[category];
                const isExpanded = expandedCategories.has(category);
                const selectedInCategory = lots.filter(l => selectedLots.includes(l.type)).length;

                return (
                  <div key={category} className="border rounded-lg">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{CATEGORY_LABELS[category]}</span>
                        {selectedInCategory > 0 && (
                          <Badge variant="default" className="text-xs">
                            {selectedInCategory}
                          </Badge>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isExpanded && (
                      <div className="p-3 pt-0 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {lots.map((lot) => (
                          <label
                            key={lot.type}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                              selectedLots.includes(lot.type)
                                ? 'bg-primary/10'
                                : 'hover:bg-muted'
                            )}
                          >
                            <Checkbox
                              checked={selectedLots.includes(lot.type)}
                              onCheckedChange={() => toggleLot(lot.type)}
                            />
                            <span className="text-sm">{lot.number}. {lot.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Documents existants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documents disponibles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Controller
                name="hasPlans"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <span>Plans existants (architecte, géomètre)</span>
                  </label>
                )}
              />
              <Controller
                name="hasDiagnostics"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <span>Diagnostics techniques (DPE, amiante, plomb...)</span>
                  </label>
                )}
              />
              <Controller
                name="hasSpecifications"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <span>Cahier des charges ou spécifications</span>
                  </label>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Budget */}
        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget et planning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budgetMin">Budget minimum (€) *</Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    {...register('budgetMin', { valueAsNumber: true })}
                    placeholder="50000"
                  />
                  {errors.budgetMin && (
                    <p className="text-sm text-destructive">{errors.budgetMin.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budgetMax">Budget maximum (€) *</Label>
                  <Input
                    id="budgetMax"
                    type="number"
                    {...register('budgetMax', { valueAsNumber: true })}
                    placeholder="80000"
                  />
                  {errors.budgetMax && (
                    <p className="text-sm text-destructive">{errors.budgetMax.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="desiredStartDate">Date de début souhaitée</Label>
                  <Input
                    id="desiredStartDate"
                    type="date"
                    {...register('desiredStartDate')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Durée maximum</Label>
                  <Controller
                    name="maxDurationMonths"
                    control={control}
                    render={({ field }) => (
                      <Select
                        onValueChange={(v) => field.onChange(parseInt(v))}
                        value={field.value?.toString()}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pas de limite" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 mois</SelectItem>
                          <SelectItem value="2">2 mois</SelectItem>
                          <SelectItem value="3">3 mois</SelectItem>
                          <SelectItem value="6">6 mois</SelectItem>
                          <SelectItem value="12">12 mois</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Niveau de finition</Label>
                <Controller
                  name="finishLevel"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basique (économique)</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="premium">Premium (haut de gamme)</SelectItem>
                        <SelectItem value="luxury">Luxe (sur-mesure)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Estimation rapide */}
          {quickEstimate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Euro className="w-5 h-5 text-primary" />
                  Estimation indicative
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Budget estimé:</span>
                  <span className="font-bold text-primary">
                    {quickEstimate.budget.total.min.toLocaleString('fr-FR')} € - {quickEstimate.budget.total.max.toLocaleString('fr-FR')} €
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Durée estimée:</span>
                  <span>
                    {quickEstimate.duration.totalWeeks.min} - {quickEstimate.duration.totalWeeks.max} semaines
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Confiance:</span>
                  <span>{quickEstimate.confidence}%</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conditions */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Controller
                name="acceptTerms"
                control={control}
                render={({ field }) => (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <div>
                      <span>
                        J'accepte les conditions générales d'utilisation et la politique de confidentialité *
                      </span>
                      {errors.acceptTerms && (
                        <p className="text-sm text-destructive">{errors.acceptTerms.message}</p>
                      )}
                    </div>
                  </label>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const tabs = ['company', 'property', 'project', 'budget'];
            const currentIndex = tabs.indexOf(activeTab);
            if (currentIndex > 0) {
              setActiveTab(tabs[currentIndex - 1]);
            }
          }}
          disabled={activeTab === 'company'}
        >
          Précédent
        </Button>

        <div className="flex items-center gap-2">
          {activeTab !== 'budget' ? (
            <Button
              type="button"
              onClick={() => {
                const tabs = ['company', 'property', 'project', 'budget'];
                const currentIndex = tabs.indexOf(activeTab);
                if (currentIndex < tabs.length - 1) {
                  setActiveTab(tabs[currentIndex + 1]);
                }
              }}
            >
              Suivant
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting || !isValid}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Créer le projet
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export default ProfessionalForm;
