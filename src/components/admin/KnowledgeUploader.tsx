import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Search,
  Database,
  BookOpen,
  FileQuestion,
  Trash2,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UploadedFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "indexed" | "error";
  progress: number;
  error?: string;
  documentId?: string;
}

interface KnowledgeDocument {
  id: string;
  title: string;
  doc_type: string;
  category: string;
  code_reference?: string;
  status: string;
  chunks_count: number;
  created_at: string;
}

const DOC_TYPES = [
  { value: "dtu", label: "DTU" },
  { value: "norme", label: "Norme" },
  { value: "reglementation", label: "Rglementation" },
  { value: "guide", label: "Guide" },
  { value: "fiche_technique", label: "Fiche technique" },
];

const CATEGORIES = [
  { value: "isolation", label: "Isolation" },
  { value: "chauffage", label: "Chauffage" },
  { value: "plomberie", label: "Plomberie" },
  { value: "electricite", label: "lectricit" },
  { value: "menuiserie", label: "Menuiserie" },
  { value: "ventilation", label: "Ventilation" },
  { value: "toiture", label: "Toiture" },
  { value: "maconnerie", label: "Maonnerie" },
  { value: "platerie", label: "Plterie" },
  { value: "carrelage", label: "Carrelage" },
  { value: "peinture", label: "Peinture" },
  { value: "general", label: "Gnral" },
];

export const KnowledgeUploader = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [docType, setDocType] = useState("dtu");
  const [category, setCategory] = useState("general");
  const [isDragOver, setIsDragOver] = useState(false);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.type === "application/pdf" || f.name.endsWith(".pdf")
    );
    addFiles(droppedFiles);
  }, []);

  const addFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: "pending",
      progress: 0,
    }));
    setFiles(prev => [...prev, ...uploadedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        f => f.type === "application/pdf" || f.name.endsWith(".pdf")
      );
      addFiles(selectedFiles);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFile = async (uploadedFile: UploadedFile) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === uploadedFile.id ? { ...f, status: "uploading", progress: 10 } : f
      )
    );

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile.file);
      formData.append("action", "upload");
      formData.append("metadata", JSON.stringify({
        title: uploadedFile.file.name.replace(".pdf", ""),
        doc_type: docType,
        category: category,
      }));

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      setFiles(prev =>
        prev.map(f =>
          f.id === uploadedFile.id
            ? { ...f, status: "processing", progress: 50, documentId: result.documentId }
            : f
        )
      );

      // Process document
      const processResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "process",
            documentId: result.documentId,
          }),
        }
      );

      if (!processResponse.ok) {
        throw new Error("Processing failed");
      }

      setFiles(prev =>
        prev.map(f =>
          f.id === uploadedFile.id ? { ...f, progress: 75 } : f
        )
      );

      // Index document
      const indexResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "index",
            documentId: result.documentId,
          }),
        }
      );

      if (!indexResponse.ok) {
        throw new Error("Indexing failed");
      }

      setFiles(prev =>
        prev.map(f =>
          f.id === uploadedFile.id ? { ...f, status: "indexed", progress: 100 } : f
        )
      );

      toast({
        title: "Document index",
        description: `${uploadedFile.file.name} a t ajout  la base de connaissances.`,
      });

    } catch (error) {
      setFiles(prev =>
        prev.map(f =>
          f.id === uploadedFile.id
            ? { ...f, status: "error", error: String(error) }
            : f
        )
      );
      toast({
        title: "Erreur",
        description: `chec de l'upload de ${uploadedFile.file.name}`,
        variant: "destructive",
      });
    }
  };

  const uploadAll = async () => {
    const pendingFiles = files.filter(f => f.status === "pending");
    for (const file of pendingFiles) {
      await uploadFile(file);
    }
    loadDocuments();
    loadStats();
  };

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "list" }),
        }
      );
      const result = await response.json();
      if (result.documents) {
        setDocuments(result.documents);
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "stats" }),
        }
      );
      const result = await response.json();
      if (result.stats) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "delete", documentId }),
        }
      );
      loadDocuments();
      loadStats();
      toast({
        title: "Document supprim",
        description: "Le document a t retir de la base de connaissances.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "chec de la suppression",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "indexed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "uploading":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileQuestion className="h-4 w-4 text-gray-400" />;
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.code_reference?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.total_documents || 0}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Chunks indexs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.total_chunks || 0}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                DTU
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold">
                  {stats.by_type?.find((t: any) => t.doc_type === "dtu")?.count || 0}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Normes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold">
                  {stats.by_type?.find((t: any) => t.doc_type === "norme")?.count || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Ajouter des documents
          </CardTitle>
          <CardDescription>
            Glissez-dposez vos fichiers PDF (DTU, normes, guides, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type de document" />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Catgorie" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">
              Glissez vos fichiers PDF ici
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              ou cliquez pour slectionner
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                >
                  {getStatusIcon(file.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.file.name}</p>
                    {file.status === "uploading" || file.status === "processing" ? (
                      <Progress value={file.progress} className="h-1 mt-1" />
                    ) : file.error ? (
                      <p className="text-xs text-red-500">{file.error}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {(file.file.size / 1024 / 1024).toFixed(2)} Mo
                      </p>
                    )}
                  </div>
                  {file.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                onClick={uploadAll}
                disabled={!files.some(f => f.status === "pending")}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Uploader et indexer ({files.filter(f => f.status === "pending").length} fichiers)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Base de connaissances
              </CardTitle>
              <CardDescription>
                Documents indexs pour l'analyse de devis
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => { loadDocuments(); loadStats(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un document..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun document dans la base de connaissances</p>
              <p className="text-sm">Uploadez des DTU et normes pour enrichir l'analyse</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Catgorie</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{doc.title}</p>
                        {doc.code_reference && (
                          <p className="text-xs text-muted-foreground">{doc.code_reference}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.doc_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{doc.category}</Badge>
                    </TableCell>
                    <TableCell>{doc.chunks_count}</TableCell>
                    <TableCell>
                      {doc.status === "indexed" ? (
                        <Badge className="bg-green-100 text-green-800">Index</Badge>
                      ) : (
                        <Badge variant="outline">{doc.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDocument(doc.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeUploader;
