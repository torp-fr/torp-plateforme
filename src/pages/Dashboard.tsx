/**
 * Dashboard - Tableau de bord utilisateur TORP
 * Zone de drag&drop pour uploads + tableau des projets/analyses archivés
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Trash2,
  Archive,
  MoreVertical,
  ChevronDown,
  FileText,
  Zap,
  Droplet,
  Paintbrush,
  Home,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { devisService } from '@/services/api/supabase/devis.service';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const GRADE_COLORS: { [key: string]: string } = {
  'A': 'bg-success/10 text-success',
  'B': 'bg-primary/10 text-primary',
  'C': 'bg-warning/10 text-warning',
  'D': 'bg-accent/10 text-accent',
  'E': 'bg-destructive/10 text-destructive',
};

const projectTypes = [
  { id: 'plomberie', label: 'Plomberie', icon: Droplet },
  { id: 'electricite', label: 'Électricité', icon: Zap },
  { id: 'peinture', label: 'Peinture', icon: Paintbrush },
  { id: 'renovation', label: 'Rénovation complète', icon: Home },
  { id: 'cuisine', label: 'Cuisine', icon: Home },
  { id: 'salle-de-bain', label: 'Salle de bain', icon: Home }
];

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  // Project form state
  const [projectData, setProjectData] = useState({
    name: '',
    type: '',
    budget: '',
    startDate: '',
    endDate: '',
    description: '',
    surface: '',
    urgency: '',
    constraints: ''
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (allowedTypes.includes(file.type)) {
        setUploadedFile(file);
      }
    }
  };

  const handleArchive = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const handleDelete = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const handleFileSelect = () => {
    document.getElementById('file-input-dashboard')?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
    }
  };

  const handleAnalyze = async () => {
    // Validate required fields
    if (!uploadedFile) {
      toast({
        title: 'Fichier manquant',
        description: 'Veuillez uploader un devis',
        variant: 'destructive'
      });
      return;
    }

    if (!projectData.name || !projectData.type) {
      toast({
        title: 'Informations manquantes',
        description: 'Veuillez remplir au minimum le nom et le type de projet',
        variant: 'destructive'
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: 'Non authentifié',
        description: 'Veuillez vous connecter',
        variant: 'destructive'
      });
      return;
    }

    try {
      setUploading(true);

      // Upload devis with project metadata
      const result = await devisService.uploadDevis(
        user.id,
        uploadedFile,
        projectData.name,
        {
          typeTravaux: projectData.type,
          budget: projectData.budget || undefined,
          surface: projectData.surface ? parseFloat(projectData.surface) : undefined,
          description: projectData.description,
          delaiSouhaite: projectData.endDate,
          urgence: projectData.urgency,
          contraintes: projectData.constraints,
        }
      );

      // Redirect to analyze page with devis ID
      navigate(`/analyze?devisId=${result.id}`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: 'Erreur',
        description: 'Erreur lors du téléchargement du fichier',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de vos projets et analyses</p>
      </div>

      {/* Project & File Upload Section - 2 Columns */}
      <Card className="border border-border">
        <CardContent className="p-8">
          <div className="grid grid-cols-2 gap-8">
            {/* LEFT: Project Information Form */}
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-6">Informations Projet (CCF)</h3>
                <div className="space-y-4">
                  {/* Nom du projet */}
                  <div>
                    <Label htmlFor="project-name" className="text-foreground font-medium">Nom du projet *</Label>
                    <Input
                      id="project-name"
                      placeholder="Ex: Rénovation salle de bain"
                      value={projectData.name}
                      onChange={(e) => setProjectData({...projectData, name: e.target.value})}
                      className="mt-2"
                    />
                  </div>

                  {/* Type de travaux */}
                  <div>
                    <Label htmlFor="project-type" className="text-foreground font-medium">Type de travaux *</Label>
                    <Select value={projectData.type} onValueChange={(value) => setProjectData({...projectData, type: value})}>
                      <SelectTrigger id="project-type" className="mt-2">
                        <SelectValue placeholder="Sélectionner le type" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectTypes.map(type => (
                          <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Budget */}
                  <div>
                    <Label htmlFor="budget" className="text-foreground font-medium">Budget (€)</Label>
                    <Input
                      id="budget"
                      type="number"
                      placeholder="Ex: 5000"
                      value={projectData.budget}
                      onChange={(e) => setProjectData({...projectData, budget: e.target.value})}
                      className="mt-2"
                    />
                  </div>

                  {/* Surface */}
                  <div>
                    <Label htmlFor="surface" className="text-foreground font-medium">Surface (m²)</Label>
                    <Input
                      id="surface"
                      type="number"
                      placeholder="Ex: 25"
                      value={projectData.surface}
                      onChange={(e) => setProjectData({...projectData, surface: e.target.value})}
                      className="mt-2"
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start-date" className="text-foreground font-medium">Date de début</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={projectData.startDate}
                        onChange={(e) => setProjectData({...projectData, startDate: e.target.value})}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date" className="text-foreground font-medium">Date de fin</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={projectData.endDate}
                        onChange={(e) => setProjectData({...projectData, endDate: e.target.value})}
                        className="mt-2"
                      />
                    </div>
                  </div>

                  {/* Urgence */}
                  <div>
                    <Label htmlFor="urgency" className="text-foreground font-medium">Urgence</Label>
                    <Select value={projectData.urgency} onValueChange={(value) => setProjectData({...projectData, urgency: value})}>
                      <SelectTrigger id="urgency" className="mt-2">
                        <SelectValue placeholder="Sélectionner l'urgence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basse">Basse</SelectItem>
                        <SelectItem value="normale">Normale</SelectItem>
                        <SelectItem value="haute">Haute</SelectItem>
                        <SelectItem value="tres-haute">Très haute</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contraintes */}
                  <div>
                    <Label htmlFor="constraints" className="text-foreground font-medium">Contraintes</Label>
                    <Textarea
                      id="constraints"
                      placeholder="Ex: Accès difficile, horaires limités..."
                      value={projectData.constraints}
                      onChange={(e) => setProjectData({...projectData, constraints: e.target.value})}
                      className="mt-2 resize-none"
                      rows={3}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <Label htmlFor="description" className="text-foreground font-medium">Description du projet</Label>
                    <Textarea
                      id="description"
                      placeholder="Décrivez votre projet..."
                      value={projectData.description}
                      onChange={(e) => setProjectData({...projectData, description: e.target.value})}
                      className="mt-2 resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Drag & Drop Zone */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Uploader votre devis</h3>
              <Card
                className={`border-2 border-dashed transition-colors flex-1 ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <CardContent className="p-8 text-center cursor-pointer min-h-[400px] flex flex-col items-center justify-center">
                  {uploadedFile ? (
                    <div className="space-y-4 w-full">
                      <FileText className="w-16 h-16 text-primary mx-auto" />
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">
                          Fichier sélectionné
                        </h4>
                        <p className="text-sm text-muted-foreground break-all">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleFileSelect}
                        disabled={uploading}
                        size="sm"
                      >
                        Modifier
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 w-full">
                      <Upload className="h-16 w-16 text-primary/40 mx-auto" />
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">
                          Uploadez votre devis ici
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Glissez-déposez ou cliquez pour sélectionner
                        </p>
                      </div>
                      <Button
                        onClick={handleFileSelect}
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        Sélectionner un fichier
                      </Button>
                    </div>
                  )}
                  <input
                    id="file-input-dashboard"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </CardContent>
              </Card>

              {/* Analyze Button */}
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  onClick={handleAnalyze}
                  disabled={uploading || !uploadedFile || !projectData.name || !projectData.type}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
                >
                  {uploading ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Analyse en cours...
                    </>
                  ) : (
                    'Analyser le devis'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Table Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground font-display mb-4">
          Projets & Analyses
        </h2>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-semibold text-foreground">Nom du client</th>
                    <th className="text-left p-4 font-semibold text-foreground">Adresse</th>
                    <th className="text-center p-4 font-semibold text-foreground">Score</th>
                    <th className="text-center p-4 font-semibold text-foreground">Grade</th>
                    <th className="text-center p-4 font-semibold text-foreground">Statut</th>
                    <th className="text-right p-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-muted-foreground">
                        Aucun projet archivé pour le moment. Uploadez votre premier devis ci-dessus.
                      </td>
                    </tr>
                  ) : (
                    projects.map((project) => (
                      <tr
                        key={project.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-4 text-foreground font-medium">{project.clientName}</td>
                        <td className="p-4 text-muted-foreground text-sm">{project.address}</td>
                        <td className="p-4 text-center font-bold text-foreground">
                          {project.score !== null ? `${project.score}/1000` : '—'}
                        </td>
                        <td className="p-4 text-center">
                          {project.grade && (
                            <Badge
                              className={`${GRADE_COLORS[project.grade]} text-base font-bold`}
                            >
                              {project.grade}
                            </Badge>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant="outline">{project.status}</Badge>
                        </td>
                        <td className="p-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => navigate(`/projet/${project.id}`)}
                              >
                                Voir les détails
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleArchive(project.id)}
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archiver
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(project.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
