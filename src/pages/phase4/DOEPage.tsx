/**
 * DOEPage - Dossier des Ouvrages Exécutés
 * Constitution et gestion du DOE pour remise au maître d'ouvrage
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FolderOpen,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  File,
  Image,
  FileArchive,
} from 'lucide-react';
import { useDOE } from '@/hooks/phase4/useDOE';
import { DOEProgress } from '@/components/phase4/DOEProgress';

interface DocumentType {
  id: string;
  categorie: string;
  label: string;
  required: boolean;
  description: string;
  uploaded: boolean;
  files: { name: string; date: string }[];
}

export function DOEPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { doe, progression, isLoading } = useDOE(projectId!);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Types de documents DOE
  const documentTypes: DocumentType[] = [
    {
      id: 'plans-exe',
      categorie: 'plans',
      label: 'Plans d\'exécution (As-Built)',
      required: true,
      description: 'Plans conformes à l\'exécution réelle des travaux',
      uploaded: false,
      files: [],
    },
    {
      id: 'plans-reseaux',
      categorie: 'plans',
      label: 'Plans des réseaux',
      required: true,
      description: 'Électricité, plomberie, chauffage, ventilation',
      uploaded: false,
      files: [],
    },
    {
      id: 'notices-techniques',
      categorie: 'notices',
      label: 'Notices techniques',
      required: true,
      description: 'Notices d\'utilisation et d\'entretien des équipements',
      uploaded: false,
      files: [],
    },
    {
      id: 'fiches-produits',
      categorie: 'notices',
      label: 'Fiches produits',
      required: false,
      description: 'Caractéristiques des matériaux et équipements installés',
      uploaded: false,
      files: [],
    },
    {
      id: 'certificats-conformite',
      categorie: 'certificats',
      label: 'Certificats de conformité',
      required: true,
      description: 'Consuel, attestations de conformité',
      uploaded: false,
      files: [],
    },
    {
      id: 'pv-essais',
      categorie: 'certificats',
      label: 'PV d\'essais',
      required: true,
      description: 'Résultats des tests et essais réalisés',
      uploaded: false,
      files: [],
    },
    {
      id: 'attestations-assurance',
      categorie: 'assurances',
      label: 'Attestations d\'assurance',
      required: true,
      description: 'Décennale, responsabilité civile des entreprises',
      uploaded: false,
      files: [],
    },
    {
      id: 'garanties',
      categorie: 'assurances',
      label: 'Garanties fabricants',
      required: false,
      description: 'Certificats de garantie des équipements',
      uploaded: false,
      files: [],
    },
    {
      id: 'photos-chantier',
      categorie: 'photos',
      label: 'Photos de chantier',
      required: false,
      description: 'Reportage photo des travaux réalisés',
      uploaded: false,
      files: [],
    },
  ];

  const categories = [
    { id: 'plans', label: 'Plans', icon: FileText },
    { id: 'notices', label: 'Notices', icon: File },
    { id: 'certificats', label: 'Certificats', icon: CheckCircle2 },
    { id: 'assurances', label: 'Assurances', icon: FileArchive },
    { id: 'photos', label: 'Photos', icon: Image },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const requiredDocs = documentTypes.filter(d => d.required);
  const uploadedDocs = documentTypes.filter(d => d.uploaded);
  const progressionDOE = requiredDocs.length > 0
    ? Math.round((uploadedDocs.filter(d => d.required).length / requiredDocs.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-100 text-purple-800">Phase 4</Badge>
            <Badge variant="outline">DOE</Badge>
          </div>
          <h1 className="text-3xl font-bold">Dossier des Ouvrages Exécutés</h1>
          <p className="text-muted-foreground">
            Constituez le DOE pour la remise au maître d'ouvrage
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Importer des documents
          </Button>
          <Button disabled={progressionDOE < 100}>
            <Download className="h-4 w-4 mr-2" />
            Exporter DOE complet
          </Button>
        </div>
      </div>

      {/* Progression */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Progression du DOE</span>
            <span className="text-2xl font-bold">{progressionDOE}%</span>
          </CardTitle>
          <CardDescription>
            {uploadedDocs.filter(d => d.required).length} / {requiredDocs.length} documents obligatoires fournis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progressionDOE} className="h-3" />
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-muted-foreground">Documents obligatoires</span>
            {progressionDOE === 100 ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                DOE complet
              </span>
            ) : (
              <span className="text-orange-600 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                En cours
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Catégories et documents */}
      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar catégories */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Catégories</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedCategory === null
                      ? 'bg-primary text-white'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Tous les documents</span>
                </button>
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const catDocs = documentTypes.filter(d => d.categorie === cat.id);
                  const catUploaded = catDocs.filter(d => d.uploaded).length;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedCategory === cat.id
                          ? 'bg-primary text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{cat.label}</span>
                      </div>
                      <Badge variant={selectedCategory === cat.id ? 'secondary' : 'outline'}>
                        {catUploaded}/{catDocs.length}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des documents */}
        <div className="col-span-9">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedCategory
                  ? categories.find(c => c.id === selectedCategory)?.label
                  : 'Tous les documents'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {documentTypes
                  .filter(d => !selectedCategory || d.categorie === selectedCategory)
                  .map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={doc.uploaded}
                          disabled
                          className="mt-1"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{doc.label}</p>
                            {doc.required && (
                              <Badge variant="destructive" className="text-xs">
                                Obligatoire
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{doc.description}</p>
                          {doc.files.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {doc.files.map((file, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {file.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.uploaded ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Fourni
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Manquant
                          </Badge>
                        )}
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* DIUO */}
      <Card>
        <CardHeader>
          <CardTitle>DIUO - Dossier d'Interventions Ultérieures sur l'Ouvrage</CardTitle>
          <CardDescription>
            Document obligatoire identifiant les risques liés aux interventions futures
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">DIUO du projet</p>
                <p className="text-sm text-muted-foreground">
                  Zones à risques, points d'ancrage, accès toiture...
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                Générer le DIUO
              </Button>
              <Button variant="outline" disabled>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DOEPage;
