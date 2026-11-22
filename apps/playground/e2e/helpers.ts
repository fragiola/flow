import { expect, type Locator, type Page } from "@playwright/test";

// The fixture (src/fixture/flow-fixture.tsx, fixtures/basic): an 800 × 500 root at the page's
// top-left, its viewport at { x: 100, y: 100, zoom: 1 }, every feature. The helpers press with the
// mouse or with fingers (touch), and read the state the fixture prints beside the root.

/** Opens the fixture (with its query) and waits for every node to be measured. */
export async function openFixture(page: Page, query = "") {
    await page.goto(`/fixtures/basic/${query ? `?${query}` : ""}`);
    await expect(page.locator('[data-flow-part="node"]')).toHaveCount(5);
    await expect(
        page.locator('[data-flow-part="node"]:not([data-measured])'),
    ).toHaveCount(0);
    await expect(page.locator('[data-flow-part="edge"]')).toHaveCount(1);
}

/** A node by its id. */
export function node(page: Page, id: string): Locator {
    return page.locator(`[data-flow-part="node"][data-flow-id="${id}"]`);
}

/** A node's handle of a type. */
export function handle(page: Page, nodeId: string, type: "source" | "target") {
    return node(page, nodeId).locator(
        `[data-flow-part="handle"][data-handle-type="${type}"]`,
    );
}

/** The fixture's model as it prints it: its nodes and edges. */
export async function documentOf(page: Page): Promise<{
    nodes: {
        id: string;
        position: { x: number; y: number };
        width?: number;
        height?: number;
        selected?: boolean;
        parentId?: string;
    }[];
    edges: { id: string; source: string; target: string; selected?: boolean }[];
}> {
    return JSON.parse((await page.getByTestId("json").textContent()) ?? "{}");
}

/** A node of the document. */
export async function nodeOf(page: Page, id: string) {
    const found = (await documentOf(page)).nodes.find((n) => n.id === id);
    expect(found, id).toBeDefined();
    return found ?? { id, position: { x: Number.NaN, y: Number.NaN } };
}

/** The viewport the fixture prints. */
export async function viewportOf(
    page: Page,
): Promise<{ x: number; y: number; zoom: number }> {
    return JSON.parse(
        (await page.getByTestId("viewport").textContent()) ?? "{}",
    );
}

/** The engine's events the fixture logged, by type. */
export async function eventTypes(page: Page): Promise<string[]> {
    return (
        await page.getByTestId("events").locator("li").allTextContents()
    ).map((text) => (JSON.parse(text) as { type: string }).type);
}

/** The engine's events the fixture logged, whole. */
export async function events(
    page: Page,
): Promise<({ type: string } & Record<string, unknown>)[]> {
    return (
        await page.getByTestId("events").locator("li").allTextContents()
    ).map((text) => JSON.parse(text));
}

/** The centre of an element on screen. */
export async function center(locator: Locator) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    return {
        x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
        y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
    };
}

export type Point = { x: number; y: number };

/** Presses with the mouse at `from`, moves through `to` in steps, releases unless told not to. */
export async function mouseDrag(
    page: Page,
    from: Point,
    to: Point,
    options: { release?: boolean; steps?: number } = {},
) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: options.steps ?? 10 });
    if (options.release !== false) await page.mouse.up();
}

/** Whether the page runs in Chromium: its touch input is real (the DevTools protocol). */
function chromium(page: Page): boolean {
    return page.context().browser()?.browserType().name() === "chromium";
}

/** The points between `from` and `to`, `steps` of them, `to` included. */
function line(from: Point, to: Point, steps: number): Point[] {
    return Array.from({ length: steps }, (_, index) => ({
        x: from.x + ((to.x - from.x) * (index + 1)) / steps,
        y: from.y + ((to.y - from.y) * (index + 1)) / steps,
    }));
}

/**
 * Fingers on the screen: each finger moves from its `from` to its `to` together, in steps, then
 * all lift. Chromium gets real touch input (the DevTools protocol); Firefox touch pointer events
 * dispatched on the element under each finger, which bubble to the root as a finger's do (the
 * engine captures the pointer; a synthetic one cannot be, and its moves still reach the root).
 */
export async function touch(
    page: Page,
    fingers: { from: Point; to: Point }[],
    options: { steps?: number } = {},
) {
    const steps = options.steps ?? 10;
    const paths = fingers.map((finger) => line(finger.from, finger.to, steps));
    if (chromium(page)) {
        const client = await page.context().newCDPSession(page);
        await client.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: fingers.map((finger, id) => ({
                ...finger.from,
                id,
                radiusX: 0.5,
                radiusY: 0.5,
            })),
        });
        for (let step = 0; step < steps; step++) {
            await client.send("Input.dispatchTouchEvent", {
                type: "touchMove",
                touchPoints: paths.map((path, id) => ({
                    ...(path[step] as Point),
                    id,
                })),
            });
        }
        await client.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
        });
        await client.detach();
        return;
    }
    await page.evaluate(
        async ({ fingers, paths }) => {
            const targets = fingers.map(
                (finger) =>
                    document.elementFromPoint(finger.from.x, finger.from.y) ??
                    document.body,
            );
            const fire = (
                type: string,
                id: number,
                at: { x: number; y: number },
            ) =>
                targets[id]?.dispatchEvent(
                    new PointerEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        composed: true,
                        pointerId: 10 + id,
                        pointerType: "touch",
                        isPrimary: id === 0,
                        clientX: at.x,
                        clientY: at.y,
                        button: type === "pointermove" ? -1 : 0,
                        buttons: type === "pointerup" ? 0 : 1,
                    }),
                );
            const frame = () =>
                new Promise((done) => requestAnimationFrame(done));
            fingers.forEach((finger, id) => {
                fire("pointerdown", id, finger.from);
            });
            await frame();
            for (let step = 0; step < (paths[0]?.length ?? 0); step++) {
                paths.forEach((path, id) => {
                    const at = path[step];
                    if (at) fire("pointermove", id, at);
                });
                await frame();
            }
            paths.forEach((path, id) => {
                fire("pointerup", id, path.at(-1) ?? { x: 0, y: 0 });
            });
            await frame();
        },
        { fingers, paths },
    );
}

/** One finger from `from` to `to`. */
export async function touchDrag(page: Page, from: Point, to: Point) {
    await touch(page, [{ from, to }]);
}
