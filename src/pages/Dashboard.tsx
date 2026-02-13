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
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [dragActive, setDragActive] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

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
      // TODO: Handle file upload to /analyze
      console.log('Files dropped:', files);
      navigate('/analyze');
    }
  };

  const handleArchive = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const handleDelete = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de vos projets et analyses</p>
      </div>

      {/* Drag & Drop Zone */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-12 text-center cursor-pointer">
          <Upload className="h-16 w-16 text-primary/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Uploadez vos devis ici
          </h3>
          <p className="text-muted-foreground mb-4">
            Glissez-déposez vos fichiers PDF ou cliquez pour parcourir
          </p>
          <Button
            onClick={() => navigate('/analyze')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Sélectionner un fichier
          </Button>
        </CardContent>
      </Card>

      {/* Projects Table Section */}
      <div>
        <h2 className="text-2xl font-bold text-foreground font-display mb-4">
          Projets & Analyses
        </h2>

        {projects.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">
                Aucun projet archivé pour le moment. Uploadez votre premier devis ci-dessus.
              </p>
            </CardContent>
          </Card>
        ) : (
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
                    {projects.map((project) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
