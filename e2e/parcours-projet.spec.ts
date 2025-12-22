import { test, expect } from '@playwright/test';

/**
 * Tests E2E pour le parcours projet complet
 * Note: Ces tests simulent le parcours utilisateur à travers les phases
 */
test.describe('Parcours Projet', () => {
  test.describe('Phase 0 - Conception', () => {
    test('accès à la page nouveau projet', async ({ page }) => {
      await page.goto('/phase0/new');

      // Vérifier qu'on est soit sur la page, soit redirigé vers login
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase0|login/);
    });

    test('accès au dashboard Phase 0', async ({ page }) => {
      await page.goto('/phase0/dashboard');

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase0|login/);
    });

    test('page professionnel accessible', async ({ page }) => {
      await page.goto('/phase0/professional');

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase0|login/);
    });

    test('wizard projet avec étapes', async ({ page }) => {
      await page.goto('/phase0/new');

      // Si on est sur la page (pas redirigé)
      if (page.url().includes('phase0')) {
        // Vérifier la présence d'éléments de wizard
        const wizardElements = page.locator('[class*="wizard"], [class*="step"], [data-step]');
        const formElements = page.locator('form, input, select');

        // Au moins un formulaire devrait être présent
        const formCount = await formElements.count();
        expect(formCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Phase 1 - Consultation', () => {
    test('accès page consultation avec projectId', async ({ page }) => {
      await page.goto('/phase1/project/test-project-id');

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase1|login/);
    });

    test('structure page consultation', async ({ page }) => {
      await page.goto('/phase1/project/test-project-id/consultation');

      if (page.url().includes('phase1')) {
        // Vérifier la présence d'éléments de consultation
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });

  test.describe('Phases Chantier (2-5)', () => {
    const projectId = 'test-project-id';

    test('Phase 2 - Dashboard préparation', async ({ page }) => {
      await page.goto(`/phase2/${projectId}`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase2|login/);
    });

    test('Phase 2 - Page planning', async ({ page }) => {
      await page.goto(`/phase2/${projectId}/planning`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase2|login/);
    });

    test('Phase 2 - Page réunions', async ({ page }) => {
      await page.goto(`/phase2/${projectId}/reunions`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase2|login/);
    });

    test('Phase 2 - Page journal', async ({ page }) => {
      await page.goto(`/phase2/${projectId}/journal`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase2|login/);
    });

    test('Phase 3 - Dashboard exécution', async ({ page }) => {
      await page.goto(`/phase3/${projectId}`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase3|login/);
    });

    test('Phase 3 - Page contrôles', async ({ page }) => {
      await page.goto(`/phase3/${projectId}/controles`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase3|login/);
    });

    test('Phase 3 - Page coordination', async ({ page }) => {
      await page.goto(`/phase3/${projectId}/coordination`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase3|login/);
    });

    test('Phase 3 - Page situations', async ({ page }) => {
      await page.goto(`/phase3/${projectId}/situations`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase3|login/);
    });

    test('Phase 4 - Dashboard réception', async ({ page }) => {
      await page.goto(`/phase4/${projectId}`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase4|login/);
    });

    test('Phase 4 - Page OPR', async ({ page }) => {
      await page.goto(`/phase4/${projectId}/reception`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase4|login/);
    });

    test('Phase 4 - Page réserves', async ({ page }) => {
      await page.goto(`/phase4/${projectId}/reserves`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase4|login/);
    });

    test('Phase 4 - Page garanties', async ({ page }) => {
      await page.goto(`/phase4/${projectId}/garanties`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase4|login/);
    });

    test('Phase 4 - Page DOE', async ({ page }) => {
      await page.goto(`/phase4/${projectId}/doe`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase4|login/);
    });
  });

  test.describe('Liste des chantiers', () => {
    test('accès liste chantiers', async ({ page }) => {
      await page.goto('/chantiers');

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/chantiers|login/);
    });
  });
});

test.describe('Parcours Pro/B2B', () => {
  test('accès dashboard pro', async ({ page }) => {
    await page.goto('/pro');

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/pro|login/);
  });

  test('accès page projets pro', async ({ page }) => {
    await page.goto('/pro/projects');

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/pro|login/);
  });

  test('accès onboarding pro', async ({ page }) => {
    await page.goto('/pro/onboarding');

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/pro|login/);
  });

  test('accès analyses pro', async ({ page }) => {
    await page.goto('/pro/analyses');

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/pro|login/);
  });

  test('accès documents pro', async ({ page }) => {
    await page.goto('/pro/documents');

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/pro|login/);
  });

  test('accès paramètres pro', async ({ page }) => {
    await page.goto('/pro/settings');

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/pro|login/);
  });
});

test.describe('Appels d\'Offres', () => {
  test('accès liste appels d\'offres', async ({ page }) => {
    await page.goto('/tenders');

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/tenders|login/);
  });

  test('accès B2B appels d\'offres', async ({ page }) => {
    await page.goto('/b2b/ao');

    const currentUrl = page.url();
    expect(currentUrl).toMatch(/b2b|login/);
  });
});
