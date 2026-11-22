import { expect, test } from "@playwright/test";
import { edge, openExample } from "../helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "edge-types");
});

test("each edge type draws its own path", async ({ page }) => {
    const d = async (id: string) =>
        (await edge(page, id)
            .locator('[data-flow-part="edge-path"]')
            .getAttribute("d")) ?? "";
    // a bezier curves, a straight line does not, a step turns at right angles
    expect(await d("bezier")).toMatch(/C/);
    // a simple bezier: one curve, its control points halfway between the ends on each end's
    // (vertical) axis
    const simple = await d("simplebezier");
    expect(simple).toMatch(/^M[^C]+C[^C]+$/);
    const [sx, sy, c1x, c1y, c2x, c2y, tx, ty] = [
        ...simple.matchAll(/-?\d+(\.\d+)?/g),
    ].map((m) => Number(m[0]));
    expect(c1x).toBeCloseTo(sx ?? Number.NaN, 2);
    expect(c2x).toBeCloseTo(tx ?? Number.NaN, 2);
    expect(c1y).toBeCloseTo(((sy ?? 0) + (ty ?? 0)) / 2, 2);
    expect(c2y).toBeCloseTo(((sy ?? 0) + (ty ?? 0)) / 2, 2);
    expect(await d("straight")).not.toMatch(/[CQ]/);
    expect(await d("step")).toMatch(/L/);
    // the app's wave: many segments
    expect((await d("wave")).split("L").length).toBeGreaterThan(10);
    for (const type of [
        "bezier",
        "simplebezier",
        "smoothstep",
        "step",
        "straight",
        "wave",
    ]) {
        await expect(edge(page, type)).toBeVisible();
    }
});

test("every edge is labelled with its type", async ({ page }) => {
    for (const label of [
        "bezier",
        "simplebezier",
        "smoothstep",
        "step",
        "straight",
        "wave (app)",
    ]) {
        await expect(
            page.getByTestId("stage").getByText(label, { exact: true }),
        ).toBeVisible();
    }
});
