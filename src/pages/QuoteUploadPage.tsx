/**
 * Quote Upload Page - Upload devis pour analyse
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';

export function QuoteUploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (selectedFile: File) => {
    setError(null);

    // Validate file type
    if (!selectedFile.type.includes('pdf')) {
      setError('❌ Veuillez sélectionner un fichier PDF');
      return;
    }

    // Validate file size (max 50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('❌ Le fichier doit faire moins de 50MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      // TODO: Upload to Supabase
      console.log('📤 Uploading file:', file.name);

      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Store file info in localStorage
      localStorage.setItem('uploadedQuote', JSON.stringify({
        filename: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      }));

      // Navigate to analysis page
      navigate('/quote-analysis');
    } catch (err) {
      setError('❌ Erreur lors de l\'upload');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-cyan-50">
      {/* Header */}
      <header className="sticky top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-blue-100/30 shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/quote-success')}
              className="text-slate-600 hover:text-blue-600"
            >
              <ChevronLeft className="h-5 w-5 mr-2" />
              Retour
            </Button>
            <h1 className="text-2xl font-bold text-slate-900">Uploader votre devis</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="py-12 px-6">
        <div className="container mx-auto max-w-2xl">
          {/* Info Card */}
          <Card className="bg-blue-50 border-blue-200 mb-8">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Formats acceptés</p>
                  <p>PDF uniquement • Maximum 50MB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upload Zone */}
          <Card className="bg-white shadow-md mb-8">
            <CardHeader>
              <CardTitle className="text-slate-900">Sélectionner un fichier</CardTitle>
              <CardDescription>Déposez votre devis PDF ici</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Drag and Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Déposez votre PDF ici
                </h3>
                <p className="text-sm text-slate-600 mb-4">ou</p>
                <label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                    className="hidden"
                  />
                  <Button variant="outline" className="cursor-pointer">
                    Parcourir les fichiers
                  </Button>
                </label>
              </div>

              {/* File Selected */}
              {file && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-green-900 truncate">{file.name}</p>
                    <p className="text-sm text-green-700">
                      {(file.size / 1024 / 1024).toFixed(2)}MB
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-green-600 hover:text-green-700 font-semibold text-sm"
                  >
                    Annuler
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Upload Button */}
              {file && (
                <Button
                  onClick={handleUpload}
                  disabled={isLoading}
                  className="w-full text-lg py-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                >
                  <FileText className="h-5 w-5 mr-2" />
                  {isLoading ? 'Upload en cours...' : 'Uploader et analyser'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Info Section */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="text-slate-900 text-lg">Que se passe-t-il ensuite?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                    1
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Analyse du PDF</p>
                  <p className="text-sm text-slate-600">
                    Notre IA extrait les informations du devis
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                    2
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Comparaison avec le CCF</p>
                  <p className="text-sm text-slate-600">
                    Vérification de la conformité par rapport à votre cahier des charges
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                    3
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Rapport détaillé</p>
                  <p className="text-sm text-slate-600">
                    Score de conformité, alertes et recommandations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default QuoteUploadPage;
