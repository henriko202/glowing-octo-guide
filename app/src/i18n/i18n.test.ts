import { describe, it, expect, beforeAll } from "vitest";
import i18n from "./index";

describe("i18n", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("has english translations", () => {
    expect(i18n.t("login.signInButton")).toBe("Sign in with LinkedIn");
    expect(i18n.t("feed.title")).toBe("Your Feed");
  });

  it("has portuguese translations", async () => {
    await i18n.changeLanguage("pt");
    expect(i18n.t("login.signInButton")).toBe("Entrar com LinkedIn");
    await i18n.changeLanguage("en");
  });

  it("has spanish translations", async () => {
    await i18n.changeLanguage("es");
    expect(i18n.t("login.signInButton")).toBe("Iniciar sesión con LinkedIn");
    await i18n.changeLanguage("en");
  });

  it("falls back to english for unknown language", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("login.title")).toBe("Link Into The SSI");
    await i18n.changeLanguage("en");
  });
});
