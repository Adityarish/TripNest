import { test, expect } from "@playwright/test";

test("local demo user can create a trip and open its collection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /journeys deserve/i })).toBeVisible();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "New trip" }).first().click();
  await page.getByLabel("Trip name").fill(`Playwright Ooty ${Date.now()}`);
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect(page.getByRole("heading", { name: /Playwright Ooty/ })).toBeVisible();
  await expect(page.getByText("Your trip files")).toBeVisible();
});

test("application exposes install metadata", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const metadata = await manifest.json();
  expect(metadata).toMatchObject({ id: "/", start_url: "/dashboard", scope: "/", display: "standalone" });
  for (const icon of metadata.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain(icon.type);
  }
  const offline = await request.get("/offline.html");
  expect(offline.ok()).toBeTruthy();
  expect(await offline.text()).toContain("You’re offline");
});

test("local demo preserves an original through upload, rename, download, and delete", async ({ page, request }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "New trip" }).first().click();
  await page.getByLabel("Trip name").fill(`Originals ${Date.now()}`);
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect(page.getByText("Your trip files")).toBeVisible();
  await page.locator('input[type="file"][multiple]').setInputFiles({ name: "journal.txt", mimeType: "text/plain", buffer: Buffer.from("full-quality-original") });
  const fileCard = page.locator("article").filter({ hasText: "journal.txt" });
  await expect(fileCard).toBeVisible();
  const contentUrl = await fileCard.getByTitle("Download original").getAttribute("href");
  expect(contentUrl).toBeTruthy();
  const original = await request.get(contentUrl!);
  expect(original.ok()).toBeTruthy();
  expect((await original.body()).toString()).toBe("full-quality-original");
  page.once("dialog", (dialog) => dialog.accept("renamed-journal.txt"));
  await fileCard.getByTitle("Rename").click();
  const renamedCard = page.locator("article").filter({ hasText: "renamed-journal.txt" });
  await expect(renamedCard).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await renamedCard.getByTitle("Delete").click();
  await expect(renamedCard).toHaveCount(0);
});
