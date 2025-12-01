/**
 * Ticket Verification Component
 * Permet aux utilisateurs de saisir ou scanner un code ticket TORP
 * pour accéder à l'analyse de leur devis
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { QrCode, Search, X, Camera } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

export const TicketVerification = () => {
  const navigate = useNavigate();
  const [ticketCode, setTicketCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!ticketCode.trim()) {
      setError('Veuillez entrer un code de vérification');
      return;
    }

    // Rediriger vers la page publique du ticket
    navigate(`/t/${ticketCode.trim()}`);
  };

  const handleScanSuccess = (decodedText: string) => {
    console.log('QR Code scanné:', decodedText);

    // Extraire le code du ticket depuis l'URL ou le texte
    let code = decodedText;

    // Si c'est une URL complète (https://domain.com/t/CODE), extraire le code
    if (decodedText.includes('/t/')) {
      const match = decodedText.match(/\/t\/([^/?]+)/);
      if (match) {
        code = match[1];
      }
    }

    // Arrêter le scanner
    stopScanner();

    // Rediriger vers la page du ticket
    navigate(`/t/${code}`);
  };

  const handleScanError = (errorMessage: string) => {
    // Ignorer les erreurs de scan normales (pas de QR code détecté)
    // Seulement logger les erreurs critiques
    if (!errorMessage.includes('NotFoundException')) {
      console.warn('Erreur scan QR:', errorMessage);
    }
  };

  const startScanner = async () => {
    try {
      setError(null);
      setScanning(true);

      // Créer l'instance du scanner
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      // Démarrer le scanner avec la caméra arrière (environnement)
      await html5QrCode.start(
        { facingMode: 'environment' }, // Caméra arrière
        {
          fps: 10, // Images par seconde
          qrbox: { width: 250, height: 250 }, // Zone de scan
        },
        handleScanSuccess,
        handleScanError
      );
    } catch (err) {
      console.error('Erreur démarrage scanner:', err);
      setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      } catch (err) {
        console.error('Erreur arrêt scanner:', err);
      }
    }
    setScanning(false);
    setScannerOpen(false);
  };

  const handleOpenScanner = () => {
    setScannerOpen(true);
  };

  const handleCloseScanner = () => {
    stopScanner();
  };

  useEffect(() => {
    // Démarrer le scanner quand le dialog s'ouvre
    if (scannerOpen && !scanning) {
      startScanner();
    }

    // Cleanup: arrêter le scanner quand le composant se démonte
    return () => {
      if (scannerRef.current) {
        stopScanner();
      }
    };
  }, [scannerOpen]);

  return (
    <section className="py-16 lg:py-20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-xl border-2">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <QrCode className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl md:text-3xl">
                Vous avez reçu un code TORP ?
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Accédez à l'analyse complète de votre devis en quelques secondes
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Formulaire de saisie */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="ticket-code" className="text-sm font-medium block mb-2">
                    Code de vérification
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="ticket-code"
                      type="text"
                      placeholder="Ex: TORP-ABC123"
                      value={ticketCode}
                      onChange={(e) => {
                        setTicketCode(e.target.value);
                        setError(null);
                      }}
                      className="flex-1 h-12 text-base"
                      autoComplete="off"
                    />
                    <Button type="submit" size="lg" className="h-12 px-6">
                      <Search className="w-5 h-5 mr-2" />
                      Consulter
                    </Button>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 mt-2">{error}</p>
                  )}
                </div>
              </form>

              {/* Séparateur */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-background text-muted-foreground">ou</span>
                </div>
              </div>

              {/* Bouton scanner QR */}
              <div className="text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleOpenScanner}
                  className="w-full h-14 text-base border-2 border-dashed hover:border-primary hover:bg-primary/5"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Scanner le QR code
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Le QR code se trouve sur votre ticket TORP ou dans l'email reçu
                </p>
              </div>

              {/* Info supplémentaire */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Où trouver mon code TORP ?
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Sur le ticket TORP remis par l'entreprise avec votre devis</li>
                  <li>• Dans l'email de confirmation envoyé après l'analyse</li>
                  <li>• Format: TORP-XXXXXX (6 caractères alphanumériques)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog Scanner QR */}
      <Dialog open={scannerOpen} onOpenChange={handleCloseScanner}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Scanner le QR code
            </DialogTitle>
            <DialogDescription>
              Positionnez le QR code dans le cadre pour scanner
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Zone de scan */}
            <div className="relative bg-black rounded-lg overflow-hidden">
              <div id={scannerContainerId} className="w-full min-h-[300px]"></div>

              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center text-white">
                    <Camera className="w-12 h-12 mx-auto mb-3 animate-pulse" />
                    <p>Initialisation de la caméra...</p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Instructions */}
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Assurez-vous que le QR code est bien éclairé</p>
              <p>• Maintenez votre appareil stable</p>
              <p>• Le scan est automatique une fois détecté</p>
            </div>

            <Button
              variant="outline"
              onClick={handleCloseScanner}
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
