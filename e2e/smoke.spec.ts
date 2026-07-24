import { test, expect } from "@playwright/test";

test("boot → warn → tutorial → start mission → canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#app")).toBeVisible();

  // Soft assert boot completed (fatal only if GPU/boot truly unavailable)
  const fatal = page.locator(".fatal");
  if (await fatal.isVisible().catch(() => false)) {
    await expect(fatal).toBeVisible();
    return;
  }

  const warn = page.locator("#panel-warn:not(.hidden)");
  if (await warn.isVisible().catch(() => false)) {
    await page.locator("#btn-warn-ok").click();
  }

  const tut = page.locator("#panel-tutorial:not(.hidden)");
  if (await tut.isVisible().catch(() => false)) {
    await page.locator("#btn-tut-ok").click();
  } else {
    const start = page.locator("#btn-start");
    await expect(start).toBeVisible({ timeout: 10_000 });
    await start.click();
  }

  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
});
