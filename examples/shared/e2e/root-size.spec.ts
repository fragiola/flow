import { expect, test } from "@playwright/test";
import { nodeBoxes } from "./examples/helpers";
import { part, requireExamples } from "./helpers";

// A flow mounted in a container with no height (a collapsed panel, a closed tab) fits its view
// once the container gets its size: the engine observes its root, so no node measurement is
// needed (the nodes keep their size meanwhile).

test("a flow whose root gets its size after mount fits its nodes", async ({
    page,
}) => {
    requireExamples("basic");
    // in place once the document is parsed, before its module scripts mount the example
    await page.addInitScript(() => {
        document.addEventListener(
            "readystatechange",
            () => {
                const style = document.createElement("style");
                style.id = "collapsed";
                style.textContent =
                    '[data-flow-part="root"] { height: 0 !important; min-height: 0 !important; }';
                document.head.append(style);
            },
            { once: true },
        );
    });
    await page.goto("./?id=basic");
    const stage = page.getByTestId("stage");
    // mounted and measured while the root has no height: nothing to fit in yet
    await expect
        .poll(() =>
            stage.locator('[data-flow-part="node"][data-measured]').count(),
        )
        .toBe(4);
    await page.waitForTimeout(100);
    expect((await part(page, "root").boundingBox())?.height ?? 0).toBe(0);

    await page.evaluate(() => document.getElementById("collapsed")?.remove());
    const root = part(page, "root");
    await expect
        .poll(async () => (await root.boundingBox())?.height ?? 0)
        .toBeGreaterThan(100);
    // the fit on init: every node inside the root
    await expect
        .poll(async () => {
            const box = await root.boundingBox();
            if (!box) return false;
            const boxes = [...(await nodeBoxes(page)).values()];
            return (
                boxes.length === 4 &&
                boxes.every(
                    (node) =>
                        node.x >= box.x &&
                        node.y >= box.y &&
                        node.x + node.width <= box.x + box.width &&
                        node.y + node.height <= box.y + box.height,
                )
            );
        })
        .toBe(true);
});
