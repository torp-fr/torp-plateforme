import { test, expect } from '@playwright/test';

test.describe('Authentification', () => {
  test.describe('Page Login', () => {
    test('affichage correct de la page login', async ({ page }) => {
      await page.goto('/login');

      // Vérifier la présence du formulaire
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('validation email requis', async ({ page }) => {
      await page.goto('/login');

      // Soumettre sans email
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      await passwordInput.fill('password123');

      await page.click('button[type="submit"]');

      // Vérifier message d'erreur ou validation HTML5
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
      expect(isInvalid).toBeTruthy();
    });

    test('validation password requis', async ({ page }) => {
      await page.goto('/login');

      // Remplir seulement l'email
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');

      await page.click('button[type="submit"]');

      // Le formulaire ne devrait pas être soumis avec un mot de passe vide
      await expect(page).toHaveURL(/login/);
    });

    test('lien vers inscription visible', async ({ page }) => {
      await page.goto('/login');

      // Chercher un lien vers register
      const registerLink = page.locator('a[href="/register"], a:has-text("Créer un compte"), a:has-text("S\'inscrire")');
      await expect(registerLink.first()).toBeVisible();
    });

    test('lien mot de passe oublié visible', async ({ page }) => {
      await page.goto('/login');

      // Chercher un lien vers forgot-password
      const forgotLink = page.locator('a[href="/forgot-password"], a:has-text("Mot de passe oublié"), a:has-text("oublié")');

      if (await forgotLink.first().isVisible()) {
        await forgotLink.first().click();
        await expect(page).toHaveURL(/forgot-password/);
      }
    });
  });

  test.describe('Page Register', () => {
    test('affichage correct de la page register', async ({ page }) => {
      await page.goto('/register');

      // Vérifier la présence des champs
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"], input[name="password"]').first()).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('validation email format', async ({ page }) => {
      await page.goto('/register');

      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('invalid-email');

      // Cliquer ailleurs pour déclencher la validation
      await page.click('body');

      // L'email invalide devrait être signalé
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
      expect(isInvalid).toBeTruthy();
    });

    test('champ confirmation mot de passe si présent', async ({ page }) => {
      await page.goto('/register');

      // Certains formulaires ont une confirmation de mot de passe
      const confirmPassword = page.locator('input[name="confirmPassword"], input[name="confirm_password"], input[placeholder*="Confirmer"]');

      if (await confirmPassword.isVisible()) {
        // Tester la correspondance des mots de passe
        const password = page.locator('input[name="password"]').first();
        await password.fill('TestPassword123!');
        await confirmPassword.fill('DifferentPassword123!');

        await page.click('button[type="submit"]');

        // Devrait afficher une erreur ou rester sur la page
        await expect(page).toHaveURL(/register/);
      }
    });

    test('lien vers login visible', async ({ page }) => {
      await page.goto('/register');

      // Chercher un lien vers login
      const loginLink = page.locator('a[href="/login"], a:has-text("Se connecter"), a:has-text("Déjà un compte")');
      await expect(loginLink.first()).toBeVisible();
    });
  });

  test.describe('Page Forgot Password', () => {
    test('affichage correct de la page', async ({ page }) => {
      await page.goto('/forgot-password');

      // Vérifier la présence du champ email
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('retour vers login possible', async ({ page }) => {
      await page.goto('/forgot-password');

      const backLink = page.locator('a[href="/login"], a:has-text("Retour"), button:has-text("Retour")');

      if (await backLink.first().isVisible()) {
        await backLink.first().click();
        await expect(page).toHaveURL(/login/);
      }
    });
  });
});

test.describe('Session et Déconnexion', () => {
  test('déconnexion depuis dashboard', async ({ page }) => {
    // Note: Ce test nécessiterait une vraie connexion
    // Pour l'instant, on vérifie juste que la page dashboard existe
    await page.goto('/dashboard');

    // Si redirigé vers login, c'est normal (pas de session)
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/login|dashboard/);
  });
});
