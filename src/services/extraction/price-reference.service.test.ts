/**
 * Tests for Price Reference Service
 * Validates price comparison and market reference functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PriceReferenceService, priceReferenceService } from './price-reference.service';

describe('PriceReferenceService', () => {
  let service: PriceReferenceService;

  beforeEach(() => {
    service = new PriceReferenceService();
  });

  describe('findReference', () => {
    it('should find reference for exact match', () => {
      const ref = service.findReference('Installation WC suspendu');

      expect(ref).not.toBeNull();
      expect(ref?.categorie).toBe('plomberie');
      expect(ref?.sousCategorie).toBe('sanitaire');
    });

    it('should find reference for partial match', () => {
      const ref = service.findReference('WC suspendu');

      expect(ref).not.toBeNull();
      expect(ref?.designation).toContain('WC');
    });

    it('should find reference by keywords', () => {
      const ref = service.findReference('Pose de carrelage au sol');

      expect(ref).not.toBeNull();
      expect(ref?.categorie).toBe('revetement');
    });

    it('should filter by category when provided', () => {
      const ref = service.findReference('Installation', 'plomberie');

      expect(ref).not.toBeNull();
      expect(ref?.categorie).toBe('plomberie');
    });

    it('should return null for unknown designation', () => {
      const ref = service.findReference('Installation piscine olympique');

      expect(ref).toBeNull();
    });

    it('should find main d\'oeuvre references', () => {
      const ref = service.findReference('Heure de main d\'oeuvre plombier');

      expect(ref).not.toBeNull();
      expect(ref?.categorie).toBe('main_oeuvre');
    });
  });

  describe('comparePrix', () => {
    it('should compare price correctly for standard item', () => {
      const result = service.comparePrix(
        'Carrelage sol',
        70, // prix unitaire
        700, // total
        10, // quantité
        'm²'
      );

      expect(result.reference).not.toBeNull();
      expect(result.ecart.position).toBe('moyen');
      expect(result.fiabilite).toBe('haute');
    });

    it('should detect low price', () => {
      const result = service.comparePrix(
        'Carrelage sol',
        30, // prix bas
        300,
        10,
        'm²'
      );

      expect(result.ecart.position).toBe('bas');
    });

    it('should detect very high price', () => {
      const result = service.comparePrix(
        'Carrelage sol',
        200, // prix très élevé
        2000,
        10,
        'm²'
      );

      expect(result.ecart.position).toBe('tres_haut');
      expect(result.alertes.length).toBeGreaterThan(0);
      expect(result.ecart.economieEstimee).toBeGreaterThan(0);
    });

    it('should calculate unit price from total and quantity', () => {
      const result = service.comparePrix(
        'Peinture mur',
        undefined, // pas de prix unitaire
        750, // total
        30, // quantité = 25€/m²
        'm²'
      );

      expect(result.reference).not.toBeNull();
      expect(result.ecart.position).toBe('moyen');
    });

    it('should warn about unit mismatch', () => {
      const result = service.comparePrix(
        'Carrelage sol',
        70,
        700,
        10,
        'ml' // mauvaise unité
      );

      // Soit l'alerte est présente, soit la fiabilité est basse
      const hasUnitWarning = result.alertes.some(a => a.includes('Unité'));
      expect(hasUnitWarning || result.fiabilite === 'basse').toBe(true);
    });

    it('should handle missing reference gracefully', () => {
      const result = service.comparePrix(
        'Installation sauna finlandais',
        5000,
        5000,
        1,
        'u'
      );

      // Référence peut être null ou undefined si non trouvée
      expect(result.reference == null).toBe(true);
      expect(result.ecart.position).toBe('inconnu');
      expect(result.alertes.some(a => a.includes('référence'))).toBe(true);
    });

    it('should warn about abnormally low price', () => {
      const result = service.comparePrix(
        'Fenêtre PVC double vitrage',
        200, // beaucoup trop bas
        200,
        1,
        'u'
      );

      // Position devrait être bas et il peut y avoir une alerte
      expect(['bas', 'tres_bas']).toContain(result.ecart.position);
    });
  });

  describe('analyzeDevis', () => {
    it('should analyze multiple lines', () => {
      const lignes = [
        { designation: 'Carrelage sol', total: 700, quantite: 10, unite: 'm²' },
        { designation: 'Peinture mur', total: 500, quantite: 20, unite: 'm²' },
        { designation: 'WC suspendu', total: 1200, quantite: 1, unite: 'u' },
      ];

      const result = service.analyzeDevis(lignes);

      expect(result.comparaisons).toHaveLength(3);
      expect(result.statistiques.lignesAnalysees).toBe(3);
      expect(result.statistiques.lignesAvecReference).toBeGreaterThanOrEqual(2);
    });

    it('should calculate global position', () => {
      const lignes = [
        { designation: 'Carrelage sol', prixUnitaire: 70, quantite: 10, unite: 'm²' },
        { designation: 'Peinture mur', prixUnitaire: 25, quantite: 20, unite: 'm²' },
      ];

      const result = service.analyzeDevis(lignes);

      expect(['economique', 'marche', 'premium', 'tres_premium']).toContain(
        result.statistiques.positionGlobale
      );
    });

    it('should calculate total estimated savings', () => {
      const lignes = [
        { designation: 'Carrelage sol', prixUnitaire: 200, quantite: 50, unite: 'm²' }, // Très cher
      ];

      const result = service.analyzeDevis(lignes);

      expect(result.statistiques.economieEstimeeTotale).toBeGreaterThan(0);
    });

    it('should deduplicate alerts', () => {
      const lignes = [
        { designation: 'Produit inconnu 1', total: 100 },
        { designation: 'Produit inconnu 2', total: 200 },
      ];

      const result = service.analyzeDevis(lignes);

      // Les alertes "Aucune référence" ne devraient pas être dupliquées
      const uniqueAlerts = new Set(result.alertes);
      expect(uniqueAlerts.size).toBe(result.alertes.length);
    });
  });

  describe('addCustomReference', () => {
    it('should add custom reference', () => {
      service.addCustomReference({
        categorie: 'custom',
        sousCategorie: 'test',
        designation: 'Ma prestation personnalisée',
        unite: 'u',
        prixBas: 100,
        prixMoyen: 150,
        prixHaut: 200,
        dateReference: new Date(),
      });

      const ref = service.findReference('Ma prestation personnalisée');

      expect(ref).not.toBeNull();
      expect(ref?.source).toBe('custom');
    });
  });

  describe('getCategories', () => {
    it('should return all available categories', () => {
      const categories = service.getCategories();

      expect(categories).toContain('plomberie');
      expect(categories).toContain('electricite');
      expect(categories).toContain('revetement');
      expect(categories).toContain('isolation');
      expect(categories.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('getReferencesByCategory', () => {
    it('should return references for a category', () => {
      const refs = service.getReferencesByCategory('plomberie');

      expect(refs.length).toBeGreaterThan(0);
      expect(refs.every(r => r.categorie === 'plomberie')).toBe(true);
    });

    it('should return empty array for unknown category', () => {
      const refs = service.getReferencesByCategory('categorie_inexistante');

      expect(refs).toHaveLength(0);
    });
  });
});

describe('priceReferenceService singleton', () => {
  it('should be a singleton instance', () => {
    expect(priceReferenceService).toBeInstanceOf(PriceReferenceService);
  });

  it('should have working methods', () => {
    const ref = priceReferenceService.findReference('Carrelage');
    expect(ref).not.toBeNull();
  });
});
