/**
 * DCEDocumentViewer Component
 * Visualiseur pour les documents DCE (RC, AE, DPGF, Mémoire Technique)
 * Permet de voir et télécharger les documents générés
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  FileText,
  Printer,
  Copy,
  CheckCircle2,
  Building2,
  Euro,
  Calendar,
  MapPin,
  Shield,
  Award,
  ClipboardList,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { DCEDocument } from '@/types/phase1/dce.types';

interface DCEDocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dce: DCEDocument;
  documentType: 'rc' | 'ae' | 'dpgf' | 'mt' | 'all';
  userType?: 'B2C' | 'B2B' | 'B2G';
}

export function DCEDocumentViewer({
  open,
  onOpenChange,
  dce,
  documentType,
  userType = 'B2C',
}: DCEDocumentViewerProps) {
  const { toast } = useToast();
  const [activeDoc, setActiveDoc] = useState(documentType === 'all' ? 'rc' : documentType);

  const handleCopyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: 'Copié',
        description: 'Le contenu a été copié dans le presse-papier',
      });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: 'Impossible de copier le contenu',
        variant: 'destructive',
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Generate text content for download
    const content = generateDocumentText(dce, activeDoc, userType);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${getDocumentTitle(activeDoc, userType)}_${dce.metadata.projectReference}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Document téléchargé',
      description: 'Le document a été téléchargé',
    });
  };

  const getDocumentTitle = (type: string, userType: string): string => {
    const titles: Record<string, Record<string, string>> = {
      rc: {
        B2C: 'Cahier des charges',
        B2B: 'Règlement de Consultation',
        B2G: 'Règlement de Consultation',
      },
      ae: {
        B2C: 'Formulaire d\'engagement',
        B2B: 'Acte d\'Engagement',
        B2G: 'Acte d\'Engagement',
      },
      dpgf: {
        B2C: 'Détail des prix',
        B2B: 'DPGF',
        B2G: 'Décomposition du Prix Global et Forfaitaire',
      },
      mt: {
        B2C: 'Questionnaire entreprise',
        B2B: 'Cadre de Mémoire Technique',
        B2G: 'Cadre de Mémoire Technique',
      },
    };
    return titles[type]?.[userType] || titles[type]?.B2C || type.toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                Documents du DCE
              </DialogTitle>
              <DialogDescription>
                {dce.metadata.projectTitle} - Réf. {dce.metadata.projectReference}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              <Button variant="default" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </div>
        </DialogHeader>

        {documentType === 'all' ? (
          <Tabs value={activeDoc} onValueChange={setActiveDoc}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="rc">
                {userType === 'B2C' ? 'Cahier des charges' : 'RC'}
              </TabsTrigger>
              <TabsTrigger value="ae">
                {userType === 'B2C' ? 'Engagement' : 'AE'}
              </TabsTrigger>
              <TabsTrigger value="dpgf">
                {userType === 'B2C' ? 'Prix' : 'DPGF'}
              </TabsTrigger>
              <TabsTrigger value="mt">
                {userType === 'B2C' ? 'Questionnaire' : 'MT'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rc">
              <DocumentRC dce={dce} userType={userType} />
            </TabsContent>
            <TabsContent value="ae">
              <DocumentAE dce={dce} userType={userType} />
            </TabsContent>
            <TabsContent value="dpgf">
              <DocumentDPGF dce={dce} userType={userType} />
            </TabsContent>
            <TabsContent value="mt">
              <DocumentMT dce={dce} userType={userType} />
            </TabsContent>
          </Tabs>
        ) : (
          <ScrollArea className="h-[60vh]">
            {activeDoc === 'rc' && <DocumentRC dce={dce} userType={userType} />}
            {activeDoc === 'ae' && <DocumentAE dce={dce} userType={userType} />}
            {activeDoc === 'dpgf' && <DocumentDPGF dce={dce} userType={userType} />}
            {activeDoc === 'mt' && <DocumentMT dce={dce} userType={userType} />}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// DOCUMENT RC (Règlement de Consultation)
// =============================================================================

function DocumentRC({ dce, userType }: { dce: DCEDocument; userType: string }) {
  const rc = dce.reglementConsultation;

  if (!rc) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Document non disponible
      </div>
    );
  }

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-4 print:p-0">
        {/* En-tête */}
        <div className="text-center border-b pb-6">
          <Badge variant="outline" className="mb-4">
            {userType === 'B2C' ? 'CAHIER DES CHARGES' : 'RÈGLEMENT DE CONSULTATION'}
          </Badge>
          <h1 className="text-2xl font-bold mt-2">
            {dce.metadata.projectTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            Référence : {dce.metadata.projectReference}
          </p>
        </div>

        {/* Section 1: Identification */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {userType === 'B2C' ? '1. Votre projet' : '1. Identification du projet'}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">
                {userType === 'B2C' ? 'Propriétaire' : 'Maître d\'ouvrage'}
              </div>
              <div className="font-medium mt-1">
                {rc.identification?.maitreOuvrage?.nom || 'Non renseigné'}
              </div>
              {rc.identification?.maitreOuvrage?.adresse && (
                <div className="text-sm text-muted-foreground mt-1">
                  {rc.identification.maitreOuvrage.adresse.street}
                  <br />
                  {rc.identification.maitreOuvrage.adresse.postalCode} {rc.identification.maitreOuvrage.adresse.city}
                </div>
              )}
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Adresse du chantier
              </div>
              {rc.identification?.adresseChantier ? (
                <div className="font-medium mt-1">
                  {rc.identification.adresseChantier.street}
                  <br />
                  {rc.identification.adresseChantier.postalCode} {rc.identification.adresseChantier.city}
                </div>
              ) : (
                <div className="text-muted-foreground mt-1">Non renseigné</div>
              )}
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Nature des travaux</div>
            <div className="font-medium mt-1">
              {rc.identification?.natureObjet || 'Travaux de rénovation'}
            </div>
            {rc.identification?.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {rc.identification.description}
              </p>
            )}
          </div>
        </section>

        <Separator />

        {/* Section 2: Conditions */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {userType === 'B2C' ? '2. Ce que nous attendons' : '2. Conditions de participation'}
          </h2>

          {/* Qualifications */}
          {rc.modalitesCandidature?.conditionsParticipation?.qualificationsExigees && (
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium flex items-center gap-2 mb-3">
                <Award className="w-4 h-4" />
                Qualifications requises
              </h3>
              <div className="flex flex-wrap gap-2">
                {rc.modalitesCandidature.conditionsParticipation.qualificationsExigees.map((qual, idx) => (
                  <Badge key={idx} variant={qual.obligatoire ? 'default' : 'secondary'}>
                    {qual.designation}
                    {qual.obligatoire && ' *'}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">* Obligatoire</p>
            </div>
          )}

          {/* Assurances */}
          {rc.modalitesCandidature?.conditionsParticipation?.assurancesObligatoires && (
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4" />
                Assurances exigées
              </h3>
              <ul className="space-y-2">
                {rc.modalitesCandidature.conditionsParticipation.assurancesObligatoires.map((ass, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {ass.type === 'rc_decennale' && 'Assurance décennale'}
                    {ass.type === 'rc_professionnelle' && 'Responsabilité civile professionnelle'}
                    {ass.type === 'biennale' && 'Garantie biennale'}
                    {ass.type === 'parfait_achevement' && 'Garantie de parfait achèvement'}
                    {ass.montantMinimum && ` (min. ${ass.montantMinimum.toLocaleString('fr-FR')} €)`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <Separator />

        {/* Section 3: Délais */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {userType === 'B2C' ? '3. Calendrier' : '3. Délais et remise des offres'}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="text-sm text-muted-foreground">Date limite de réponse</div>
              <div className="text-xl font-bold text-primary mt-1">
                {rc.remiseOffres?.delais?.dateLimiteReception
                  ? new Date(rc.remiseOffres.delais.dateLimiteReception).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : dce.metadata.consultationDeadline
                    ? new Date(dce.metadata.consultationDeadline).toLocaleDateString('fr-FR')
                    : 'À définir'
                }
              </div>
              {rc.remiseOffres?.delais?.heureLimit && (
                <div className="text-sm text-muted-foreground">
                  avant {rc.remiseOffres.delais.heureLimit}
                </div>
              )}
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">Validité des offres</div>
              <div className="font-medium mt-1">
                {rc.remiseOffres?.delais?.dureeValiditeOffre || 90} jours
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Section 4: Critères de sélection */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            {userType === 'B2C' ? '4. Comment nous choisirons' : '4. Critères de sélection'}
          </h2>

          {rc.criteresSelection?.criteres ? (
            <div className="space-y-2">
              {rc.criteresSelection.criteres.map((critere, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium">{critere.nom}</span>
                  <Badge variant="outline">{critere.ponderation}%</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Prix</span>
                <Badge variant="outline">40%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Valeur technique</span>
                <Badge variant="outline">40%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Délai d'exécution</span>
                <Badge variant="outline">10%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Références</span>
                <Badge variant="outline">10%</Badge>
              </div>
            </div>
          )}
        </section>

        {/* Pied de page */}
        <div className="text-center text-sm text-muted-foreground pt-6 border-t">
          Document généré par TORP le {new Date(dce.metadata.createdAt).toLocaleDateString('fr-FR')}
        </div>
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// DOCUMENT AE (Acte d'Engagement)
// =============================================================================

function DocumentAE({ dce, userType }: { dce: DCEDocument; userType: string }) {
  const ae = dce.acteEngagement;

  if (!ae) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Document non disponible
      </div>
    );
  }

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-4">
        {/* En-tête */}
        <div className="text-center border-b pb-6">
          <Badge variant="outline" className="mb-4">
            {userType === 'B2C' ? 'FORMULAIRE D\'ENGAGEMENT' : 'ACTE D\'ENGAGEMENT'}
          </Badge>
          <h1 className="text-2xl font-bold mt-2">
            {dce.metadata.projectTitle}
          </h1>
        </div>

        {/* Identification du candidat */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            A. Identification du candidat
          </h2>

          <div className="space-y-3">
            <div className="p-4 border rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Raison sociale</label>
                  <div className="h-10 border-b border-dashed mt-1"></div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">SIRET</label>
                  <div className="h-10 border-b border-dashed mt-1"></div>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Adresse du siège</label>
                <div className="h-10 border-b border-dashed mt-1"></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Représentant légal</label>
                  <div className="h-10 border-b border-dashed mt-1"></div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Qualité</label>
                  <div className="h-10 border-b border-dashed mt-1"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Objet de l'engagement */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            B. Objet de l'engagement
          </h2>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p>
              Le soussigné s'engage, conformément aux stipulations du cahier des charges,
              à exécuter les prestations suivantes :
            </p>
            <div className="font-medium mt-2">
              {ae.objet?.natureObjet || dce.metadata.projectTitle}
            </div>
            {ae.objet?.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {ae.objet.description}
              </p>
            )}
          </div>
        </section>

        <Separator />

        {/* Montant */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Euro className="w-5 h-5 text-primary" />
            C. Prix de l'offre
          </h2>

          <div className="p-4 border rounded-lg space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Montant HT</label>
                <div className="h-10 border-b border-dashed mt-1 flex items-end">
                  <span className="text-muted-foreground">€</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">TVA applicable</label>
                <div className="h-10 border-b border-dashed mt-1 flex items-end">
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Montant TTC</label>
              <div className="h-12 border-2 rounded-lg mt-1 flex items-end px-3">
                <span className="text-muted-foreground">€</span>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Délais */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            D. Délais d'exécution
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <label className="text-sm text-muted-foreground">Délai d'exécution</label>
              <div className="h-10 border-b border-dashed mt-1 flex items-end">
                <span className="text-muted-foreground">semaines/mois</span>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <label className="text-sm text-muted-foreground">Date de démarrage souhaitée</label>
              <div className="h-10 border-b border-dashed mt-1"></div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Signature */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            E. Signature
          </h2>

          <div className="p-4 border rounded-lg space-y-4">
            <p className="text-sm">
              {userType === 'B2C'
                ? 'Je certifie l\'exactitude des renseignements fournis et m\'engage à respecter les conditions du présent document.'
                : 'Le candidat certifie l\'exactitude des renseignements fournis et affirme que ses attestations et déclarations sont sincères.'
              }
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <label className="text-sm text-muted-foreground">Fait à</label>
                <div className="h-10 border-b border-dashed mt-1"></div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Le</label>
                <div className="h-10 border-b border-dashed mt-1"></div>
              </div>
            </div>

            <div className="pt-4">
              <label className="text-sm text-muted-foreground">
                Signature et cachet de l'entreprise
              </label>
              <div className="h-32 border-2 border-dashed rounded-lg mt-2"></div>
            </div>
          </div>
        </section>

        {/* Pied de page */}
        <div className="text-center text-sm text-muted-foreground pt-6 border-t">
          Document généré par TORP le {new Date(dce.metadata.createdAt).toLocaleDateString('fr-FR')}
        </div>
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// DOCUMENT DPGF (Décomposition du Prix Global et Forfaitaire)
// =============================================================================

function DocumentDPGF({ dce, userType }: { dce: DCEDocument; userType: string }) {
  const dpgf = dce.decompositionPrix;

  if (!dpgf) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Document non disponible
      </div>
    );
  }

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-4">
        {/* En-tête */}
        <div className="text-center border-b pb-6">
          <Badge variant="outline" className="mb-4">
            {userType === 'B2C' ? 'DÉTAIL DES PRIX' : 'DPGF'}
          </Badge>
          <h1 className="text-2xl font-bold mt-2">
            Décomposition du Prix Global et Forfaitaire
          </h1>
          <p className="text-muted-foreground mt-1">
            {dce.metadata.projectTitle}
          </p>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Instructions :</strong> Veuillez remplir les prix unitaires HT pour chaque poste.
            Les totaux seront calculés automatiquement.
          </p>
        </div>

        {/* Tableau des postes */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 text-sm font-medium">N°</th>
                <th className="text-left p-3 text-sm font-medium">Désignation</th>
                <th className="text-center p-3 text-sm font-medium">Unité</th>
                <th className="text-center p-3 text-sm font-medium">Quantité</th>
                <th className="text-right p-3 text-sm font-medium">Prix unit. HT</th>
                <th className="text-right p-3 text-sm font-medium">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {dpgf.lots?.map((lot, lotIdx) => (
                <React.Fragment key={lot.numero || lotIdx}>
                  {/* En-tête du lot */}
                  <tr className="bg-primary/5">
                    <td colSpan={6} className="p-3 font-semibold">
                      Lot {lot.numero || lotIdx + 1} : {lot.designation}
                    </td>
                  </tr>

                  {/* Postes du lot */}
                  {lot.postes?.map((poste, posteIdx) => (
                    <tr key={poste.id || posteIdx} className="border-t">
                      <td className="p-3 text-sm">{lotIdx + 1}.{posteIdx + 1}</td>
                      <td className="p-3 text-sm">{poste.designation}</td>
                      <td className="p-3 text-sm text-center">{poste.unite}</td>
                      <td className="p-3 text-sm text-center">{poste.quantite}</td>
                      <td className="p-3 text-right">
                        <div className="h-8 border-b border-dashed"></div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="h-8 border-b border-dashed"></div>
                      </td>
                    </tr>
                  ))}

                  {/* Sous-total lot */}
                  <tr className="bg-muted/50">
                    <td colSpan={5} className="p-3 text-right font-medium">
                      Sous-total Lot {lot.numero || lotIdx + 1} HT
                    </td>
                    <td className="p-3">
                      <div className="h-8 border rounded bg-white"></div>
                    </td>
                  </tr>
                </React.Fragment>
              )) || (
                // Affichage par défaut si pas de lots structurés
                <>
                  <tr className="border-t">
                    <td className="p-3 text-sm">1</td>
                    <td className="p-3 text-sm">Travaux préparatoires</td>
                    <td className="p-3 text-sm text-center">ens</td>
                    <td className="p-3 text-sm text-center">1</td>
                    <td className="p-3"><div className="h-8 border-b border-dashed"></div></td>
                    <td className="p-3"><div className="h-8 border-b border-dashed"></div></td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-3 text-sm">2</td>
                    <td className="p-3 text-sm">Travaux principaux</td>
                    <td className="p-3 text-sm text-center">ens</td>
                    <td className="p-3 text-sm text-center">1</td>
                    <td className="p-3"><div className="h-8 border-b border-dashed"></div></td>
                    <td className="p-3"><div className="h-8 border-b border-dashed"></div></td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-3 text-sm">3</td>
                    <td className="p-3 text-sm">Finitions</td>
                    <td className="p-3 text-sm text-center">ens</td>
                    <td className="p-3 text-sm text-center">1</td>
                    <td className="p-3"><div className="h-8 border-b border-dashed"></div></td>
                    <td className="p-3"><div className="h-8 border-b border-dashed"></div></td>
                  </tr>
                </>
              )}
            </tbody>
            <tfoot className="bg-primary/10">
              <tr>
                <td colSpan={5} className="p-3 text-right font-bold">
                  TOTAL GÉNÉRAL HT
                </td>
                <td className="p-3">
                  <div className="h-10 border-2 rounded bg-white font-bold"></div>
                </td>
              </tr>
              <tr>
                <td colSpan={5} className="p-3 text-right">TVA (20%)</td>
                <td className="p-3">
                  <div className="h-8 border rounded bg-white"></div>
                </td>
              </tr>
              <tr className="bg-primary text-white">
                <td colSpan={5} className="p-3 text-right font-bold">
                  TOTAL TTC
                </td>
                <td className="p-3">
                  <div className="h-10 border-2 rounded bg-white text-primary font-bold"></div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pied de page */}
        <div className="text-center text-sm text-muted-foreground pt-6 border-t">
          Document généré par TORP le {new Date(dce.metadata.createdAt).toLocaleDateString('fr-FR')}
        </div>
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// DOCUMENT MT (Mémoire Technique)
// =============================================================================

function DocumentMT({ dce, userType }: { dce: DCEDocument; userType: string }) {
  const mt = dce.cadreMemoireTechnique;

  return (
    <ScrollArea className="h-[60vh]">
      <div className="space-y-6 p-4">
        {/* En-tête */}
        <div className="text-center border-b pb-6">
          <Badge variant="outline" className="mb-4">
            {userType === 'B2C' ? 'QUESTIONNAIRE ENTREPRISE' : 'CADRE DE MÉMOIRE TECHNIQUE'}
          </Badge>
          <h1 className="text-2xl font-bold mt-2">
            {userType === 'B2C'
              ? 'Questionnaire de présentation'
              : 'Cadre de réponse technique'
            }
          </h1>
          <p className="text-muted-foreground mt-1">
            {dce.metadata.projectTitle}
          </p>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Instructions :</strong> Veuillez compléter chaque section ci-dessous.
            Ces informations seront utilisées pour évaluer votre candidature.
          </p>
        </div>

        {/* Section 1: Présentation entreprise */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            1. Présentation de l'entreprise
          </h2>

          <div className="p-4 border rounded-lg">
            <label className="text-sm font-medium">
              Présentez votre entreprise, son historique et son savoir-faire
            </label>
            <div className="h-32 border-2 border-dashed rounded-lg mt-2"></div>
          </div>
        </section>

        {/* Section 2: Moyens humains */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            2. Moyens humains
          </h2>

          <div className="p-4 border rounded-lg space-y-4">
            <div>
              <label className="text-sm font-medium">
                Effectif global et organisation de l'équipe projet
              </label>
              <div className="h-24 border-2 border-dashed rounded-lg mt-2"></div>
            </div>
            <div>
              <label className="text-sm font-medium">
                Qualifications et formations du personnel affecté
              </label>
              <div className="h-24 border-2 border-dashed rounded-lg mt-2"></div>
            </div>
          </div>
        </section>

        {/* Section 3: Moyens matériels */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            3. Moyens matériels
          </h2>

          <div className="p-4 border rounded-lg">
            <label className="text-sm font-medium">
              Matériel et équipements mobilisables pour ce projet
            </label>
            <div className="h-24 border-2 border-dashed rounded-lg mt-2"></div>
          </div>
        </section>

        {/* Section 4: Méthodologie */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            4. Méthodologie d'intervention
          </h2>

          <div className="p-4 border rounded-lg space-y-4">
            <div>
              <label className="text-sm font-medium">
                Organisation du chantier et phasage des travaux
              </label>
              <div className="h-32 border-2 border-dashed rounded-lg mt-2"></div>
            </div>
            <div>
              <label className="text-sm font-medium">
                Mesures environnementales et gestion des déchets
              </label>
              <div className="h-24 border-2 border-dashed rounded-lg mt-2"></div>
            </div>
          </div>
        </section>

        {/* Section 5: Références */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            5. Références de chantiers similaires
          </h2>

          <div className="space-y-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="p-4 border rounded-lg">
                <h3 className="font-medium mb-3">Référence {num}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Nom du projet</label>
                    <div className="h-8 border-b border-dashed mt-1"></div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Maître d'ouvrage</label>
                    <div className="h-8 border-b border-dashed mt-1"></div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Montant</label>
                    <div className="h-8 border-b border-dashed mt-1"></div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Année</label>
                    <div className="h-8 border-b border-dashed mt-1"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 6: Qualité */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            6. Engagements qualité
          </h2>

          <div className="p-4 border rounded-lg">
            <label className="text-sm font-medium">
              Démarche qualité, certifications et engagements
            </label>
            <div className="h-24 border-2 border-dashed rounded-lg mt-2"></div>
          </div>
        </section>

        {/* Pied de page */}
        <div className="text-center text-sm text-muted-foreground pt-6 border-t">
          Document généré par TORP le {new Date(dce.metadata.createdAt).toLocaleDateString('fr-FR')}
        </div>
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function generateDocumentText(
  dce: DCEDocument,
  docType: string,
  userType: string
): string {
  const lines: string[] = [];
  const separator = '='.repeat(60);

  lines.push(separator);
  lines.push(`Document: ${docType.toUpperCase()}`);
  lines.push(`Projet: ${dce.metadata.projectTitle}`);
  lines.push(`Référence: ${dce.metadata.projectReference}`);
  lines.push(`Généré le: ${new Date(dce.metadata.createdAt).toLocaleDateString('fr-FR')}`);
  lines.push(separator);
  lines.push('');

  // Add document-specific content
  if (docType === 'rc' && dce.reglementConsultation) {
    const rc = dce.reglementConsultation;
    lines.push('RÈGLEMENT DE CONSULTATION');
    lines.push('');
    lines.push('1. IDENTIFICATION DU PROJET');
    lines.push(`   Nature des travaux: ${rc.identification?.natureObjet || 'Non renseigné'}`);
    if (rc.identification?.description) {
      lines.push(`   Description: ${rc.identification.description}`);
    }
    lines.push('');
    lines.push('2. CONDITIONS DE PARTICIPATION');
    // Add more content...
  }

  if (docType === 'ae' && dce.acteEngagement) {
    lines.push('ACTE D\'ENGAGEMENT');
    lines.push('');
    lines.push('Ce document doit être complété et signé par le candidat.');
    // Add more content...
  }

  if (docType === 'dpgf' && dce.decompositionPrix) {
    lines.push('DÉCOMPOSITION DU PRIX GLOBAL ET FORFAITAIRE');
    lines.push('');
    lines.push('Compléter les prix unitaires HT pour chaque poste.');
    // Add more content...
  }

  if (docType === 'mt') {
    lines.push('CADRE DE MÉMOIRE TECHNIQUE');
    lines.push('');
    lines.push('1. Présentation de l\'entreprise');
    lines.push('2. Moyens humains');
    lines.push('3. Moyens matériels');
    lines.push('4. Méthodologie');
    lines.push('5. Références');
    lines.push('6. Engagements qualité');
  }

  lines.push('');
  lines.push(separator);
  lines.push('Document généré par TORP');

  return lines.join('\n');
}

export default DCEDocumentViewer;
