/**
 * Génération de QR codes pour les tickets TORP
 */

import QRCode from 'qrcode';

export interface QRCodeOptions {
  url: string;
  size?: number;           // Taille en pixels (défaut: 200)
  margin?: number;         // Marge (défaut: 2)
  darkColor?: string;      // Couleur modules (défaut: #1E3A5F)
  lightColor?: string;     // Couleur fond (défaut: #FFFFFF)
}

export interface QRCodeResult {
  dataUrl: string;         // Data URL base64 pour affichage
  buffer: Uint8Array;      // Uint8Array pour inclusion dans PDF (compatible navigateur)
  svg: string;             // Version SVG
}

/**
 * Génère un QR code sous différents formats
 */
export async function generateQRCode(options: QRCodeOptions): Promise<QRCodeResult> {
  const {
    url,
    size = 200,
    margin = 2,
    darkColor = '#1E3A5F',  // Bleu TORP
    lightColor = '#FFFFFF',
  } = options;

  const qrOptions = {
    width: size,
    margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
    errorCorrectionLevel: 'M' as const,  // Medium correction pour logo optionnel
  };

  // Générer en PNG (data URL) pour affichage web
  const dataUrl = await QRCode.toDataURL(url, qrOptions);

  // Convertir data URL en Uint8Array (pour PDF - compatible navigateur)
  // Data URL format: "data:image/png;base64,iVBORw0KG..."
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Générer en SVG
  const svg = await QRCode.toString(url, {
    type: 'svg',
    width: size,
    margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });

  return {
    dataUrl,
    buffer: bytes,
    svg,
  };
}

/**
 * Génère uniquement le data URL (plus léger pour affichage rapide)
 */
export async function generateQRCodeDataUrl(url: string, size = 200): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    color: {
      dark: '#1E3A5F',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
}
