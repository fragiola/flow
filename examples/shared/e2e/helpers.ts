// From Splitter (fragiola/splitter, examples/shared/e2e/helpers.ts), same author and licence.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { examplesApp, listExampleSlugs } from "../scripts/examples-lib.ts";
import { THEMES, type ThemeName } from "../src/themes/themes.ts";
import {
    caseSkipReason,
    embedBase,
    frameworkOf,
    skipOrFail,
} from "./available.ts";

// The examples run in a framework's embed app, addressed by its directory URL (`…/?id=`, §5.1 of
// the site export contract), alone on the page: the stage is the page's own `data-testid="stage"`,
// and the site's Reset (which reloads the iframe) is a reload.
//
// Every framework runs these specs (config.ts). They reach the examples only through what every
// adapter reproduces: `data-flow-part`, `data-flow-id`, the state attributes, roles and accessible
// names, and test ids the example sets itself; never a class name or a framework detail.

/** The framework under test, set by the app's playwright.config.ts. */
export const FRAMEWORK = frameworkOf(process.env.EXAMPLES_FRAMEWORK);
/** Where the e2e server mounts its embed (serve.ts). */
export const EMBED_BASE = embedBase(FRAMEWORK);
const AVAILABLE = listExampleSlugs(examplesApp(FRAMEWORK));
/** The framework's examples: a spec loops over these, never over a fixed list. */
export const EXAMPLES = AVAILABLE.map((slug) => ({ slug }));
export { THEMES };

/**
 * Skips the running test (or, at the top of a spec file, the whole file) when the framework has
 * not every one of these examples: a framework may ship a subset of them. A complete framework
 * (`COMPLETE_FRAMEWORKS`) fails instead.
 */
export function requireExamples(...slugs: string[]) {
    const reason = skipOrFail(FRAMEWORK, AVAILABLE, slugs);
    test.skip(reason !== undefined, reason);
}

/**
 * Skips the running test when its case of an example is still pending in the framework
 * (`PENDING` in available.ts: a later Epic brings it there), e.g. `requireCase("sub-flows",
 * "selection-grouping")` as a test's first line.
 */
export function requireCase(slug: string, name: string) {
    const reason = caseSkipReason(FRAMEWORK, slug, name);
    test.skip(reason !== undefined, reason);
}

/** Waits for the flow to be drawn: the root, and every node measured. */
export async function flowReady(page: Page) {
    const stage = page.getByTestId("stage");
    await expect(
        stage.locator('[data-flow-part="root"]').first(),
    ).toBeVisible();
    await expect
        .poll(() =>
            stage
                .locator('[data-flow-part="node"]:not([data-measured])')
                .count(),
        )
        .toBe(0);
}

/**
 * Opens an example in a theme and waits for its flow to be drawn. Skips the test when the
 * framework has no such example.
 */
export async function openExample(
    page: Page,
    slug: string,
    options: { theme?: ThemeName } = {},
) {
    requireExamples(slug);
    const params = new URLSearchParams({ id: slug });
    if (options.theme) params.set("theme", options.theme);
    await page.goto(`./?${params}`);
    const stage = page.getByTestId("stage");
    if (options.theme) {
        await expect(page.locator("body")).toHaveAttribute(
            "data-example-theme",
            options.theme,
        );
    }
    await flowReady(page);
    return stage;
}

/** The site's Reset: it reloads the example's frame. */
export async function reset(page: Page) {
    await page.reload();
    await flowReady(page);
}

/** Collects console errors and uncaught exceptions for the page's lifetime. */
export function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    return errors;
}

/** The flow parts of a kind inside the stage (`data-flow-part`). */
export function part(page: Page, name: string): Locator {
    return page.getByTestId("stage").locator(`[data-flow-part="${name}"]`);
}

/** A node by its id (`data-flow-id`). */
export function node(page: Page, id: string): Locator {
    return page
        .getByTestId("stage")
        .locator(`[data-flow-part="node"][data-flow-id="${id}"]`);
}

/** An edge by its id (`data-flow-id`): the SVG group. */
export function edge(page: Page, id: string): Locator {
    return page
        .getByTestId("stage")
        .locator(`[data-flow-part="edge"][data-flow-id="${id}"]`);
}

/** A node's handle of a type, optionally by its handle id (`data-flow-id`). */
export function handle(
    page: Page,
    nodeId: string,
    type: "source" | "target",
    handleId?: string,
): Locator {
    const id = handleId === undefined ? "" : `[data-flow-id="${handleId}"]`;
    return node(page, nodeId).locator(
        `[data-flow-part="handle"][data-handle-type="${type}"]${id}`,
    );
}
