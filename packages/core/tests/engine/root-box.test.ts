// @vitest-environment jsdom
// The root's box is read once per turn (#51): a second read in the same turn reuses it, a read
// after the root window's next microtask reads again, and attaching, detaching or new options
// read it again at once.
import { afterEach, describe, expect, it, vi } from "vitest";
import { flowOf, mount, unmountAll } from "./harness";

afterEach(unmountAll);

const json = () => flowOf({ a: [0, 0], b: [300, 0] });

const box = (width: number, height: number) =>
    ({
        left: 0,
        top: 0,
        width,
        height,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    }) as DOMRect;

const microtask = () => Promise.resolve();
/** the mount's own microtasks (the measured flush) done */
const settled = () => new Promise((resolve) => setTimeout(resolve));

describe("the root's box", () => {
    it("is read once in a turn and again after a microtask", async () => {
        const { engine, root } = mount(json(), {
            sizes: { a: [100, 40], b: [100, 40] },
            engine: { onlyRenderVisible: true },
        });
        await settled();
        const read = vi.spyOn(root, "getBoundingClientRect");
        engine.get("visible-nodes");
        engine.get("visible-edges");
        engine.get("render-layers");
        expect(read).toHaveBeenCalledTimes(1);
        await microtask();
        engine.get("visible-nodes");
        expect(read).toHaveBeenCalledTimes(2);
    });

    it("keeps its value within a turn and follows the root after it", async () => {
        const { engine, root } = mount(json(), {
            sizes: { a: [100, 40], b: [100, 40] },
            engine: { onlyRenderVisible: true },
            root: { left: 0, top: 0, width: 0, height: 0 },
        });
        await settled();
        expect(engine.get("visible-nodes")).toEqual([]);
        root.getBoundingClientRect = () => box(800, 600);
        expect(engine.get("visible-nodes")).toEqual([]);
        await microtask();
        expect(engine.get("visible-nodes").map((node) => node.id)).toEqual([
            "a",
            "b",
        ]);
    });

    it("is read again at once when the root detaches and attaches, or the options change", async () => {
        const { engine, root } = mount(json(), {
            sizes: { a: [100, 40], b: [100, 40] },
            engine: { onlyRenderVisible: true },
        });
        await settled();
        const read = vi.spyOn(root, "getBoundingClientRect");
        engine.get("visible-nodes");
        expect(read).toHaveBeenCalledTimes(1);
        engine.adapter.detachRoot();
        engine.adapter.attachRoot(root);
        engine.get("visible-nodes");
        expect(read).toHaveBeenCalledTimes(2);
        await microtask();
        expect(engine.get("visible-nodes")).toHaveLength(2);
        root.getBoundingClientRect = () => box(0, 0);
        expect(engine.get("visible-nodes")).toHaveLength(2);
        engine.adapter.setOptions({ minZoom: 0.25 });
        expect(engine.get("visible-nodes")).toEqual([]);
    });

    it("of a detached root is not kept: a root attached in the same turn is read", async () => {
        const { engine, root } = mount(json(), {
            sizes: { a: [100, 40], b: [100, 40] },
            engine: { onlyRenderVisible: true },
        });
        await settled();
        engine.get("visible-nodes");
        engine.adapter.detachRoot();
        const other = document.createElement("div");
        other.getBoundingClientRect = vi.fn(() => box(50, 50));
        root.replaceWith(other);
        engine.adapter.attachRoot(other);
        engine.get("visible-nodes");
        expect(other.getBoundingClientRect).toHaveBeenCalled();
        engine.adapter.detachRoot();
    });
});
