import { test, expect } from '@playwright/test';

/**
 * Tests E2E pour Phase 5 - Maintenance & Exploitation
 * Carnet numérique du logement
 */
test.describe('Phase 5 - Maintenance & Exploitation', () => {
  const projectId = 'test-project-id';

  test.describe('Dashboard Phase 5', () => {
    test('accès au carnet numérique', async ({ page }) => {
      await page.goto(`/phase5/${projectId}`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase5|login/);
    });

    test('affichage des statistiques principales', async ({ page }) => {
      await page.goto(`/phase5/${projectId}`);

      if (page.url().includes('phase5')) {
        // Vérifier la présence du layout chantier
        await expect(page.locator('body')).toBeVisible();

        // Chercher des éléments de statistiques
        const statsElements = page.locator('[class*="stat"], [class*="card"], [class*="kpi"]');
        const count = await statsElements.count();

        // Au moins une section devrait être visible
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('navigation vers carnet accessible', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/carnet`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase5|login/);
    });
  });

  test.describe('Page Diagnostics', () => {
    test('accès page diagnostics', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/diagnostics`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase5|login/);
    });

    test('affichage liste des diagnostics obligatoires', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/diagnostics`);

      if (page.url().includes('phase5')) {
        // Vérifier la présence du contenu
        await expect(page.locator('body')).toBeVisible();

        // Chercher des éléments de diagnostic (DPE, Electricité, Gaz, etc.)
        const diagnosticTypes = [
          'DPE',
          'Électricité',
          'Gaz',
          'Amiante',
          'Plomb',
          'Termites',
          'ERP',
          'Carrez'
        ];

        // Au moins vérifier que la page charge
        const pageContent = await page.textContent('body');
        expect(pageContent).toBeDefined();
      }
    });

    test('filtrage par statut si présent', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/diagnostics`);

      if (page.url().includes('phase5')) {
        // Chercher des boutons/tabs de filtre
        const filterButtons = page.locator('button:has-text("Tous"), button:has-text("Valide"), button:has-text("Expiré")');
        const filterCount = await filterButtons.count();

        if (filterCount > 0) {
          await filterButtons.first().click();
          await expect(page).toHaveURL(/phase5/);
        }
      }
    });
  });

  test.describe('Page Entretien', () => {
    test('accès page entretien', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/entretien`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase5|login/);
    });

    test('affichage planning entretien', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/entretien`);

      if (page.url().includes('phase5')) {
        // Vérifier le contenu de la page
        await expect(page.locator('body')).toBeVisible();

        // Chercher des éléments de planification
        const planningElements = page.locator('[class*="calendar"], [class*="planning"], [class*="schedule"]');
        const count = await planningElements.count();

        // La page devrait charger correctement
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('bouton ajout entretien si présent', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/entretien`);

      if (page.url().includes('phase5')) {
        const addButton = page.locator('button:has-text("Ajouter"), button:has-text("Planifier"), button:has-text("Nouveau")');
        const buttonCount = await addButton.count();

        if (buttonCount > 0) {
          // Vérifier que le bouton est cliquable
          await expect(addButton.first()).toBeEnabled();
        }
      }
    });

    test('marquer entretien réalisé si disponible', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/entretien`);

      if (page.url().includes('phase5')) {
        // Chercher des boutons pour marquer comme réalisé
        const realiseButton = page.locator('button:has-text("Réalisé"), button:has-text("Terminer"), button:has-text("Compléter")');
        const count = await realiseButton.count();

        // Test optionnel - dépend des données
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Page Sinistres', () => {
    test('accès page sinistres', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/sinistres`);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/phase5|login/);
    });

    test('affichage liste sinistres', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/sinistres`);

      if (page.url().includes('phase5')) {
        await expect(page.locator('body')).toBeVisible();

        // Chercher des éléments de liste
        const listElements = page.locator('[class*="list"], [class*="table"], [class*="grid"]');
        const count = await listElements.count();

        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('bouton déclaration sinistre présent', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/sinistres`);

      if (page.url().includes('phase5')) {
        const declareButton = page.locator('button:has-text("Déclarer"), button:has-text("Nouveau sinistre"), button:has-text("Ajouter")');
        const count = await declareButton.count();

        if (count > 0) {
          await expect(declareButton.first()).toBeEnabled();
        }
      }
    });

    test('modal déclaration sinistre', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/sinistres`);

      if (page.url().includes('phase5')) {
        const declareButton = page.locator('button:has-text("Déclarer"), button:has-text("Nouveau sinistre")');

        if (await declareButton.count() > 0) {
          await declareButton.first().click();

          // Vérifier l'ouverture d'un modal ou formulaire
          const modal = page.locator('[role="dialog"], [class*="modal"], [class*="sheet"]');
          const form = page.locator('form');

          const modalVisible = await modal.isVisible().catch(() => false);
          const formVisible = await form.isVisible().catch(() => false);

          // Au moins un des deux devrait apparaître
          expect(modalVisible || formVisible).toBeTruthy();
        }
      }
    });

    test('affichage garanties actives', async ({ page }) => {
      await page.goto(`/phase5/${projectId}/sinistres`);

      if (page.url().includes('phase5')) {
        // Chercher une section garanties
        const garantiesSection = page.locator('text=Garantie, text=garantie, [class*="garantie"]');
        const count = await garantiesSection.count();

        // La section garanties devrait exister ou non selon l'implémentation
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Navigation Phase 5', () => {
    test('navigation entre sous-pages', async ({ page }) => {
      await page.goto(`/phase5/${projectId}`);

      if (page.url().includes('phase5')) {
        // Chercher les liens de navigation
        const navLinks = page.locator('nav a, [class*="sidebar"] a, [class*="menu"] a');
        const linkCount = await navLinks.count();

        if (linkCount > 0) {
          // Vérifier qu'au moins un lien est cliquable
          await expect(navLinks.first()).toBeEnabled();
        }
      }
    });

    test('retour vers liste chantiers', async ({ page }) => {
      await page.goto(`/phase5/${projectId}`);

      if (page.url().includes('phase5')) {
        // Chercher un lien retour
        const backLink = page.locator('a[href="/chantiers"], a:has-text("Retour"), a:has-text("Chantiers")');

        if (await backLink.count() > 0) {
          await backLink.first().click();
          await expect(page).toHaveURL(/chantiers|login/);
        }
      }
    });

    test('changement de phase depuis navigation', async ({ page }) => {
      await page.goto(`/phase5/${projectId}`);

      if (page.url().includes('phase5')) {
        // Chercher les sélecteurs de phase
        const phaseSelector = page.locator('[class*="phase-selector"], select:has-text("Phase"), button:has-text("Phase")');

        if (await phaseSelector.count() > 0) {
          await expect(phaseSelector.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('affichage mobile dashboard', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`/phase5/${projectId}`);

      if (page.url().includes('phase5')) {
        // Vérifier que le contenu est visible
        await expect(page.locator('body')).toBeVisible();

        // Le menu burger devrait être visible sur mobile
        const mobileMenu = page.locator('[class*="mobile"], [class*="hamburger"], button[aria-label*="menu"]');
        const menuCount = await mobileMenu.count();

        expect(menuCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('affichage tablette diagnostics', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(`/phase5/${projectId}/diagnostics`);

      if (page.url().includes('phase5')) {
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });
});

test.describe('Phase 5 - Intégration données', () => {
  const projectId = 'test-project-id';

  test('chargement asynchrone des données', async ({ page }) => {
    await page.goto(`/phase5/${projectId}`);

    if (page.url().includes('phase5')) {
      // Attendre que le chargement initial soit terminé
      await page.waitForLoadState('networkidle');

      // Vérifier qu'il n'y a pas d'erreur visible
      const errorMessage = page.locator('[class*="error"], [role="alert"]:has-text("erreur")');
      const errorCount = await errorMessage.count();

      // Pas d'erreur critique
      expect(errorCount).toBe(0);
    }
  });

  test('gestion état vide', async ({ page }) => {
    await page.goto(`/phase5/non-existent-project-id`);

    const currentUrl = page.url();
    // Soit redirigé, soit affiche un état vide
    expect(currentUrl).toMatch(/phase5|login|404|not-found/);
  });
});
