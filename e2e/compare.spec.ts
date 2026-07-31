import { test, expect } from "@playwright/test";

test("comparing two listings shows both side by side", async ({ page }) => {
  await page.goto("/compare");

  const slots = page.getByRole("combobox");
  await slots.nth(0).click();
  const firstOption = page.getByRole("option").first();
  const firstTitle = await firstOption.textContent();
  await firstOption.click();

  await slots.nth(1).click();
  const secondOption = page.getByRole("option").nth(1);
  const secondTitle = await secondOption.textContent();
  await secondOption.click();

  await expect(page.getByText("Monthly likely total")).toBeVisible();
  if (firstTitle)
    await expect(
      page.getByRole("link", { name: firstTitle, exact: true }),
    ).toBeVisible();
  if (secondTitle)
    await expect(
      page.getByRole("link", { name: secondTitle, exact: true }),
    ).toBeVisible();
});
