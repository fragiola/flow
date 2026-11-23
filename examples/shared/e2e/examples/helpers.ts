import { expect, type Locator, type Page } from "@playwright/test";

// What the example specs share: boxes on screen, presses and drags by the mouse, the viewport the
// engine writes on its element, and a wait for the next frames.

/** An element's box on screen. */
export async function boxOf(locator: Locator) {
    const box = await locator.boundingBox();
    expect(box, "on screen").not.toBeNull();
    return box ?? { x: 0, y: 0, width: 0, height: 0 };
}

/**
 * Every drawn node's box on screen by its id, read at one moment: the view may still be fitting
 * itself (one transform for all), so boxes read one by one could come from two zooms.
 */
export async function nodeBoxes(page: Page) {
    const rects = await page
        .getByTestId("stage")
        .locator('[data-flow-part="node"]')
        .evaluateAll((elements) =>
            elements.map((element) => {
                const { x, y, width, height } = element.getBoundingClientRect();
                return {
                    id: element.getAttribute("data-flow-id") ?? "",
                    x,
                    y,
                    width,
                    height,
                };
            }),
        );
    return new Map(rects.map((rect) => [rect.id, rect]));
}

/** One node's box in `boxes` ({@link nodeBoxes}); the test fails when it is not drawn. */
export function boxIn(
    boxes: ReadonlyMap<
        string,
        { x: number; y: number; width: number; height: number }
    >,
    id: string,
) {
    const box = boxes.get(id);
    expect(box, `${id} on screen`).toBeDefined();
    return box ?? { x: 0, y: 0, width: 0, height: 0 };
}

/** The centre of an element on screen. */
export async function middle(locator: Locator) {
    const box = await boxOf(locator);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses at a point, moves by `dx`, `dy` in steps, and releases unless told not to. */
export async function dragFrom(
    page: Page,
    from: { x: number; y: number },
    dx: number,
    dy: number,
    options: { release?: boolean; modifiers?: "Shift"[] } = {},
) {
    for (const key of options.modifiers ?? []) await page.keyboard.down(key);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 5 });
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 5 });
    if (options.release !== false) await page.mouse.up();
    for (const key of options.modifiers ?? []) await page.keyboard.up(key);
}

/** Presses `locator` at its centre and drags it by `dx`, `dy` pixels. */
export async function dragBy(
    page: Page,
    locator: Locator,
    dx: number,
    dy: number,
    options: { release?: boolean; modifiers?: "Shift"[] } = {},
) {
    await dragFrom(page, await middle(locator), dx, dy, options);
}

/** Drags from one element's centre to another's (a handle to a handle). */
export async function dragTo(page: Page, from: Locator, to: Locator) {
    const start = await middle(from);
    const end = await middle(to);
    await dragFrom(page, start, end.x - start.x, end.y - start.y);
}

/** Presses and releases at an element's centre (a tap the engine reads as a click). */
export async function press(page: Page, locator: Locator) {
    const point = await middle(locator);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.up();
}

/** The viewport the engine wrote on `data-flow-part="viewport"`: its offset and zoom. */
export async function viewportOf(page: Page, root?: Locator) {
    const viewport = (root ?? page.getByTestId("stage"))
        .locator('[data-flow-part="viewport"]')
        .first();
    return viewport.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(
            getComputedStyle(element).transform,
        );
        return { x: matrix.e, y: matrix.f, zoom: matrix.a };
    });
}

/**
 * Waits for two animation frames: whatever the last event scheduled has rendered, so a value
 * read next that must not have changed is not read before a change could show.
 */
export async function rendered(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                ),
            ),
    );
}

/** Within a tolerance: what sub-pixel layout rounds to. */
export function near(actual: number, expected: number, tolerance = 1.5) {
    expect(
        Math.abs(actual - expected),
        `${actual} ≈ ${expected}`,
    ).toBeLessThanOrEqual(tolerance);
}

/**
 * Expects every focusable handle and resize handle of the stage to carry an accessible name
 * (`keyboard()` makes them take focus, and a screen reader reads a focused one by its name), and
 * at least `least` of them shown.
 */
export async function expectNamedHandles(page: Page, least = 1) {
    const focusable = page
        .getByTestId("stage")
        .locator(
            ':is([data-flow-part="handle"], [data-flow-part="resize-handle"])[tabindex="0"]',
        )
        // a hidden one (a resizer shown only while selected) takes no focus and has no name
        .filter({ visible: true });
    expect(await focusable.count()).toBeGreaterThanOrEqual(least);
    for (const element of await focusable.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
}
