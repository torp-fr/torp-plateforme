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

  console.log('[QR] 🔲 Génération QR code pour URL:', url);

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
  console.log('[QR] ✓ Data URL généré, longueur:', dataUrl.length);

  // Convertir data URL en Uint8Array (pour PDF - compatible navigateur)
  // Data URL format: "data:image/png;base64,iVBORw0KG..."
  const base64Data = dataUrl.split(',')[1];
  console.log('[QR] ✓ Base64 extrait, longueur:', base64Data.length);

  const binaryString = atob(base64Data);
  console.log('[QR] ✓ Décodé en binaire, longueur:', binaryString.length);

  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Vérifier la signature PNG (89 50 4E 47 = PNG)
  const pngSignature = [0x89, 0x50, 0x4E, 0x47];
  const isValidPng = pngSignature.every((byte, i) => bytes[i] === byte);

  if (!isValidPng) {
    console.error('[QR] ❌ ERREUR: Les bytes ne correspondent pas à un PNG valide !');
    console.error('[QR] Premiers bytes:', Array.from(bytes.slice(0, 8)));
    console.error('[QR] Attendu:', pngSignature);
  } else {
    console.log('[QR] ✅ Signature PNG valide');
  }

  console.log('[QR] Buffer PNG créé:', bytes.length, 'bytes');

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

  console.log('[QR] ✅ QR code complet généré (PNG + SVG)');

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
