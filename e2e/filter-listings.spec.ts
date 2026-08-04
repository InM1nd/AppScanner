import { test, expect } from "@playwright/test";

test("filtering listings updates the visible count", async ({ page }) => {
  await page.goto("/listings");

  const countText = page.getByText(/Showing .+ of \d+/);
  await expect(countText).toBeVisible();
  const beforeText = await countText.textContent();
  const before = Number(beforeText?.match(/of (\d+)/)?.[1] ?? 0);
  expect(before).toBeGreaterThan(0);

  await page.getByPlaceholder("Min rooms").fill("99");

  await expect(countText).toContainText("of 0");
});
