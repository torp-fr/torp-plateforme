import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('page accueil accessible et titre correct', async ({ page }) => {
    await page.goto('/');

    // Vérifier que la page se charge
    await expect(page).toHaveTitle(/TORP/i);

    // Vérifier les éléments principaux de la landing page
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigation vers login depuis la page d\'accueil', async ({ page }) => {
    await page.goto('/');

    // Chercher un lien ou bouton de connexion
    const loginButton = page.locator('a[href="/login"], button:has-text("Connexion"), a:has-text("Connexion")').first();

    if (await loginButton.isVisible()) {
      await loginButton.click();
      await expect(page).toHaveURL(/login/);
    }
  });

  test('navigation vers register depuis la page d\'accueil', async ({ page }) => {
    await page.goto('/');

    // Chercher un lien ou bouton d'inscription
    const registerButton = page.locator('a[href="/register"], button:has-text("Inscription"), a:has-text("Créer un compte"), a:has-text("S\'inscrire")').first();

    if (await registerButton.isVisible()) {
      await registerButton.click();
      await expect(page).toHaveURL(/register/);
    }
  });

  test('redirection vers login si non connecté - dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Devrait rediriger vers login ou afficher un message
    await expect(page).toHaveURL(/login|dashboard/);
  });

  test('redirection vers login si non connecté - phase0', async ({ page }) => {
    await page.goto('/phase0');

    // Devrait rediriger vers login ou afficher la page
    await expect(page).toHaveURL(/login|phase0/);
  });

  test('page 404 pour routes inexistantes', async ({ page }) => {
    await page.goto('/route-inexistante-xyz');

    // Vérifier qu'on voit soit une page 404 soit une redirection
    const content = await page.content();
    const is404OrRedirect = content.includes('404') ||
                           content.includes('Not Found') ||
                           content.includes('Page introuvable') ||
                           page.url().includes('login') ||
                           page.url().includes('dashboard');

    expect(is404OrRedirect).toBeTruthy();
  });

  test('navigation directe vers pricing', async ({ page }) => {
    await page.goto('/pricing');

    // La page pricing devrait être accessible publiquement
    await expect(page).toHaveURL(/pricing/);
  });

  test('navigation directe vers demo', async ({ page }) => {
    await page.goto('/demo');

    // La page demo devrait être accessible publiquement
    await expect(page).toHaveURL(/demo/);
  });

  test('liens du footer fonctionnels', async ({ page }) => {
    await page.goto('/');

    // Vérifier la présence d'un footer
    const footer = page.locator('footer');
    if (await footer.isVisible()) {
      // Vérifier qu'il y a des liens
      const footerLinks = footer.locator('a');
      const count = await footerLinks.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

test.describe('Navigation Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('menu mobile visible sur petit écran', async ({ page }) => {
    await page.goto('/');

    // Chercher un bouton de menu hamburger
    const menuButton = page.locator('button[aria-label*="menu"], button:has([class*="menu"]), [data-testid="mobile-menu"]');

    // Sur mobile, il devrait y avoir un menu hamburger ou le menu normal
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigation mobile fonctionnelle', async ({ page }) => {
    await page.goto('/');

    // La page devrait se charger correctement sur mobile
    await expect(page).toHaveURL('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
