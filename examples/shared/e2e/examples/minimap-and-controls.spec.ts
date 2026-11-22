import { expect, type Page, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { boxOf, dragBy, middle, near, viewportOf } from "./helpers";

/** The zoom once the buttons' animation (`duration`) has settled. */
async function settled(page: Page) {
    let last = Number.NaN;
    await expect
        .poll(async () => {
            const { zoom } = await viewportOf(page);
            const still = zoom === last;
            last = zoom;
            return still;
        })
        .toBe(true);
    return viewportOf(page);
}

test.beforeEach(async ({ page }) => {
    await openExample(page, "minimap-and-controls");
});

test("the zoom buttons zoom, and stop at the limits", async ({ page }) => {
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    const before = await viewportOf(page);
    await zoomIn.click();
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeGreaterThan(before.zoom);
    for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) {
        await zoomIn.click();
        await settled(page);
    }
    await expect(zoomIn).toBeDisabled();
    await expect(zoomIn).toHaveAttribute("data-disabled", "");
    near((await viewportOf(page)).zoom, 2, 0.01);
    await page.getByRole("button", { name: "Fit view" }).click();
    await expect
        .poll(async () => (await viewportOf(page)).zoom)
        .toBeLessThan(1);
});

test("the lock stops dragging and selecting, and pan still works", async ({
    page,
}) => {
    const lock = page.getByRole("button", { name: "Lock the flow" });
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "true");
    // the lock switches dragging, connecting and selecting off: the flow stays interactive
    await expect(part(page, "root")).toHaveAttribute("data-interactive", "");
    await node(page, "rome").click();
    await expect(node(page, "rome")).not.toHaveAttribute("data-selected", "");
    const paris = node(page, "paris");
    const rome = node(page, "rome");
    const gap = async () => (await boxOf(rome)).x - (await boxOf(paris)).x;
    const before = await gap();
    await dragBy(page, paris, 60, 0);
    near(await gap(), before, 1);
    await lock.click();
    await expect(lock).toHaveAttribute("aria-pressed", "false");
});

test("the minimap shows every node, and a drag in it pans the flow", async ({
    page,
}) => {
    await expect(part(page, "minimap-node")).toHaveCount(10);
    const before = await viewportOf(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await settled(page);
    await page.getByRole("button", { name: "Zoom in" }).click();
    const zoomed = await settled(page);
    expect(zoomed.zoom).toBeGreaterThan(before.zoom);
    const map = await middle(part(page, "minimap"));
    await page.mouse.move(map.x, map.y);
    await page.mouse.down();
    await page.mouse.move(map.x + 30, map.y + 20, { steps: 6 });
    await page.mouse.up();
    const after = await viewportOf(page);
    expect(after.x).not.toBe(zoomed.x);
});

type Sampler = { zooms: number[]; stop: boolean };

test("the zoom buttons animate their change", async ({ page }) => {
    const before = (await settled(page)).zoom;
    const stage = page.getByTestId("stage");
    // the zoom the viewport is drawn at, every frame: installed (a first frame drawn) before the press
    await stage.evaluate(
        (stage) =>
            new Promise<void>((ready) => {
                const viewport = stage.querySelector(
                    '[data-flow-part="viewport"]',
                );
                const sampler: Sampler = { zooms: [], stop: false };
                (window as unknown as { sampler: Sampler }).sampler = sampler;
                const step = () => {
                    if (viewport) {
                        sampler.zooms.push(
                            new DOMMatrixReadOnly(
                                getComputedStyle(viewport).transform,
                            ).a,
                        );
                    }
                    if (sampler.zooms.length === 1) ready();
                    if (!sampler.stop) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            }),
    );
    await page.getByRole("button", { name: "Zoom in" }).click();
    const after = (await settled(page)).zoom;
    const zooms = await page.evaluate(() => {
        const sampler = (window as unknown as { sampler: Sampler }).sampler;
        sampler.stop = true;
        return sampler.zooms;
    });
    near(after, before * 1.2, 0.01);
    near(zooms.at(-1) ?? 0, after, 0.0001);
    // frames between the two zooms: it went there step by step
    const between = zooms.filter(
        (zoom) => zoom > before + 0.001 && zoom < after - 0.001,
    );
    expect(between.length).toBeGreaterThan(1);
});
