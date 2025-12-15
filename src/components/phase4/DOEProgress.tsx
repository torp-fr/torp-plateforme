/**
 * DOEProgress - Suivi du Dossier Ouvrages Exécutés
 * Affiche l'avancement de la constitution du DOE
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  CheckCircle,
  XCircle,
  Upload,
  Download,
  FolderOpen,
  AlertTriangle,
  Clock,
  Eye,
  Trash2,
  BookOpen,
  Home,
} from 'lucide-react';
import type { DOE, DocumentDOE, DocumentDOEType } from '@/types/phase4.types';
import { doeDiuoService } from '@/services/phase4';

interface DOEProgressProps {
  chantierId: string;
  onCreateCarnet?: () => void;
}

export function DOEProgress({ chantierId, onCreateCarnet }: DOEProgressProps) {
  const { toast } = useToast();
  const [doe, setDOE] = useState<DOE | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Plans', 'Contrôles']);

  useEffect(() => {
    loadDOE();
  }, [chantierId]);

  const loadDOE = async () => {
    setLoading(true);
    const data = await doeDiuoService.getDOEByChantier(chantierId);
    setDOE(data);
    setLoading(false);
  };

  const getDocTypeIcon = (type: DocumentDOEType) => {
    switch (type) {
      case 'plan_execution':
        return '📐';
      case 'notice_technique':
        return '📖';
      case 'fiche_materiau':
        return '🧱';
      case 'pv_controle':
        return '✅';
      case 'certificat':
        return '📜';
      case 'garantie':
        return '🛡️';
      default:
        return '📄';
    }
  };

  const getStatusBadge = (statut: DOE['statut']) => {
    switch (statut) {
      case 'en_constitution':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">En constitution</Badge>;
      case 'complet':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Complet</Badge>;
      case 'remis':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Remis</Badge>;
      case 'valide':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Validé</Badge>;
      default:
        return null;
    }
  };

  const groupedDocuments = doe ? Object.entries(
    doe.documents.reduce((acc, doc) => {
      if (!acc[doc.categorie]) acc[doc.categorie] = [];
      acc[doc.categorie].push(doc);
      return acc;
    }, {} as Record<string, DocumentDOE[]>)
  ) : [];

  const handleUpload = async (documentId: string) => {
    // TODO: Implement file upload
    toast({
      title: 'Upload',
      description: 'Fonctionnalité d\'upload à implémenter',
    });
  };

  const handleValidate = async (documentId: string) => {
    if (!doe) return;

    try {
      await doeDiuoService.validateDocument(doe.id, documentId, 'current_user');
      toast({
        title: 'Document validé',
        description: 'Le document a été marqué comme validé.',
      });
      loadDOE();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de valider le document.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Chargement du DOE...</div>
      </div>
    );
  }

  if (!doe) {
    return (
      <Card className="p-8 text-center">
        <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Aucun DOE créé</h3>
        <p className="text-muted-foreground mb-4">
          Le Dossier des Ouvrages Exécutés n'a pas encore été initialisé pour ce chantier.
        </p>
        <Button onClick={async () => {
          await doeDiuoService.createDOE(chantierId);
          loadDOE();
        }}>
          Créer le DOE
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Dossier Ouvrages Exécutés (DOE)</CardTitle>
                <CardDescription>
                  Documents techniques et de conformité du chantier
                </CardDescription>
              </div>
            </div>
            {getStatusBadge(doe.statut)}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress global */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avancement du dossier</span>
              <span className="font-medium">{doe.pourcentageComplet}%</span>
            </div>
            <Progress value={doe.pourcentageComplet} className="h-3" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-green-700">
                {doe.documents.filter(d => d.fichierUrl && d.valide).length}
              </div>
              <div className="text-xs text-green-600">Validés</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <Clock className="h-5 w-5 text-blue-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-blue-700">
                {doe.documents.filter(d => d.fichierUrl && !d.valide).length}
              </div>
              <div className="text-xs text-blue-600">À valider</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-red-700">
                {doe.documentsManquants.length}
              </div>
              <div className="text-xs text-red-600">Manquants</div>
            </div>
          </div>

          {/* Alerte documents manquants */}
          {doe.documentsManquants.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Documents obligatoires manquants</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 text-sm">
                  {doe.documentsManquants.slice(0, 5).map((doc, i) => (
                    <li key={i}>{doc}</li>
                  ))}
                  {doe.documentsManquants.length > 5 && (
                    <li>+{doe.documentsManquants.length - 5} autres</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex gap-2">
          {doe.statut === 'en_constitution' && doe.pourcentageComplet === 100 && (
            <Button onClick={async () => {
              await doeDiuoService.markDOEComplete(doe.id);
              loadDOE();
            }}>
              Marquer comme complet
            </Button>
          )}
          {doe.statut === 'complet' && (
            <Button onClick={async () => {
              await doeDiuoService.remettreDOE(doe.id);
              loadDOE();
            }}>
              Remettre le DOE
            </Button>
          )}
          {!doe.carnetSante && doe.statut !== 'en_constitution' && (
            <Button variant="outline" onClick={onCreateCarnet}>
              <Home className="h-4 w-4 mr-2" />
              Créer le carnet de santé
            </Button>
          )}
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Télécharger le DOE
          </Button>
        </CardFooter>
      </Card>

      {/* Documents par catégorie */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documents du dossier</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion
            type="multiple"
            value={expandedCategories}
            onValueChange={setExpandedCategories}
          >
            {groupedDocuments.map(([categorie, documents]) => {
              const completedCount = documents.filter(d => d.fichierUrl && d.valide).length;
              const totalCount = documents.length;
              const obligatoiresMissing = documents.filter(d => d.obligatoire && !d.fichierUrl).length;

              return (
                <AccordionItem key={categorie} value={categorie}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <span className="font-medium">{categorie}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {completedCount}/{totalCount}
                        </Badge>
                        {obligatoiresMissing > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {obligatoiresMissing} requis
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            !doc.fichierUrl && doc.obligatoire
                              ? 'border-red-200 bg-red-50'
                              : doc.valide
                              ? 'border-green-200 bg-green-50'
                              : doc.fichierUrl
                              ? 'border-blue-200 bg-blue-50'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{getDocTypeIcon(doc.type)}</span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{doc.nom}</span>
                                {doc.obligatoire && (
                                  <Badge variant="outline" className="text-xs">
                                    Obligatoire
                                  </Badge>
                                )}
                              </div>
                              {doc.description && (
                                <p className="text-xs text-muted-foreground">
                                  {doc.description}
                                </p>
                              )}
                              {doc.dateValidation && (
                                <p className="text-xs text-green-600">
                                  Validé le {new Date(doc.dateValidation).toLocaleDateString('fr-FR')}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {doc.fichierUrl ? (
                              <>
                                {doc.valide ? (
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleValidate(doc.id)}
                                  >
                                    Valider
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant={doc.obligatoire ? 'default' : 'outline'}
                                onClick={() => handleUpload(doc.id)}
                              >
                                <Upload className="h-4 w-4 mr-1" />
                                Ajouter
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Carnet de santé */}
      {doe.carnetSante && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Carnet de santé du bâtiment</CardTitle>
                <CardDescription>
                  Suivi de l'entretien et des garanties
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Accéder au carnet de santé
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DOEProgress;
