import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  Search,
  Filter,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Clock
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Document {
  id: string;
  name: string;
  category: string;
  type: string;
  size: number;
  uploadDate: Date;
  status: "validated" | "pending" | "rejected";
  uploadedBy: string;
}

export const ProjectDocuments = ({ projectId }: { projectId: string }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Mock data
  const documents: Document[] = [
    {
      id: "1",
      name: "Permis de construire",
      category: "Administratif",
      type: "PDF",
      size: 2.4,
      uploadDate: new Date(2025, 0, 15),
      status: "validated",
      uploadedBy: "Mairie de Paris"
    },
    {
      id: "2",
      name: "Devis gros œuvre - Entreprise Martin",
      category: "Devis",
      type: "PDF",
      size: 0.8,
      uploadDate: new Date(2025, 0, 20),
      status: "validated",
      uploadedBy: "Vous"
    },
    {
      id: "3",
      name: "Analyse TORP - Gros œuvre",
      category: "Analyses",
      type: "PDF",
      size: 1.2,
      uploadDate: new Date(2025, 0, 21),
      status: "validated",
      uploadedBy: "TORP"
    },
    {
      id: "4",
      name: "Devis électricité - Elec Pro",
      category: "Devis",
      type: "PDF",
      size: 0.6,
      uploadDate: new Date(2025, 0, 25),
      status: "pending",
      uploadedBy: "Vous"
    },
    {
      id: "5",
      name: "Assurance dommages-ouvrage",
      category: "Assurances",
      type: "PDF",
      size: 1.5,
      uploadDate: new Date(2025, 1, 1),
      status: "validated",
      uploadedBy: "Assureur"
    },
    {
      id: "6",
      name: "Plans architecte",
      category: "Plans",
      type: "DWG",
      size: 4.2,
      uploadDate: new Date(2025, 1, 5),
      status: "validated",
      uploadedBy: "Cabinet Architecture"
    },
    {
      id: "7",
      name: "Photos état initial",
      category: "Photos",
      type: "ZIP",
      size: 15.8,
      uploadDate: new Date(2025, 1, 10),
      status: "validated",
      uploadedBy: "Vous"
    }
  ];

  const categories = [
    { value: "all", label: "Tous les documents", count: documents.length },
    { value: "Administratif", label: "Administratif", count: documents.filter(d => d.category === "Administratif").length },
    { value: "Devis", label: "Devis", count: documents.filter(d => d.category === "Devis").length },
    { value: "Analyses", label: "Analyses TORP", count: documents.filter(d => d.category === "Analyses").length },
    { value: "Plans", label: "Plans", count: documents.filter(d => d.category === "Plans").length },
    { value: "Assurances", label: "Assurances", count: documents.filter(d => d.category === "Assurances").length },
    { value: "Photos", label: "Photos", count: documents.filter(d => d.category === "Photos").length }
  ];

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "validated":
        return (
          <Badge className="bg-green-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Validé
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            En attente
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Rejeté
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatFileSize = (size: number) => {
    if (size < 1) return `${(size * 1024).toFixed(0)} Ko`;
    return `${size.toFixed(1)} Mo`;
  };

  const getTotalSize = () => {
    return documents.reduce((acc, doc) => acc + doc.size, 0);
  };

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-xs text-muted-foreground">
              {getTotalSize().toFixed(1)} Mo au total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Validés</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {documents.filter(d => d.status === "validated").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Documents vérifiés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {documents.filter(d => d.status === "pending").length}
            </div>
            <p className="text-xs text-muted-foreground">
              À analyser
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Catégories</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categories.length - 1}
            </div>
            <p className="text-xs text-muted-foreground">
              Types de documents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <Card>
        <CardHeader>
          <CardTitle>Documents du projet</CardTitle>
          <CardDescription>
            Gérez tous vos documents administratifs, devis, analyses et photos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Barre de recherche */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un document..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Ajouter un document
            </Button>
          </div>

          {/* Filtres par catégorie */}
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
              >
                {cat.label}
                <Badge variant="secondary" className="ml-2">
                  {cat.count}
                </Badge>
              </Button>
            ))}
          </div>

          {/* Liste des documents */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Ajouté par</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-xs text-muted-foreground">{doc.type}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{doc.category}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(doc.uploadDate, "dd/MM/yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatFileSize(doc.size)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {doc.uploadedBy}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(doc.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Aucun document trouvé</h3>
              <p className="text-sm text-muted-foreground">
                Essayez de modifier vos critères de recherche
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conseils */}
      <Card>
        <CardHeader>
          <CardTitle>Conseils de gestion documentaire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              Conservez tous vos documents pendant au moins 10 ans après la fin des travaux 
              (garantie décennale).
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              Numérisez systématiquement tous les documents importants : devis signés, factures, 
              PV de réception, attestations d'assurance.
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              Prenez des photos avant, pendant et après chaque phase de travaux. Elles seront 
              précieuses en cas de litige.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
