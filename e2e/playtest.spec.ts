/**
 * Interactive playtest against a running Vite server (or webServer in config).
 */
import { test, expect, type Page } from "@playwright/test";

async function seedReady(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript((e) => {
    localStorage.clear();
    localStorage.setItem("echo-maze-campaign-v1", "8");
    localStorage.setItem(
      "echo-maze-settings-v3",
      JSON.stringify({
        tutorialDone: true,
        contentWarnAck: true,
        selectedMission: 1,
        headphonesMode: true,
        showRadar: true,
        keymap: {},
        ...e,
      }),
    );
  }, extra);
}

test.describe("Echo Maze playtest", () => {
  test("funnel chrome hidden until play", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await expect(page.locator("#panel-warn:not(.hidden)")).toBeVisible();
    await expect(page.locator(".ability-dock")).toBeHidden();
    await expect(page.locator("#radar")).toBeHidden();
    await page.locator("#btn-warn-ok").click();
    await expect(page.locator("#panel-tutorial:not(.hidden)")).toBeVisible();
    await expect(page.locator(".ability-dock")).toBeHidden();
    await page.locator("#btn-tut-ok").click();
    await expect(page.locator("#panel-menu")).toBeHidden();
    await expect(page.locator(".ability-dock")).toBeVisible();
    await expect(page.locator("#radar")).toBeVisible();
  });

  test("move ping pause resume win lose", async ({ page }) => {
    await seedReady(page);
    await page.goto("/");
    await page.locator("#btn-start").click();
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(400);
    await page.keyboard.up("KeyW");
    await page.keyboard.press("Space");
    await page.keyboard.press("Escape");
    await expect(page.locator("#panel-pause:not(.hidden)")).toBeVisible();
    await expect(page.locator(".ability-dock")).toBeHidden();
    await page.locator("#btn-resume").click();
    await expect(page.locator(".ability-dock")).toBeVisible();

    await page.evaluate(() => {
      const g = (window as unknown as { __ECHO_GAME__: { hasEchoKey: boolean; playerX: number; playerZ: number; exitWorld: { x: number; z: number } } })
        .__ECHO_GAME__;
      g.hasEchoKey = true;
      g.playerX = g.exitWorld.x;
      g.playerZ = g.exitWorld.z;
    });
    await expect(page.locator("#panel-won:not(.hidden)")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".ability-dock")).toBeHidden();
    await page.locator("#btn-title-win").click();

    await page.locator("#btn-start").click();
    await page.evaluate(() => {
      const g = (
        window as unknown as {
          __ECHO_GAME__: { playerX: number; playerZ: number; enemies: { x: number; z: number; state: string }[] };
        }
      ).__ECHO_GAME__;
      const e = g.enemies[0];
      if (e) {
        e.x = g.playerX;
        e.z = g.playerZ;
        e.state = "chase";
      }
    });
    await expect(page.locator("#panel-lost:not(.hidden)")).toBeVisible({ timeout: 3000 });
  });

  test("hide niche objective priority", async ({ page }) => {
    await seedReady(page, { selectedMission: 8 });
    await page.goto("/");
    await page.locator("#btn-start").click();
    await page.evaluate(() => {
      const g = (
        window as unknown as {
          __ECHO_GAME__: {
            level: { height: number; width: number; grid: number[][] };
            playerX: number;
            playerZ: number;
            echoDebt: number;
          };
        }
      ).__ECHO_GAME__;
      for (let iz = 1; iz < g.level.height - 1; iz++) {
        for (let ix = 1; ix < g.level.width - 1; ix++) {
          if (g.level.grid[iz]![ix] === 11) {
            g.playerX = ix + 0.5;
            g.playerZ = iz + 0.5;
            g.echoDebt = 0.05;
            return;
          }
        }
      }
    });
    await page.keyboard.down("ShiftLeft");
    await expect(page.locator("#hud-objective")).toContainText(/Hidden/i, { timeout: 2000 });
    await page.keyboard.up("ShiftLeft");
  });
});
