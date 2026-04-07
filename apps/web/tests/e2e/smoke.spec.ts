import { expect, test } from "@playwright/test";

test("boots, navigates, and reaches the live system checks", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "System" })).toBeVisible();

  await page.getByRole("link", { name: "System" }).click();

  await expect(
    page.getByRole("heading", { name: "System checks are live." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  await expect(
    page.getByText("Healthy", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("The API process is responding successfully."),
  ).toBeVisible();

  await expect
    .poll(async () => {
      const pageText = await page.locator("body").textContent();

      if (pageText?.includes("Not Ready")) {
        return "not_ready";
      }

      if (
        pageText?.includes(
          "The API dependencies are available and the service is ready.",
        )
      ) {
        return "ready";
      }

      return "pending";
    })
    .not.toBe("pending");
});
