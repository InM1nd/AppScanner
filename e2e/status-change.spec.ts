import { test, expect } from "@playwright/test";

test("changing a listing's status updates its badge", async ({ page }) => {
  await page.goto("/listings");
  await page
    .locator("main")
    .getByRole("link", { name: /.+/ })
    .filter({ visible: true })
    .first()
    .click();

  await page.waitForURL("**/listings/*");
  await page.getByRole("button", { name: "Shortlist" }).click();

  await expect(page.getByText("Shortlisted").first()).toBeVisible();
});
