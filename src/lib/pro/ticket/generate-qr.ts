/**
 * Génération de QR codes pour les tickets TORP
 * Utilise la librairie qrcode
 */

import QRCode from 'qrcode';

export interface QRCodeOptions {
  url: string;
  size?: number;           // Taille en pixels (défaut: 200)
  margin?: number;         // Marge (défaut: 2)
  darkColor?: string;      // Couleur modules (défaut: #1E3A5F)
  lightColor?: string;     // Couleur fond (défaut: #FFFFFF)
  logoUrl?: string;        // Logo au centre (optionnel)
}

export interface QRCodeResult {
  dataUrl: string;         // Data URL base64 pour affichage
  buffer: Buffer;          // Buffer pour inclusion dans PDF
  svg: string;             // Version SVG
}

/**
 * Génère un QR code aux formats PNG, Buffer et SVG
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
    errorCorrectionLevel: 'M' as const,  // Medium correction
  };

  try {
    // Générer en PNG (data URL) pour affichage web
    const dataUrl = await QRCode.toDataURL(url, qrOptions);

    // Générer en Buffer (pour PDF)
    const buffer = await QRCode.toBuffer(url, qrOptions);

    // Générer en SVG
    const svg = await QRCode.toString(url, {
      type: 'svg',
      ...qrOptions,
    });

    return { dataUrl, buffer, svg };
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Génère uniquement le buffer PNG (plus rapide pour PDF)
 */
export async function generateQRCodeBuffer(
  url: string,
  size: number = 200
): Promise<Buffer> {
  try {
    return await QRCode.toBuffer(url, {
      width: size,
      margin: 2,
      color: {
        dark: '#1E3A5F',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw new Error('Failed to generate QR code buffer');
  }
}

/**
 * Génère uniquement la data URL (pour affichage)
 */
export async function generateQRCodeDataUrl(
  url: string,
  size: number = 200
): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: {
        dark: '#1E3A5F',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (error) {
    console.error('Error generating QR code data URL:', error);
    throw new Error('Failed to generate QR code data URL');
  }
}
