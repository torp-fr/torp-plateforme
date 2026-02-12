/**
 * Quote Success Page - CCF créé avec succès
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Download, Home, FileText } from 'lucide-react';
import type { CCFData } from '@/components/guided-ccf';

export function QuoteSuccessPage() {
  const navigate = useNavigate();
  const [ccfData, setCCFData] = useState<CCFData | null>(null);

  useEffect(() => {
    const data = localStorage.getItem('currentCCF');
    if (data) {
      setCCFData(JSON.parse(data));
    } else {
      // Pas de CCF, redirect
      navigate('/quote');
    }
  }, [navigate]);

  if (!ccfData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-cyan-50">
      {/* Header */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-blue-100/30 shadow-sm">
        <div className="container mx-auto px-6 h-16 flex items-center">
          <h1 className="text-2xl font-bold text-slate-900">CCF Créé avec Succès</h1>
        </div>
      </header>

      {/* Success Message */}
      <main className="py-12 px-6">
        <div className="container mx-auto max-w-3xl">
          {/* Success Banner */}
          <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              Parfait! Votre CCF est prêt
            </h2>
            <p className="text-slate-600 text-lg">
              Vous pouvez maintenant uploader votre devis pour l'analyse
            </p>
          </div>

          {/* CCF Summary */}
          <Card className="bg-white shadow-md mb-8">
            <CardHeader>
              <CardTitle className="text-slate-900">Résumé du CCF</CardTitle>
              <CardDescription>Voici les informations que vous avez saisies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Project Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Nom du projet</p>
                  <p className="text-lg font-semibold text-slate-900">{ccfData.projectName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Type</p>
                  <p className="text-lg font-semibold text-slate-900 capitalize">{ccfData.projectType}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Budget</p>
                  <p className="text-lg font-semibold text-slate-900">{ccfData.budget.toLocaleString()}€</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Timeline</p>
                  <p className="text-lg font-semibold text-slate-900">{ccfData.timeline}</p>
                </div>
              </div>

              {/* Scope */}
              <div className="border-t pt-6">
                <p className="text-sm text-slate-600 font-medium mb-2">Périmètre du projet</p>
                <p className="text-slate-700 whitespace-pre-wrap">{ccfData.scope}</p>
              </div>

              {/* Objectives */}
              <div className="border-t pt-6">
                <p className="text-sm text-slate-600 font-medium mb-3">Objectifs</p>
                <div className="flex flex-wrap gap-2">
                  {ccfData.objectives.map((obj) => (
                    <Badge key={obj} className="bg-blue-100 text-blue-800">
                      {obj}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Constraints */}
              <div className="border-t pt-6">
                <p className="text-sm text-slate-600 font-medium mb-3">Contraintes</p>
                <div className="flex flex-wrap gap-2">
                  {ccfData.constraints.map((c) => (
                    <Badge key={c} className="bg-orange-100 text-orange-800">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Success Criteria */}
              <div className="border-t pt-6">
                <p className="text-sm text-slate-600 font-medium mb-3">Critères de succès</p>
                <div className="flex flex-wrap gap-2">
                  {ccfData.successCriteria.map((sc) => (
                    <Badge key={sc} className="bg-green-100 text-green-800">
                      {sc}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Contact */}
              {(ccfData.company || ccfData.contacts) && (
                <div className="border-t pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ccfData.company && (
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Entreprise</p>
                        <p className="text-slate-900">{ccfData.company}</p>
                      </div>
                    )}
                    {ccfData.contacts && (
                      <div>
                        <p className="text-sm text-slate-600 font-medium">Contact</p>
                        <p className="text-slate-900">{ccfData.contacts}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card className="bg-blue-50 border-blue-200 shadow-md mb-8">
            <CardHeader>
              <CardTitle className="text-slate-900">Prochaines étapes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    1
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Uploader votre devis</p>
                  <p className="text-sm text-slate-600">
                    Déposez le fichier PDF du devis que vous souhaitez analyser
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    2
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Analyse automatique</p>
                  <p className="text-sm text-slate-600">
                    Notre IA va analyser le devis par rapport à votre CCF
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                    3
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Recevez un rapport</p>
                  <p className="text-sm text-slate-600">
                    Score de conformité, recommandations et alertes détaillées
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/quote-upload')}
              className="text-lg px-8 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
            >
              <FileText className="h-5 w-5 mr-2" />
              Uploader un devis
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="text-lg px-8"
            >
              <Home className="h-5 w-5 mr-2" />
              Retour à l'accueil
            </Button>
          </div>

          {/* Download CCF Option */}
          <div className="text-center mt-8">
            <button
              onClick={() => {
                const dataStr = JSON.stringify(ccfData, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `CCF_${ccfData.projectName}_${new Date().toISOString().split('T')[0]}.json`;
                link.click();
              }}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-2 mx-auto"
            >
              <Download className="h-4 w-4" />
              Télécharger le CCF (JSON)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default QuoteSuccessPage;
