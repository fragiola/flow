import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import react from "@vitejs/plugin-react";
import { createServer, defaultServerConditions } from "vite";
import { withSourceCondition } from "../../../scripts/source-condition.ts";

// #39: the server's HTML (src/fixture/server-layers-fixture.tsx: react-dom/server in the test
// process, loaded by a Vite SSR server with the packages' sources), painted by a
// real browser with no JavaScript, so no engine and no hydration. With two render levels the nodes
// and the levels' wrappers have negative z-indexes: a hit test finds each part where it is drawn,
// none under the root, and the selected edge ab above the node c it crosses. No engine writes the
// viewport's transform: flow (x, y) is page (x, y).

test.use({ javaScriptEnabled: false });

let html = "";

test.beforeAll(async () => {
    const vite = await createServer({
        configFile: false,
        root: resolve(import.meta.dirname, ".."),
        logLevel: "silent",
        plugins: [react()],
        ssr: {
            resolve: {
                conditions: withSourceCondition(defaultServerConditions),
            },
        },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
        appType: "custom",
    });
    try {
        const fixture = (await vite.ssrLoadModule(
            "/src/fixture/server-layers-fixture.tsx",
        )) as { serverHtml: () => string };
        html = fixture.serverHtml();
    } finally {
        await vite.close();
    }
});

/** The part on top at a page point: `edge-path <id>`, `node <id>`, or the element's part. */
const topAt = (page: Page, x: number, y: number) =>
    page.evaluate(
        ([x, y]) => {
            const hit = document.elementFromPoint(x as number, y as number);
            const path = hit?.closest('[data-flow-part="edge-path"]');
            if (path) return `edge-path ${path.getAttribute("data-flow-id")}`;
            const node = hit?.closest('[data-flow-part="node"]');
            if (node) return `node ${node.getAttribute("data-flow-id")}`;
            return hit?.getAttribute("data-flow-part") ?? hit?.tagName ?? null;
        },
        [x, y],
    );

test.beforeEach(async ({ page }) => {
    await page.setContent(html);
});

test("the server HTML draws two render levels, the nodes with negative z-indexes", async ({
    page,
}) => {
    await expect(page.locator('[data-flow-part="edges-layer"]')).toHaveCount(2);
    await expect(page.locator('[data-flow-part="edge-path"]')).toHaveCount(2);
    const zIndex = await page
        .locator('[data-flow-part="node"][data-flow-id="c"]')
        .evaluate((element) => getComputedStyle(element).zIndex);
    expect(Number(zIndex)).toBeLessThan(0);
});

test("without JavaScript, the nodes and a level-0 edge are hit where they are drawn, above the root", async ({
    page,
}) => {
    expect(await topAt(page, 160, 80)).toBe("node a");
    expect(await topAt(page, 560, 320)).toBe("node b");
    expect(await topAt(page, 310, 225)).toBe("node c");
    expect(await topAt(page, 160, 380)).toBe("node e");
    // the unselected edge ae, over no node
    expect(await topAt(page, 160, 230)).toBe("edge-path ae");
    // the pane, away from everything
    expect(await topAt(page, 700, 100)).not.toMatch(/^(node|edge-path)/);
});

test("without JavaScript, the selected edge is drawn above the node it crosses", async ({
    page,
}) => {
    // ab's midpoint, c's centre: the raised edge on top
    expect(await topAt(page, 360, 200)).toBe("edge-path ab");
    // off the line, inside c: the node
    expect(await topAt(page, 400, 180)).toBe("node c");
});
