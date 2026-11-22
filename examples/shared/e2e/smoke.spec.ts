// From Splitter (fragiola/splitter, examples/shared/e2e/smoke.spec.ts), same author and licence.
import { expect, test } from "@playwright/test";
import { listMetaSlugs } from "../scripts/examples-lib.ts";
import {
    collectErrors,
    EXAMPLES,
    openExample,
    part,
    reset,
    THEMES,
} from "./helpers";

// Every example mounts, draws its nodes (each measured, with its id) and its edges (each with a
// path), names everything a user can focus or press, and logs no error, in every theme (`THEMES`:
// light, dark, ide, paper, terminal); a new example folder is covered without touching this file.

/** Examples that must exist: the smoke run is meaningless without them. */
const REQUIRED: string[] = ["basic", "workflow-builder"];

const known = new Set(listMetaSlugs());
const missing = REQUIRED.filter((slug) => !known.has(slug));
if (missing.length > 0) {
    throw new Error(
        `smoke.spec.ts: REQUIRED names examples that do not exist: ${missing.join(", ")}`,
    );
}

test("the index lists every example", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByTestId("stage").getByRole("link")).toHaveCount(
        EXAMPLES.length,
    );
});

for (const example of EXAMPLES) {
    for (const theme of THEMES) {
        test(`${example.slug} renders in ${theme.name}`, async ({ page }) => {
            const errors = collectErrors(page);
            await openExample(page, example.slug, { theme: theme.name });
            // every node is drawn with its id
            const nodes = await part(page, "node").all();
            expect(nodes.length).toBeGreaterThan(0);
            for (const element of nodes) {
                await expect(element).toHaveAttribute("data-flow-id", /.+/);
            }
            // every edge has a path (both its nodes are measured)
            for (const path of await part(page, "edge-path").all()) {
                await expect(path).toHaveAttribute("d", /^M/);
            }
            // the package names nothing: whatever takes focus or a press is named by the example
            const focusable = page
                .getByTestId("stage")
                .locator(
                    ':is([data-flow-part="node"], [data-flow-part="edge"], [data-flow-part="handle"], [data-flow-part="resize-handle"])[tabindex="0"], button',
                )
                // a hidden one (a resizer shown only while selected) takes no focus
                .filter({ visible: true });
            for (const element of await focusable.all()) {
                await expect(element).toHaveAccessibleName(/.+/);
            }
            // the site's Reset reloads the frame: the example must come back
            await reset(page);
            expect(errors).toEqual([]);
        });
    }
}
