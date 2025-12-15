/**
 * Page de réponse à un AO (B2B Entreprise)
 * Permet de remplir DPGF, mémoire technique et soumettre la réponse
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Save, Send, FileText, Euro, Calendar, Clock,
  Briefcase, AlertTriangle, Loader2, CheckCircle2, Upload,
  FileSpreadsheet, Lightbulb, Trash2, Plus, Target, Star,
  Building, Users, Shield, Award
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { TenderService } from '@/services/tender/tender.service';
import { ResponseService } from '@/services/tender/response.service';
import { supabase } from '@/lib/supabase';
import type {
  Tender,
  TenderResponse,
  TenderDocument,
  DPGFData,
  DPGFLot,
  DPGFItem,
  TechnicalMemo,
  ProjectReference,
} from '@/types/tender';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';

export function B2BResponseFormPage() {
  const { tenderId, responseId } = useParams<{ tenderId: string; responseId: string }>();
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();

  const [tender, setTender] = useState<Tender | null>(null);
  const [response, setResponse] = useState<TenderResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDPGF, setIsGeneratingDPGF] = useState(false);
  const [isGeneratingMemo, setIsGeneratingMemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // État du formulaire
  const [dpgfData, setDpgfData] = useState<DPGFData>({
    lots: [],
    totalHT: 0,
    totalTTC: 0,
    vatBreakdown: [],
  });
  const [technicalMemo, setTechnicalMemo] = useState<TechnicalMemo>({});
  const [proposedDuration, setProposedDuration] = useState<number>(0);
  const [proposedStartDate, setProposedStartDate] = useState<string>('');
  const [references, setReferences] = useState<ProjectReference[]>([]);

  // État du dialogue de soumission
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Calculer la complétude
  const completeness = calculateCompleteness(dpgfData, technicalMemo, references);

  // Charger les données
  useEffect(() => {
    const loadData = async () => {
      if (!tenderId || !responseId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Charger le tender
        const tenderData = await TenderService.getById(tenderId);
        if (!tenderData) {
          setError('Appel d\'offres non trouvé');
          return;
        }
        setTender(tenderData);

        // Charger la réponse existante
        const responseData = await ResponseService.getById(responseId);
        if (!responseData) {
          setError('Réponse non trouvée');
          return;
        }
        setResponse(responseData);

        // Charger les données du formulaire
        if (responseData.dpgfData) {
          setDpgfData(responseData.dpgfData);
        } else {
          // Initialiser le DPGF avec les lots du tender
          initializeDPGF(tenderData);
        }

        if (responseData.technicalMemo) {
          setTechnicalMemo(responseData.technicalMemo);
        }

        if (responseData.proposedDurationDays) {
          setProposedDuration(responseData.proposedDurationDays);
        }

        if (responseData.proposedStartDate) {
          setProposedStartDate(responseData.proposedStartDate.toISOString().split('T')[0]);
        }

        if (responseData.projectReferences) {
          setReferences(responseData.projectReferences);
        }
      } catch (err) {
        console.error('Erreur chargement:', err);
        setError('Impossible de charger les données');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [tenderId, responseId]);

  // Initialiser le DPGF avec les lots du tender
  const initializeDPGF = useCallback((tender: Tender) => {
    const lots: DPGFLot[] = (tender.selectedLots || []).map(lot => ({
      lotNumber: lot.lotNumber,
      lotName: lot.lotName,
      items: [
        {
          designation: `Travaux ${lot.lotName}`,
          unit: 'Ens',
          quantity: 1,
          unitPriceHT: 0,
          totalHT: 0,
        },
      ],
      totalHT: 0,
    }));

    setDpgfData({
      lots,
      totalHT: 0,
      totalTTC: 0,
      vatBreakdown: [{ rate: 10, baseAmount: 0, vatAmount: 0 }],
    });
  }, []);

  // Générer le DPGF automatiquement
  const generateDPGF = useCallback(async () => {
    if (!tender) return;

    setIsGeneratingDPGF(true);
    try {
      const generatedDPGF = await ResponseService.generateDPGFProposal(tender);
      setDpgfData(generatedDPGF);
      toast({
        title: 'DPGF généré',
        description: 'Le DPGF a été pré-rempli avec des estimations. Ajustez les prix selon votre offre.',
      });
    } catch (err) {
      console.error('Erreur génération DPGF:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le DPGF',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingDPGF(false);
    }
  }, [tender, toast]);

  // Générer le mémoire technique
  const generateMemo = useCallback(async () => {
    if (!tender) return;

    setIsGeneratingMemo(true);
    try {
      const generatedMemo = await ResponseService.generateTechnicalMemo(tender);
      setTechnicalMemo(generatedMemo);
      toast({
        title: 'Mémoire généré',
        description: 'Le mémoire technique a été pré-rempli. Personnalisez-le avec vos informations.',
      });
    } catch (err) {
      console.error('Erreur génération mémoire:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le mémoire technique',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingMemo(false);
    }
  }, [tender, toast]);

  // Mettre à jour un item du DPGF
  const updateDPGFItem = useCallback((lotIndex: number, itemIndex: number, field: keyof DPGFItem, value: number | string) => {
    setDpgfData(prev => {
      const newLots = [...prev.lots];
      const lot = { ...newLots[lotIndex] };
      const items = [...lot.items];
      const item = { ...items[itemIndex] };

      if (field === 'unitPriceHT' || field === 'quantity') {
        item[field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
        item.totalHT = item.quantity * item.unitPriceHT;
      } else {
        (item as Record<string, unknown>)[field] = value;
      }

      items[itemIndex] = item;
      lot.items = items;
      lot.totalHT = items.reduce((sum, i) => sum + i.totalHT, 0);
      newLots[lotIndex] = lot;

      const totalHT = newLots.reduce((sum, l) => sum + l.totalHT, 0);
      const vatRate = prev.vatBreakdown[0]?.rate || 10;
      const vatAmount = totalHT * (vatRate / 100);

      return {
        ...prev,
        lots: newLots,
        totalHT,
        totalTTC: totalHT + vatAmount,
        vatBreakdown: [{ rate: vatRate, baseAmount: totalHT, vatAmount }],
      };
    });
  }, []);

  // Ajouter une ligne au DPGF
  const addDPGFItem = useCallback((lotIndex: number) => {
    setDpgfData(prev => {
      const newLots = [...prev.lots];
      const lot = { ...newLots[lotIndex] };
      lot.items = [
        ...lot.items,
        {
          designation: '',
          unit: 'U',
          quantity: 1,
          unitPriceHT: 0,
          totalHT: 0,
        },
      ];
      newLots[lotIndex] = lot;
      return { ...prev, lots: newLots };
    });
  }, []);

  // Supprimer une ligne du DPGF
  const removeDPGFItem = useCallback((lotIndex: number, itemIndex: number) => {
    setDpgfData(prev => {
      const newLots = [...prev.lots];
      const lot = { ...newLots[lotIndex] };
      lot.items = lot.items.filter((_, i) => i !== itemIndex);
      lot.totalHT = lot.items.reduce((sum, i) => sum + i.totalHT, 0);
      newLots[lotIndex] = lot;

      const totalHT = newLots.reduce((sum, l) => sum + l.totalHT, 0);
      const vatRate = prev.vatBreakdown[0]?.rate || 10;
      const vatAmount = totalHT * (vatRate / 100);

      return {
        ...prev,
        lots: newLots,
        totalHT,
        totalTTC: totalHT + vatAmount,
        vatBreakdown: [{ rate: vatRate, baseAmount: totalHT, vatAmount }],
      };
    });
  }, []);

  // Sauvegarder le brouillon
  const saveDraft = useCallback(async () => {
    if (!response) return;

    setIsSaving(true);
    try {
      await ResponseService.updateDraft(response.id, {
        dpgfData,
        technicalMemo,
        proposedDurationDays: proposedDuration,
        proposedStartDate: proposedStartDate ? new Date(proposedStartDate) : undefined,
        projectReferences: references,
        totalAmountHT: dpgfData.totalHT,
        totalAmountTTC: dpgfData.totalTTC,
        lotsBreakdown: dpgfData.lots.map(lot => ({
          lotNumber: lot.lotNumber,
          lotName: lot.lotName,
          lotType: lot.lotNumber,
          amountHT: lot.totalHT,
        })),
      });

      toast({
        title: 'Brouillon sauvegardé',
        description: 'Vos modifications ont été enregistrées',
      });
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [response, dpgfData, technicalMemo, proposedDuration, proposedStartDate, references, toast]);

  // Soumettre la réponse
  const submitResponse = useCallback(async () => {
    if (!response || !tender) return;

    setIsSubmitting(true);
    try {
      await ResponseService.submit({
        responseId: response.id,
        totalAmountHT: dpgfData.totalHT,
        lotsBreakdown: dpgfData.lots.map(lot => ({
          lotNumber: lot.lotNumber,
          lotName: lot.lotName,
          lotType: lot.lotNumber,
          amountHT: lot.totalHT,
        })),
        proposedDurationDays: proposedDuration,
        proposedStartDate: proposedStartDate ? new Date(proposedStartDate) : undefined,
        technicalMemo,
        projectReferences: references,
      });

      toast({
        title: 'Réponse envoyée !',
        description: 'Votre offre a été soumise avec succès au maître d\'ouvrage.',
      });

      setShowSubmitDialog(false);
      navigate(`/b2b/ao/${tender.id}`);
    } catch (err) {
      console.error('Erreur soumission:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de soumettre la réponse',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [response, tender, dpgfData, technicalMemo, proposedDuration, proposedStartDate, references, toast, navigate]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !tender || !response) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error || 'Données non trouvées'}</AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/b2b/ao')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux AO
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isSubmitted = response.status !== 'draft';

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" asChild>
            <Link to={`/b2b/ao/${tender.id}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à l'AO
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {!isSubmitted && (
              <>
                <Button variant="outline" onClick={saveDraft} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Sauvegarder
                </Button>
                <Button onClick={() => setShowSubmitDialog(true)} disabled={completeness < 50}>
                  <Send className="w-4 h-4 mr-2" />
                  Soumettre
                </Button>
              </>
            )}
          </div>
        </div>

        {/* En-tête */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono">
                    {tender.reference}
                  </Badge>
                  <Badge variant={isSubmitted ? 'default' : 'secondary'}>
                    {isSubmitted ? 'Réponse soumise' : 'Brouillon'}
                  </Badge>
                </div>
                <CardTitle className="text-xl">Réponse à : {tender.title}</CardTitle>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Complétude</div>
                <div className="flex items-center gap-2">
                  <Progress value={completeness} className="w-24" />
                  <span className="font-bold text-primary">{completeness}%</span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {isSubmitted && (
          <Alert className="mb-6">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Votre réponse a été soumise et ne peut plus être modifiée.
            </AlertDescription>
          </Alert>
        )}

        {/* Contenu */}
        <Tabs defaultValue="dpgf">
          <TabsList className="mb-6">
            <TabsTrigger value="dpgf" className="flex items-center gap-2">
              <Euro className="w-4 h-4" />
              DPGF
            </TabsTrigger>
            <TabsTrigger value="memo" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Mémoire technique
            </TabsTrigger>
            <TabsTrigger value="planning" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Planning
            </TabsTrigger>
            <TabsTrigger value="references" className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Références
            </TabsTrigger>
          </TabsList>

          {/* DPGF */}
          <TabsContent value="dpgf" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5" />
                      Décomposition du Prix Global et Forfaitaire
                    </CardTitle>
                    <CardDescription>
                      Renseignez vos prix pour chaque lot et prestation
                    </CardDescription>
                  </div>
                  {!isSubmitted && (
                    <Button variant="outline" onClick={generateDPGF} disabled={isGeneratingDPGF}>
                      {isGeneratingDPGF ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Lightbulb className="w-4 h-4 mr-2" />
                      )}
                      Auto-remplir
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {dpgfData.lots.map((lot, lotIndex) => (
                  <div key={lot.lotNumber} className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <Badge variant="outline">Lot {lot.lotNumber}</Badge>
                        {lot.lotName}
                      </h4>
                      <span className="font-bold">{lot.totalHT.toLocaleString('fr-FR')} € HT</span>
                    </div>

                    <div className="space-y-3">
                      {/* En-tête du tableau */}
                      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
                        <div className="col-span-5">Désignation</div>
                        <div className="col-span-2">Unité</div>
                        <div className="col-span-1 text-right">Qté</div>
                        <div className="col-span-2 text-right">P.U. HT</div>
                        <div className="col-span-2 text-right">Total HT</div>
                      </div>

                      {lot.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5">
                            <Input
                              value={item.designation}
                              onChange={(e) => updateDPGFItem(lotIndex, itemIndex, 'designation', e.target.value)}
                              placeholder="Description"
                              disabled={isSubmitted}
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              value={item.unit}
                              onChange={(e) => updateDPGFItem(lotIndex, itemIndex, 'unit', e.target.value)}
                              placeholder="U"
                              disabled={isSubmitted}
                            />
                          </div>
                          <div className="col-span-1">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateDPGFItem(lotIndex, itemIndex, 'quantity', e.target.value)}
                              className="text-right"
                              disabled={isSubmitted}
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              value={item.unitPriceHT || ''}
                              onChange={(e) => updateDPGFItem(lotIndex, itemIndex, 'unitPriceHT', e.target.value)}
                              placeholder="0.00"
                              className="text-right"
                              disabled={isSubmitted}
                            />
                          </div>
                          <div className="col-span-1 text-right font-medium">
                            {item.totalHT.toLocaleString('fr-FR')} €
                          </div>
                          {!isSubmitted && (
                            <div className="col-span-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeDPGFItem(lotIndex, itemIndex)}
                                disabled={lot.items.length <= 1}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}

                      {!isSubmitted && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addDPGFItem(lotIndex)}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Ajouter une ligne
                        </Button>
                      )}
                    </div>

                    <Separator className="mt-4" />
                  </div>
                ))}

                {/* Récapitulatif */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-lg">
                        <span>Total HT</span>
                        <span className="font-bold">{dpgfData.totalHT.toLocaleString('fr-FR')} €</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>TVA ({dpgfData.vatBreakdown[0]?.rate || 10}%)</span>
                        <span>{dpgfData.vatBreakdown[0]?.vatAmount.toLocaleString('fr-FR')} €</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-xl font-bold text-primary">
                        <span>Total TTC</span>
                        <span>{dpgfData.totalTTC.toLocaleString('fr-FR')} €</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mémoire technique */}
          <TabsContent value="memo" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Mémoire Technique
                    </CardTitle>
                    <CardDescription>
                      Présentez votre entreprise, vos moyens et votre méthodologie
                    </CardDescription>
                  </div>
                  {!isSubmitted && (
                    <Button variant="outline" onClick={generateMemo} disabled={isGeneratingMemo}>
                      {isGeneratingMemo ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Lightbulb className="w-4 h-4 mr-2" />
                      )}
                      Générer un modèle
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Présentation entreprise */}
                <div>
                  <Label className="text-base font-medium flex items-center gap-2 mb-3">
                    <Building className="w-4 h-4" />
                    Présentation de l'entreprise
                  </Label>
                  <Textarea
                    value={technicalMemo.companyPresentation || ''}
                    onChange={(e) => setTechnicalMemo(prev => ({
                      ...prev,
                      companyPresentation: e.target.value,
                    }))}
                    placeholder="Présentez votre entreprise, son histoire, ses valeurs..."
                    rows={4}
                    disabled={isSubmitted}
                  />
                </div>

                {/* Moyens humains */}
                <div>
                  <Label className="text-base font-medium flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4" />
                    Moyens humains
                  </Label>
                  <Textarea
                    value={technicalMemo.humanResources || ''}
                    onChange={(e) => setTechnicalMemo(prev => ({
                      ...prev,
                      humanResources: e.target.value,
                    }))}
                    placeholder="Décrivez l'équipe qui sera affectée au chantier..."
                    rows={3}
                    disabled={isSubmitted}
                  />
                </div>

                {/* Moyens matériels */}
                <div>
                  <Label className="text-base font-medium flex items-center gap-2 mb-3">
                    <Briefcase className="w-4 h-4" />
                    Moyens matériels
                  </Label>
                  <Textarea
                    value={technicalMemo.materialResources || ''}
                    onChange={(e) => setTechnicalMemo(prev => ({
                      ...prev,
                      materialResources: e.target.value,
                    }))}
                    placeholder="Décrivez les équipements et outils à disposition..."
                    rows={3}
                    disabled={isSubmitted}
                  />
                </div>

                {/* Méthodologie */}
                <div>
                  <Label className="text-base font-medium flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4" />
                    Méthodologie d'exécution
                  </Label>
                  <Textarea
                    value={technicalMemo.methodology || ''}
                    onChange={(e) => setTechnicalMemo(prev => ({
                      ...prev,
                      methodology: e.target.value,
                    }))}
                    placeholder="Décrivez comment vous allez aborder et réaliser les travaux..."
                    rows={4}
                    disabled={isSubmitted}
                  />
                </div>

                {/* Sécurité */}
                <div>
                  <Label className="text-base font-medium flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4" />
                    Plan de sécurité
                  </Label>
                  <Textarea
                    value={technicalMemo.safetyPlan || ''}
                    onChange={(e) => setTechnicalMemo(prev => ({
                      ...prev,
                      safetyPlan: e.target.value,
                    }))}
                    placeholder="Décrivez les mesures de sécurité prévues..."
                    rows={3}
                    disabled={isSubmitted}
                  />
                </div>

                {/* Points forts */}
                <div>
                  <Label className="text-base font-medium flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4" />
                    Points forts de votre offre
                  </Label>
                  <Textarea
                    value={technicalMemo.strengths?.join('\n') || ''}
                    onChange={(e) => setTechnicalMemo(prev => ({
                      ...prev,
                      strengths: e.target.value.split('\n').filter(s => s.trim()),
                    }))}
                    placeholder="Un point fort par ligne..."
                    rows={3}
                    disabled={isSubmitted}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Planning */}
          <TabsContent value="planning" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Planning proposé
                </CardTitle>
                <CardDescription>
                  Indiquez vos délais et disponibilités
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="duration">Durée des travaux (jours ouvrés)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={proposedDuration || ''}
                      onChange={(e) => setProposedDuration(parseInt(e.target.value) || 0)}
                      placeholder="Ex: 30"
                      disabled={isSubmitted}
                      className="mt-2"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Soit environ {Math.ceil(proposedDuration / 5)} semaines
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="startDate">Date de démarrage possible</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={proposedStartDate}
                      onChange={(e) => setProposedStartDate(e.target.value)}
                      disabled={isSubmitted}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-3 block">Planning détaillé (optionnel)</Label>
                  <Textarea
                    value={technicalMemo.detailedPlanning || ''}
                    onChange={(e) => setTechnicalMemo(prev => ({
                      ...prev,
                      detailedPlanning: e.target.value,
                    }))}
                    placeholder="Décrivez le phasage détaillé des travaux..."
                    rows={6}
                    disabled={isSubmitted}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Références */}
          <TabsContent value="references" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5" />
                      Références chantiers
                    </CardTitle>
                    <CardDescription>
                      Présentez des projets similaires réalisés
                    </CardDescription>
                  </div>
                  {!isSubmitted && (
                    <Button
                      variant="outline"
                      onClick={() => setReferences(prev => [...prev, {
                        projectName: '',
                        completionYear: new Date().getFullYear(),
                      }])}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter une référence
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {references.length > 0 ? (
                  <div className="space-y-6">
                    {references.map((ref, index) => (
                      <Card key={index} className="border-muted">
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="font-medium">Référence {index + 1}</h4>
                            {!isSubmitted && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReferences(prev => prev.filter((_, i) => i !== index))}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Nom du projet</Label>
                              <Input
                                value={ref.projectName}
                                onChange={(e) => {
                                  const newRefs = [...references];
                                  newRefs[index] = { ...newRefs[index], projectName: e.target.value };
                                  setReferences(newRefs);
                                }}
                                placeholder="Ex: Rénovation appartement 75m²"
                                disabled={isSubmitted}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Année de réalisation</Label>
                              <Input
                                type="number"
                                value={ref.completionYear || ''}
                                onChange={(e) => {
                                  const newRefs = [...references];
                                  newRefs[index] = { ...newRefs[index], completionYear: parseInt(e.target.value) };
                                  setReferences(newRefs);
                                }}
                                placeholder="2024"
                                disabled={isSubmitted}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Type de client</Label>
                              <Input
                                value={ref.clientType || ''}
                                onChange={(e) => {
                                  const newRefs = [...references];
                                  newRefs[index] = { ...newRefs[index], clientType: e.target.value as 'particulier' | 'entreprise' | 'collectivite' };
                                  setReferences(newRefs);
                                }}
                                placeholder="Particulier / Entreprise / Collectivité"
                                disabled={isSubmitted}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Montant (€ HT)</Label>
                              <Input
                                type="number"
                                value={ref.amount || ''}
                                onChange={(e) => {
                                  const newRefs = [...references];
                                  newRefs[index] = { ...newRefs[index], amount: parseFloat(e.target.value) };
                                  setReferences(newRefs);
                                }}
                                placeholder="50000"
                                disabled={isSubmitted}
                                className="mt-1"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label>Description</Label>
                              <Textarea
                                value={ref.description || ''}
                                onChange={(e) => {
                                  const newRefs = [...references];
                                  newRefs[index] = { ...newRefs[index], description: e.target.value };
                                  setReferences(newRefs);
                                }}
                                placeholder="Décrivez brièvement le projet..."
                                disabled={isSubmitted}
                                className="mt-1"
                                rows={2}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune référence ajoutée</p>
                    <p className="text-sm mt-2">
                      Ajoutez des références pour renforcer votre candidature
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogue de soumission */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soumettre votre réponse</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point de soumettre votre offre. Cette action est définitive.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant total HT</span>
              <span className="font-bold">{dpgfData.totalHT.toLocaleString('fr-FR')} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant total TTC</span>
              <span className="font-bold text-primary">{dpgfData.totalTTC.toLocaleString('fr-FR')} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Durée proposée</span>
              <span>{proposedDuration} jours</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Complétude du dossier</span>
              <span className={completeness >= 80 ? 'text-green-500' : 'text-yellow-500'}>
                {completeness}%
              </span>
            </div>
          </div>

          {completeness < 80 && (
            <Alert className="border-yellow-500/50 bg-yellow-500/5">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription>
                Votre dossier est incomplet. Un dossier plus complet augmente vos chances.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Annuler
            </Button>
            <Button onClick={submitResponse} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Confirmer et soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// Calculer la complétude du dossier
function calculateCompleteness(dpgf: DPGFData, memo: TechnicalMemo, refs: ProjectReference[]): number {
  let score = 0;
  let maxScore = 0;

  // DPGF (40%)
  maxScore += 40;
  if (dpgf.totalHT > 0) score += 40;

  // Mémoire technique (40%)
  maxScore += 40;
  if (memo.companyPresentation) score += 10;
  if (memo.humanResources) score += 8;
  if (memo.materialResources) score += 7;
  if (memo.methodology) score += 10;
  if (memo.safetyPlan) score += 5;

  // Références (20%)
  maxScore += 20;
  score += Math.min(20, refs.length * 7);

  return Math.round((score / maxScore) * 100);
}

export default B2BResponseFormPage;
