import { expect, type Page, test } from "@playwright/test";
import { node, openExample, part } from "../helpers";
import { viewportOf } from "./helpers";

// The contextual-zoom example: every node carries its detail level as `data-detail` (`low` below a
// zoom of 0.75, `medium` to 1.35, `high` from there), showing its name, then its kind and health,
// then its owner and figures; the edges' labels (`data-flow-part="edge-label"`) show from a zoom of
// 1. The zoom is driven through the "Zoom in" and "Zoom out" buttons, and each step waits for the
// viewport's animation to settle.

test.beforeEach(async ({ page }) => {
    await openExample(page, "contextual-zoom");
});

const stage = (page: Page) => page.getByTestId("stage");

const NODES = ["gateway", "orders", "search", "billing", "index"];

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
    return (await viewportOf(page)).zoom;
}

/** Presses a zoom button until the first node shows `detail`; fails if the button gives out. */
async function zoomTo(
    page: Page,
    name: "Zoom in" | "Zoom out",
    detail: string,
) {
    const button = stage(page).getByRole("button", { name });
    const first = node(page, "gateway");
    for (let i = 0; i < 12; i++) {
        if ((await first.getAttribute("data-detail")) === detail) break;
        await expect(button).toBeEnabled();
        await button.click();
        await settled(page);
    }
    await expect(first).toHaveAttribute("data-detail", detail);
}

/** Every node shows `detail`. */
async function expectDetail(page: Page, detail: string) {
    for (const id of NODES) {
        await expect(node(page, id)).toHaveAttribute("data-detail", detail);
    }
}

test("the nodes show more detail as the flow zooms in, and less as it zooms out", async ({
    page,
}) => {
    const gateway = node(page, "gateway");
    await zoomTo(page, "Zoom out", "low");
    await expectDetail(page, "low");
    await expect(gateway).toContainText("Gateway");
    await expect(gateway.getByText("Edge proxy")).toHaveCount(0);
    await expect(gateway.getByText("Owner")).toHaveCount(0);
    await expect(stage(page).getByTestId("zoom-readout")).toContainText(
        "low detail",
    );

    await zoomTo(page, "Zoom in", "medium");
    await expectDetail(page, "medium");
    await expect(gateway.getByText("Edge proxy")).toBeVisible();
    await expect(gateway.getByText("healthy")).toBeVisible();
    await expect(gateway.getByText("Owner")).toHaveCount(0);

    await zoomTo(page, "Zoom in", "high");
    await expectDetail(page, "high");
    await expect(gateway.getByText("Edge proxy")).toBeVisible();
    await expect(gateway.getByText("Owner")).toBeVisible();
    await expect(gateway.getByText("Platform")).toBeVisible();
    await expect(stage(page).getByTestId("zoom-readout")).toContainText(
        "high detail",
    );

    await zoomTo(page, "Zoom out", "medium");
    await expectDetail(page, "medium");
    await expect(gateway.getByText("Owner")).toHaveCount(0);
});

test("the edges' labels are absent below a zoom of 1 and present from it", async ({
    page,
}) => {
    const labels = part(page, "edge-label");
    await zoomTo(page, "Zoom out", "low");
    expect(await settled(page)).toBeLessThan(1);
    await expect(labels).toHaveCount(0);
    // step by step up to the highest level: the labels follow the zoom at every step
    const zoomIn = stage(page).getByRole("button", { name: "Zoom in" });
    let seen = false;
    for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) {
        await zoomIn.click();
        const zoom = await settled(page);
        // a zoom too close to 1 to tell which side of it the engine is on: skip the check
        if (Math.abs(zoom - 1) < 0.01) continue;
        await expect(labels).toHaveCount(zoom >= 1 ? 4 : 0);
        if (zoom >= 1) seen = true;
    }
    expect(seen).toBe(true);
    await expectDetail(page, "high");
    await expect(labels).toHaveCount(4);
    await expect(labels.getByText("POST /orders")).toBeVisible();
});

test("every node and edge a keyboard reaches is named, the same at every level", async ({
    page,
}) => {
    const names = async (name: string) => {
        const list: string[] = [];
        for (const element of await part(page, name).all()) {
            await expect(element).toHaveAccessibleName(/\S/);
            list.push(
                (await element.getAttribute("aria-label")) ?? "(unnamed)",
            );
        }
        return list;
    };
    await expect(part(page, "node")).toHaveCount(5);
    await expect(part(page, "edge")).toHaveCount(4);
    await zoomTo(page, "Zoom out", "low");
    const low = [...(await names("node")), ...(await names("edge"))];
    await zoomTo(page, "Zoom in", "high");
    const high = [...(await names("node")), ...(await names("edge"))];
    expect(high).toEqual(low);
    await expect(
        stage(page).getByRole("group", { name: "Gateway", exact: true }),
    ).toHaveAttribute("data-flow-id", "gateway");
    await expect(
        stage(page).getByRole("group", {
            name: "Gateway to Orders: POST /orders",
            exact: true,
        }),
    ).toHaveAttribute("data-flow-id", "gateway-orders");
});
