import { expect, test } from "@playwright/test";
import { node, openExample } from "../helpers";
import { dragBy } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "snap-to-grid");
});

/** The node's position in flow units, as the example prints it. */
async function position(page: import("@playwright/test").Page, id: string) {
    const text =
        (await node(page, id).getByTestId("position").textContent()) ?? "";
    const [x, y] = text.split(",").map((value) => Number(value.trim()));
    return { x: x ?? Number.NaN, y: y ?? Number.NaN };
}

test("a dragged node lands on the grid", async ({ page }) => {
    await dragBy(page, node(page, "a"), 37, 23);
    const { x, y } = await position(page, "a");
    expect(x % 20).toBe(0);
    expect(y % 20).toBe(0);
    expect(x).not.toBe(0);
});

test("another grid size keeps the nodes and snaps to it", async ({ page }) => {
    await dragBy(page, node(page, "b"), 30, 0);
    const moved = await position(page, "b");
    await page.getByRole("button", { name: "40 px" }).click();
    await expect(page.getByRole("button", { name: "40 px" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect(node(page, "b")).toHaveAttribute("data-measured", "");
    expect(await position(page, "b")).toEqual(moved);
    await dragBy(page, node(page, "c"), 33, 51);
    const { x, y } = await position(page, "c");
    expect(x % 40).toBe(0);
    expect(y % 40).toBe(0);
});
