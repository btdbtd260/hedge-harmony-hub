import { Page, Locator } from "@playwright/test";

export class AuthPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly signUpButton: Locator;
  readonly googleSignInButton: Locator;
  readonly signInTab: Locator;
  readonly signUpTab: Locator;
  readonly pageTitle: Locator;
  readonly errorToast: Locator;
  readonly description: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator("#email-in");
    this.passwordInput = page.locator("#pw-in");
    this.signInButton = page.getByRole("button", { name: "Se connecter" });
    this.signUpButton = page.getByRole("button", { name: "Créer un compte" });
    this.googleSignInButton = page.getByRole("button", {
      name: /Continuer avec Google/i,
    });
    this.signInTab = page.getByRole("tab", { name: "Connexion" });
    this.signUpTab = page.getByRole("tab", { name: "Inscription" });
    // CardTitle renders as h3 in shadcn/ui
    this.pageTitle = page.getByRole("heading", { name: "Connexion" });
    this.errorToast = page.locator("[data-sonner-toaster] [role='status']");
    this.description = page.getByText(
      "Accès réservé aux membres autorisés"
    );
  }

  async goto() {
    await this.page.goto("/auth");
    await this.page.waitForLoadState("networkidle");
  }

  async signIn(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async signUp(email: string, password: string) {
    await this.signUpTab.click();
    await this.page.waitForTimeout(500);
    const emailUp = this.page.locator("#email-up");
    const pwUp = this.page.locator("#pw-up");
    await emailUp.fill(email);
    await pwUp.fill(password);
    await this.signUpButton.click();
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }
}
