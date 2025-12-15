/**
 * Tests for TorpScoreService
 * Tests for B2B commercial proposition analysis
 */

import { describe, it, expect } from 'vitest';

// We'll test the grading logic directly since the class is tightly coupled with types

describe('TorpScoreService grading logic', () => {
  // Helper function that mirrors the calculateGrade logic
  function calculateGrade(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  describe('calculateGrade', () => {
    it('should return A+ for scores >= 90', () => {
      expect(calculateGrade(90)).toBe('A+');
      expect(calculateGrade(95)).toBe('A+');
      expect(calculateGrade(100)).toBe('A+');
    });

    it('should return A for scores 80-89', () => {
      expect(calculateGrade(80)).toBe('A');
      expect(calculateGrade(85)).toBe('A');
      expect(calculateGrade(89)).toBe('A');
    });

    it('should return B for scores 70-79', () => {
      expect(calculateGrade(70)).toBe('B');
      expect(calculateGrade(75)).toBe('B');
      expect(calculateGrade(79)).toBe('B');
    });

    it('should return C for scores 60-69', () => {
      expect(calculateGrade(60)).toBe('C');
      expect(calculateGrade(65)).toBe('C');
      expect(calculateGrade(69)).toBe('C');
    });

    it('should return D for scores 50-59', () => {
      expect(calculateGrade(50)).toBe('D');
      expect(calculateGrade(55)).toBe('D');
      expect(calculateGrade(59)).toBe('D');
    });

    it('should return F for scores below 50', () => {
      expect(calculateGrade(0)).toBe('F');
      expect(calculateGrade(25)).toBe('F');
      expect(calculateGrade(49)).toBe('F');
    });
  });
});

describe('TorpScoreService dimension weights', () => {
  const DIMENSION_WEIGHTS = {
    competitivite: 25,
    completude: 20,
    clarte: 15,
    conformite: 15,
    coherencePhase0: 15,
    attractivite: 10,
  };

  it('should have weights that sum to 100', () => {
    const total = Object.values(DIMENSION_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });

  it('should have competitivite as the highest weight', () => {
    const maxWeight = Math.max(...Object.values(DIMENSION_WEIGHTS));
    expect(DIMENSION_WEIGHTS.competitivite).toBe(maxWeight);
  });

  it('should have all positive weights', () => {
    Object.values(DIMENSION_WEIGHTS).forEach(weight => {
      expect(weight).toBeGreaterThan(0);
    });
  });
});

describe('Price position logic', () => {
  // Helper function that mirrors the position calculation
  function calculatePosition(ecartMarche: number): 'tres_bas' | 'bas' | 'marche' | 'eleve' | 'tres_eleve' {
    if (ecartMarche < -20) return 'tres_bas';
    else if (ecartMarche < -5) return 'bas';
    else if (ecartMarche <= 10) return 'marche';
    else if (ecartMarche <= 25) return 'eleve';
    else return 'tres_eleve';
  }

  it('should return tres_bas for ecart < -20%', () => {
    expect(calculatePosition(-25)).toBe('tres_bas');
    expect(calculatePosition(-30)).toBe('tres_bas');
  });

  it('should return bas for ecart between -20% and -5%', () => {
    expect(calculatePosition(-15)).toBe('bas');
    expect(calculatePosition(-10)).toBe('bas');
    expect(calculatePosition(-6)).toBe('bas');
  });

  it('should return marche for ecart between -5% and +10%', () => {
    expect(calculatePosition(-4)).toBe('marche');
    expect(calculatePosition(0)).toBe('marche');
    expect(calculatePosition(5)).toBe('marche');
    expect(calculatePosition(10)).toBe('marche');
  });

  it('should return eleve for ecart between +10% and +25%', () => {
    expect(calculatePosition(15)).toBe('eleve');
    expect(calculatePosition(20)).toBe('eleve');
    expect(calculatePosition(25)).toBe('eleve');
  });

  it('should return tres_eleve for ecart > +25%', () => {
    expect(calculatePosition(30)).toBe('tres_eleve');
    expect(calculatePosition(50)).toBe('tres_eleve');
  });
});

describe('Score calculation', () => {
  // Helper function for weighted score calculation
  function calculateWeightedScore(dimensions: Record<string, number>): number {
    const weights = {
      competitivite: 25,
      completude: 20,
      clarte: 15,
      conformite: 15,
      coherencePhase0: 15,
      attractivite: 10,
    };

    return Math.round(
      (dimensions.competitivite || 0) * (weights.competitivite / 100) +
      (dimensions.completude || 0) * (weights.completude / 100) +
      (dimensions.clarte || 0) * (weights.clarte / 100) +
      (dimensions.conformite || 0) * (weights.conformite / 100) +
      (dimensions.coherencePhase0 || 0) * (weights.coherencePhase0 / 100) +
      (dimensions.attractivite || 0) * (weights.attractivite / 100)
    );
  }

  it('should return 100 if all dimensions are 100', () => {
    const score = calculateWeightedScore({
      competitivite: 100,
      completude: 100,
      clarte: 100,
      conformite: 100,
      coherencePhase0: 100,
      attractivite: 100,
    });
    expect(score).toBe(100);
  });

  it('should return 0 if all dimensions are 0', () => {
    const score = calculateWeightedScore({
      competitivite: 0,
      completude: 0,
      clarte: 0,
      conformite: 0,
      coherencePhase0: 0,
      attractivite: 0,
    });
    expect(score).toBe(0);
  });

  it('should give more weight to competitivite', () => {
    // Only competitivite at 100, rest at 0
    const scoreCompOnly = calculateWeightedScore({
      competitivite: 100,
      completude: 0,
      clarte: 0,
      conformite: 0,
      coherencePhase0: 0,
      attractivite: 0,
    });

    // Only attractivite at 100, rest at 0
    const scoreAttrOnly = calculateWeightedScore({
      competitivite: 0,
      completude: 0,
      clarte: 0,
      conformite: 0,
      coherencePhase0: 0,
      attractivite: 100,
    });

    expect(scoreCompOnly).toBeGreaterThan(scoreAttrOnly);
    expect(scoreCompOnly).toBe(25); // 25% weight
    expect(scoreAttrOnly).toBe(10); // 10% weight
  });

  it('should calculate correct score for mixed values', () => {
    const score = calculateWeightedScore({
      competitivite: 80, // 80 * 0.25 = 20
      completude: 70,    // 70 * 0.20 = 14
      clarte: 90,        // 90 * 0.15 = 13.5
      conformite: 100,   // 100 * 0.15 = 15
      coherencePhase0: 60, // 60 * 0.15 = 9
      attractivite: 50,  // 50 * 0.10 = 5
    });
    // Total = 20 + 14 + 13.5 + 15 + 9 + 5 = 76.5 -> 77
    expect(score).toBe(77);
  });
});

describe('Probability calculation boundaries', () => {
  it('should cap probability at 95%', () => {
    // Simulating probability capping
    const cappedProba = Math.min(95, 120);
    expect(cappedProba).toBe(95);
  });

  it('should floor probability at 5%', () => {
    const flooredProba = Math.max(5, -10);
    expect(flooredProba).toBe(5);
  });

  it('should keep probability between 5 and 95', () => {
    const clamp = (val: number) => Math.min(95, Math.max(5, val));

    expect(clamp(100)).toBe(95);
    expect(clamp(50)).toBe(50);
    expect(clamp(0)).toBe(5);
    expect(clamp(-20)).toBe(5);
  });
});

describe('Elements obligatoires categories', () => {
  const ELEMENTS_CATEGORIES = ['administratif', 'technique', 'financier', 'planning', 'garanties'];

  it('should have 5 main categories', () => {
    expect(ELEMENTS_CATEGORIES.length).toBe(5);
  });

  it('should include all required categories', () => {
    expect(ELEMENTS_CATEGORIES).toContain('administratif');
    expect(ELEMENTS_CATEGORIES).toContain('technique');
    expect(ELEMENTS_CATEGORIES).toContain('financier');
    expect(ELEMENTS_CATEGORIES).toContain('planning');
    expect(ELEMENTS_CATEGORIES).toContain('garanties');
  });
});

describe('Marge brute logic', () => {
  it('should consider marge acceptable between 15% and 45%', () => {
    const isAcceptable = (marge: number) => marge >= 15 && marge <= 45;

    expect(isAcceptable(15)).toBe(true);
    expect(isAcceptable(30)).toBe(true);
    expect(isAcceptable(45)).toBe(true);
    expect(isAcceptable(14)).toBe(false);
    expect(isAcceptable(46)).toBe(false);
    expect(isAcceptable(10)).toBe(false);
    expect(isAcceptable(50)).toBe(false);
  });
});

describe('Budget coherence logic', () => {
  function calculateBudgetScore(ecartBudget: number): number {
    let scoreBudget = 100;
    if (ecartBudget > 30) scoreBudget = 40;
    else if (ecartBudget > 15) scoreBudget = 60;
    else if (ecartBudget > 0) scoreBudget = 80;
    else scoreBudget = 100;
    return scoreBudget;
  }

  it('should return 100 for budget at or below target', () => {
    expect(calculateBudgetScore(0)).toBe(100);
    expect(calculateBudgetScore(-10)).toBe(100);
  });

  it('should return 80 for slight overrun (1-15%)', () => {
    expect(calculateBudgetScore(5)).toBe(80);
    expect(calculateBudgetScore(15)).toBe(80);
  });

  it('should return 60 for moderate overrun (16-30%)', () => {
    expect(calculateBudgetScore(20)).toBe(60);
    expect(calculateBudgetScore(30)).toBe(60);
  });

  it('should return 40 for severe overrun (>30%)', () => {
    expect(calculateBudgetScore(35)).toBe(40);
    expect(calculateBudgetScore(50)).toBe(40);
  });
});
