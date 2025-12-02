/**
 * Module de génération de tickets TORP
 * Export centralisé
 */

export { generateTicketCode, validateTicketCode } from './generate-code';
export type { TicketCode } from './generate-code';

export { generateQRCode, generateQRCodeDataUrl } from './generate-qr';
export type { QRCodeOptions, QRCodeResult } from './generate-qr';

export { generateTicketPDF } from './generate-pdf';
export type { TicketData, TicketPDFResult } from './generate-pdf';

export { generateTicket, getTicketInfo } from './ticket-service';
export type { GenerateTicketResult } from './ticket-service';
