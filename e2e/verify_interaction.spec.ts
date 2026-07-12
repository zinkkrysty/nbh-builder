import { test, expect } from '@playwright/test';

test('Interaction conflict: Shift/Ctrl click does not trigger grid interaction', async ({ page }) => {
  // Go to the local dev server
  await page.goto('http://localhost:3000');

  // Wait for loader to disappear and enter game
  await page.waitForTimeout(2000);
  const enterBtn = page.locator('#btn-enter');
  if (await enterBtn.isVisible()) {
    await enterBtn.click();
    await page.waitForTimeout(1000);
  }

  // Initial population/funds state (id is stat-money based on index.html)
  const fundsLocator = page.locator('#stat-money');
  await expect(fundsLocator).toBeVisible();
  const initialFundsText = await fundsLocator.textContent();
  const initialFunds = parseInt((initialFundsText || '0').replace(/[^0-9-]/g, ''), 10);

  // Select residential tool (button data-tool="residential" or id="tool-residential")
  const resToolBtn = page.locator('#tool-residential');
  await resToolBtn.click();
  await page.waitForTimeout(500);

  // Ensure tool is selected (class active)
  await expect(resToolBtn).toHaveClass(/active/);

  // Click with Shift held. This should NOT place a building
  // Force click because canvas might be covered by HUD elements (like pointer-events intercepts)
  const canvas = page.locator('canvas');
  await canvas.click({
    position: { x: 500, y: 300 },
    modifiers: ['Shift'],
    force: true
  });

  await page.waitForTimeout(500);
  let fundsText = await fundsLocator.textContent();
  let currentFunds = parseInt((fundsText || '0').replace(/[^0-9-]/g, ''), 10);

  // Assert funds have not decreased
  expect(currentFunds).toBe(initialFunds);

  // Click with Ctrl held. This should NOT place a building.
  await canvas.click({
    position: { x: 550, y: 350 },
    modifiers: ['Control'],
    force: true
  });

  await page.waitForTimeout(500);
  fundsText = await fundsLocator.textContent();
  currentFunds = parseInt((fundsText || '0').replace(/[^0-9-]/g, ''), 10);

  // Assert funds have not decreased
  expect(currentFunds).toBe(initialFunds);

  // Normal click. This SHOULD place a building.
  await canvas.click({
    position: { x: 600, y: 400 },
    force: true
  });

  await page.waitForTimeout(500);
  fundsText = await fundsLocator.textContent();
  currentFunds = parseInt((fundsText || '0').replace(/[^0-9-]/g, ''), 10);

  // Assert funds decreased (building was placed)
  expect(currentFunds).toBeLessThan(initialFunds);
});
