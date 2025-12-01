/**
 * TORP B2B - Détail d'une Analyse
 * @route /pro/analysis/:id
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Construction } from 'lucide-react';

export default function ProAnalysisDetail() {
  const navigate = useNavigate();
  const { userType } = useApp();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (userType !== 'B2B') {
      navigate('/dashboard');
    }
  }, [userType, navigate]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/pro/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au dashboard
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <Construction className="w-8 h-8 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl">Page en construction</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              La page de détail d'analyse (ID: {id}) sera bientôt disponible.
            </p>
            <p className="text-sm text-muted-foreground">
              Vous pourrez y consulter :
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 text-left max-w-md mx-auto">
              <li>• Score TORP détaillé (4 axes)</li>
              <li>• Grade et recommandations</li>
              <li>• Génération du ticket TORP</li>
              <li>• Historique des versions</li>
            </ul>
            <Button onClick={() => navigate('/pro/dashboard')}>
              Retour au dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
