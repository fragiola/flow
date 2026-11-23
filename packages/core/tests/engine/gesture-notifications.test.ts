// @vitest-environment jsdom
// One view notification (`engine.adapter.subscribe`) per gesture step (Issue #59): a pan, a drag, a
// resize and a connection each tell the adapters once per pointer move, the pan's first move too
// (its panning state comes with its viewport change). Every notification makes each adapter read
// the view again, so a second one per step doubled the work of every frame.
import { afterEach, describe, expect, it } from "vitest";
import { connection } from "../../src/connection/connection";
import { drag } from "../../src/drag/drag";
import { resize } from "../../src/resize/resize";
import { selection } from "../../src/selection/selection";
import { flowOf, mount, pointer, unmountAll } from "./harness";

afterEach(unmountAll);

const flow = () =>
    mount(flowOf({ a: [0, 0], b: [300, 0] }), {
        features: [selection(), drag({ threshold: 0 }), resize(), connection()],
        sizes: { a: [100, 40], b: [100, 40] },
        handles: [
            { nodeId: "a", type: "source", side: "right", x: 95, y: 15 },
            { nodeId: "b", type: "target", side: "left", x: 0, y: 15 },
        ],
    });

/** The notifications of each move of a press on `target` from `start`, by `step` pixels. */
function perStep(
    mounted: ReturnType<typeof flow>,
    target: Element,
    start: { clientX: number; clientY: number },
    step: number,
): number[] {
    let count = 0;
    const stop = mounted.engine.adapter.subscribe(() => {
        count += 1;
    });
    pointer(target, "pointerdown", start);
    const counts: number[] = [];
    for (let i = 1; i <= 3; i++) {
        count = 0;
        pointer(mounted.root, "pointermove", {
            clientX: start.clientX + i * step,
            clientY: start.clientY,
        });
        counts.push(count);
    }
    pointer(mounted.root, "pointerup", {
        clientX: start.clientX + 3 * step,
        clientY: start.clientY,
    });
    stop();
    return counts;
}

describe("a gesture step", () => {
    it("of a pan notifies once, its first one too", () => {
        const mounted = flow();
        expect(
            perStep(mounted, mounted.root, { clientX: 600, clientY: 400 }, 10),
        ).toEqual([1, 1, 1]);
        expect(mounted.engine.get("viewport").x).toBe(30);
    });

    it("of a drag notifies once", () => {
        const mounted = flow();
        expect(
            perStep(mounted, mounted.node("a"), mounted.client(10, 10), 10),
        ).toEqual([1, 1, 1]);
    });

    it("of a resize notifies once", () => {
        const mounted = flow();
        const handle = document.createElement("div");
        handle.setAttribute("data-flow-part", "resize-handle");
        handle.setAttribute("data-position", "bottom-right");
        mounted.node("a").append(handle);
        expect(perStep(mounted, handle, mounted.client(100, 40), 10)).toEqual([
            1, 1, 1,
        ]);
    });

    it("of a connection notifies once", () => {
        const mounted = flow();
        const handle = mounted.handle("a", "source");
        const box = handle.getBoundingClientRect();
        expect(
            perStep(
                mounted,
                handle,
                { clientX: box.left + 2, clientY: box.top + 2 },
                20,
            ),
        ).toEqual([1, 1, 1]);
    });
});
