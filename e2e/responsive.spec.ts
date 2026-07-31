import { expect, test } from "@playwright/test";

test("listings has no horizontal overflow and uses the mobile list", async ({
  page,
}) => {
  await page.goto("/listings");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(page.locator("table")).toBeHidden();
    await expect(
      page.locator("main a[href^='/listings/']").first(),
    ).toBeVisible();
  }
});
