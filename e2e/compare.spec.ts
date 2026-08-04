import { test, expect } from "@playwright/test";

test("comparing two listings shows both side by side", async ({ page }) => {
  await page.goto("/compare");

  // A filled slot replaces its combobox with a summary card, so always pick
  // the first remaining empty slot.
  const emptySlots = page.getByRole("combobox");
  await emptySlots.first().click();
  const firstOption = page.getByRole("option").first();
  const firstTitle = await firstOption.textContent();
  await firstOption.click();

  await emptySlots.first().click();
  const secondOption = page.getByRole("option").nth(1);
  const secondTitle = await secondOption.textContent();
  await secondOption.click();

  const table = page.getByRole("table");
  await expect(page.getByText("Monthly likely total")).toBeVisible();
  if (firstTitle)
    await expect(
      table.getByRole("link", { name: firstTitle, exact: true }),
    ).toBeVisible();
  if (secondTitle)
    await expect(
      table.getByRole("link", { name: secondTitle, exact: true }),
    ).toBeVisible();
});
