/**
 * Test d'extraction OCR avec le devis fictif
 * Ce fichier permet de tester le moteur d'analyse sans appeler l'API Vision
 */

import { extractDevisDataMock } from '../ocr';
import { readFileSync } from 'fs';
import { join } from 'path';

// Lire le devis fictif
const sampleDevisPath = join(__dirname, 'sample-devis.txt');
const sampleDevisText = readFileSync(sampleDevisPath, 'utf-8');

// Tester l'extraction
console.log('=== TEST D\'EXTRACTION OCR ===\n');
console.log('Texte source:');
console.log(sampleDevisText);
console.log('\n' + '='.repeat(80) + '\n');

const extractedData = extractDevisDataMock(sampleDevisText);

console.log('=== DONNÉES EXTRAITES ===\n');

console.log('Entreprise:');
console.log('- Raison sociale:', extractedData.entreprise.raisonSociale || 'Non détecté');
console.log('- SIRET:', extractedData.entreprise.siret || 'Non détecté');
console.log('- Forme juridique:', extractedData.entreprise.formeJuridique || 'Non détecté');
console.log('- Adresse:', extractedData.entreprise.adresse || 'Non détecté');
console.log('- Téléphone:', extractedData.entreprise.telephone || 'Non détecté');
console.log('- Email:', extractedData.entreprise.email || 'Non détecté');
console.log('- RCS:', extractedData.entreprise.rcs || 'Non détecté');
console.log('- TVA Intra:', extractedData.entreprise.tvaIntra || 'Non détecté');
console.log('- Capital:', extractedData.entreprise.capitalSocial || 'Non détecté');

console.log('\nAssurances:');
console.log('- Décennale N°:', extractedData.assurances.decennale?.numero || 'Non détecté');
console.log('- Assureur:', extractedData.assurances.decennale?.assureur || 'Non détecté');

console.log('\nDevis:');
console.log('- Numéro:', extractedData.devis.numero || 'Non détecté');
console.log('- Date:', extractedData.devis.date || 'Non détecté');
console.log('- Validité:', extractedData.devis.validite || 'Non détecté');
console.log('- Objet:', extractedData.devis.objet || 'Non détecté');

console.log('\nClient:');
console.log('- Nom:', extractedData.client.nom || 'Non détecté');
console.log('- Adresse:', extractedData.client.adresse || 'Non détecté');

console.log('\nFinancier:');
console.log('- Montant HT:', extractedData.financier.montantHT ? `${extractedData.financier.montantHT}€` : 'Non détecté');
console.log('- Montant TTC:', extractedData.financier.montantTTC ? `${extractedData.financier.montantTTC}€` : 'Non détecté');
console.log('- Montant TVA:', extractedData.financier.montantTVA ? `${extractedData.financier.montantTVA}€` : 'Non détecté');
console.log('- Taux TVA:', extractedData.financier.tauxTVA || 'Non détecté');
console.log('- Acompte:', extractedData.financier.acompte ? `${extractedData.financier.acompte}€` : extractedData.financier.acomptePourcentage ? `${extractedData.financier.acomptePourcentage}%` : 'Non détecté');

console.log('\nLignes de prestation:');
console.log(`- ${extractedData.lignes.length} ligne(s) détectée(s)`);
extractedData.lignes.forEach((ligne, index) => {
  console.log(`  ${index + 1}. ${ligne.designation}`);
  if (ligne.quantite) console.log(`     Qté: ${ligne.quantite} ${ligne.unite || ''}`);
  if (ligne.prixUnitaireHT) console.log(`     PU HT: ${ligne.prixUnitaireHT}€`);
  if (ligne.totalLigneHT) console.log(`     Total: ${ligne.totalLigneHT}€`);
});

console.log('\nMentions légales:');
console.log('- CGV:', extractedData.mentionsLegales.cgv ? 'Oui' : 'Non');
console.log('- Droit rétractation:', extractedData.mentionsLegales.droitRetractation ? 'Oui' : 'Non');
console.log('- Médiateur:', extractedData.mentionsLegales.mediateur ? 'Oui' : 'Non');
console.log('- Délai exécution:', extractedData.mentionsLegales.delaiExecution || 'Non mentionné');
console.log('- Garanties:', extractedData.mentionsLegales.garanties?.join(', ') || 'Non mentionnées');

console.log('\nCertifications:');
console.log('- ' + (extractedData.certifications.length > 0 ? extractedData.certifications.join(', ') : 'Aucune détectée'));

console.log('\n=== RÉSULTAT ===');
console.log(`Confiance globale: ${(extractedData.confidence * 100).toFixed(1)}%`);

export { extractedData };
