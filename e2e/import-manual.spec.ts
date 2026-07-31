import { test, expect } from "@playwright/test";

test("manual listing import shows up in the listings table", async ({
  page,
}) => {
  const uniqueTitle = `E2E Manual Listing ${Date.now()}`;

  await page.goto("/import");
  await page.getByRole("tab", { name: "Manual entry" }).click();
  await page.getByRole("button", { name: "Start manual entry" }).click();

  await page.getByLabel("Title").fill(uniqueTitle);
  await page
    .getByLabel("Canonical URL")
    .fill(`https://example.com/e2e/${Date.now()}`);

  const save = page.getByRole("button", { name: "Save listing" });
  await save.scrollIntoViewIfNeeded();
  await save.focus();
  await save.press("Enter");

  await page.waitForURL("**/listings");
  await expect(page.getByRole("link", { name: uniqueTitle })).toBeVisible();
});
