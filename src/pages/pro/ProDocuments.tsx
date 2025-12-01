/**
 * TORP B2B - Gestion des Documents Entreprise
 * @route /pro/documents
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Construction } from 'lucide-react';

export default function ProDocuments() {
  const navigate = useNavigate();
  const { userType } = useApp();

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
              La page de gestion des documents sera bientôt disponible.
            </p>
            <p className="text-sm text-muted-foreground">
              Vous pourrez y gérer :
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 text-left max-w-md mx-auto">
              <li>• KBIS</li>
              <li>• Attestations URSSAF et Vigilance</li>
              <li>• Assurances (décennale, RC Pro)</li>
              <li>• Certifications (Qualibat, RGE, etc.)</li>
              <li>• Alertes d'expiration</li>
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
