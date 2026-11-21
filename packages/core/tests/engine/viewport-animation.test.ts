// @vitest-environment jsdom
// Animated viewport actions (`duration`): frames from the root window's `requestAnimationFrame`
// (faked here), a `viewport-change` with `gesture: false` each frame, the final viewport as the
// action's result; another action, a gesture, `cancel-gesture` and `destroy` stop it.
import { afterEach, describe, expect, it } from "vitest";
import type { EngineActionKey } from "../../src/engine/verbs";
import { animateViewport } from "../../src/engine/viewport-animation";
import type { Viewport } from "../../src/geometry/types";
import {
    flowOf,
    installFrames,
    mount,
    pointer,
    unmountAll,
    wheel,
} from "./harness";

afterEach(unmountAll);

const nodes = () =>
    mount(flowOf({ a: [0, 0], b: [400, 150] }), {
        sizes: { a: [100, 50], b: [100, 50] },
    });

const viewportEvents = (events: readonly { type: string }[]) =>
    events.filter(
        (
            event,
        ): event is { type: "viewport-change" } & {
            viewport: Viewport;
            gesture: boolean;
        } => event.type === "viewport-change",
    );

const cases: [EngineActionKey, Record<string, unknown>][] = [
    ["set-viewport", { x: 120, y: -40, zoom: 1.5 }],
    ["zoom-in", { around: { x: 100, y: 100 } }],
    ["zoom-out", {}],
    ["zoom-to", { zoom: 1.8 }],
    ["fit-view", { nodeIds: ["a", "b"] }],
    ["center-on", { x: 300, y: 200, zoom: 0.8 }],
];

describe("animated viewport actions", () => {
    it.each(cases)(
        "%s reaches its viewport after its duration, frame by frame",
        (action, payload) => {
            const instant = nodes();
            const run = instant.engine.run as (
                key: string,
                payload: object,
            ) => { ok: boolean; value?: unknown };
            const expected = run(action, payload);
            expect(expected.ok).toBe(true);
            // with no duration it applies at once (today's behaviour)
            expect(instant.engine.get("viewport")).toEqual(expected.value);
            unmountAll();

            const frames = installFrames();
            const { engine, events } = nodes();
            const animated = (
                engine.run as (key: string, payload: object) => unknown
            )(action, { ...payload, duration: 200 });
            expect(animated).toEqual(expected);
            // nothing moved yet: the first frame starts the clock
            expect(engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
            expect(frames.pending).toBe(1);
            frames.frame();
            frames.frame(100);
            const halfway = engine.get("viewport");
            expect(halfway).not.toEqual({ x: 0, y: 0, zoom: 1 });
            expect(halfway).not.toEqual(expected.value);
            frames.flush(50);
            expect(engine.get("viewport")).toEqual(expected.value);
            expect(frames.pending).toBe(0);
            const changes = viewportEvents(events);
            expect(changes.length).toBeGreaterThanOrEqual(3);
            expect(changes.every((change) => !change.gesture)).toBe(true);
            expect(changes.at(-1)?.viewport).toEqual(expected.value);
        },
    );

    it("eases with the default easing, or the engine's own", () => {
        const frames = installFrames();
        const { engine, events } = mount(flowOf({}));
        engine.run("set-viewport", { x: 100, duration: 100 });
        frames.frame();
        frames.frame(25);
        // a smooth ease is slow at its start: a quarter of the time is less of the way
        expect(engine.get("viewport").x).toBeCloseTo(100 * 4 * 0.25 ** 3);
        frames.frame(25);
        expect(engine.get("viewport").x).toBeCloseTo(50);
        frames.flush(25);
        expect(engine.get("viewport").x).toBe(100);
        expect(viewportEvents(events).map((e) => e.viewport.x)).toEqual([
            100 * 4 * 0.25 ** 3,
            50,
            expect.any(Number),
            100,
        ]);
        engine.adapter.setOptions({ easing: (t) => t });
        engine.run("set-viewport", { x: 0, duration: 100 });
        frames.frame();
        frames.frame(25);
        expect(engine.get("viewport").x).toBeCloseTo(75);
    });

    it("keeps the zoom limits and the translate extent, and keeps a zoom's point still", () => {
        const frames = installFrames();
        const { engine } = mount(flowOf({}), {
            engine: {
                maxZoom: 2,
                translateExtent: { x: 0, y: 0, width: 1000, height: 1000 },
            },
        });
        expect(
            engine.run("set-viewport", { x: 500, zoom: 4, duration: 100 }),
        ).toEqual({ ok: true, value: { x: 0, y: 0, zoom: 2 } });
        frames.flush(30);
        expect(engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 2 });
        engine.adapter.setOptions({ translateExtent: undefined });
        engine.run("zoom-to", {
            zoom: 1,
            around: { x: 200, y: 100 },
            duration: 100,
        });
        frames.frame();
        frames.frame(40);
        const mid = engine.get("viewport");
        // the flow point under (200, 100) stays there all the way
        expect((200 - mid.x) / mid.zoom).toBeCloseTo(100);
        expect((100 - mid.y) / mid.zoom).toBeCloseTo(50);
    });

    it("refuses a bad duration and dry runs animate nothing", () => {
        const frames = installFrames();
        const { engine } = mount(flowOf({}));
        for (const duration of [-1, Number.NaN, "100"]) {
            expect(
                engine.run("set-viewport", {
                    x: 1,
                    duration: duration as number,
                }),
            ).toMatchObject({
                ok: false,
                error: { code: "invalid_payload", path: "/duration" },
            });
        }
        expect(engine.check("zoom-in", { duration: 100 })).toMatchObject({
            ok: true,
            value: { zoom: 1.2 },
        });
        expect(frames.pending).toBe(0);
        // a duration to where it is already does not animate
        expect(engine.run("set-viewport", { x: 0, duration: 100 }).ok).toBe(
            true,
        );
        expect(frames.pending).toBe(0);
    });

    it("applies at once without a root, or with no frames on its window", () => {
        const { engine } = mount(flowOf({}));
        const view = window as { requestAnimationFrame?: unknown };
        const original = view.requestAnimationFrame;
        view.requestAnimationFrame = undefined;
        try {
            engine.run("set-viewport", { x: 30, duration: 100 });
            expect(engine.get("viewport").x).toBe(30);
        } finally {
            view.requestAnimationFrame = original;
        }
    });
});

describe("stopping an animation", () => {
    const started = () => {
        const frames = installFrames();
        const flow = mount(flowOf({}));
        flow.engine.run("set-viewport", { x: 100, duration: 100 });
        frames.frame();
        frames.frame(50);
        expect(flow.engine.get("viewport").x).toBeCloseTo(50);
        return { frames, ...flow };
    };

    it("stops where it is on another viewport action, which runs", () => {
        const { frames, engine } = started();
        engine.run("pan-by", { x: 0, y: 10 });
        expect(engine.get("viewport")).toEqual({ x: 50, y: 10, zoom: 1 });
        frames.flush();
        expect(engine.get("viewport")).toEqual({ x: 50, y: 10, zoom: 1 });
        // an animated one replaces it
        engine.run("set-viewport", { x: 100, duration: 100 });
        engine.run("set-viewport", { y: 100, duration: 100 });
        frames.flush(20);
        expect(engine.get("viewport")).toEqual({ x: 50, y: 100, zoom: 1 });
    });

    it("stops where it is on the wheel", () => {
        const { frames, engine, root } = started();
        wheel(root, { deltaY: -60, clientX: 0, clientY: 0 });
        const after = engine.get("viewport");
        expect(after.x).toBeCloseTo(50 * Math.exp(60 / 600));
        frames.flush();
        expect(engine.get("viewport")).toEqual(after);
        expect(frames.pending).toBe(0);
    });

    it("stops where it is when a pan drag starts", () => {
        const { frames, engine, root } = started();
        pointer(root, "pointerdown", { clientX: 10, clientY: 10 });
        frames.flush();
        expect(engine.get("viewport").x).toBeCloseTo(50);
        pointer(root, "pointermove", { clientX: 20, clientY: 10 });
        pointer(root, "pointerup", { clientX: 20, clientY: 10 });
        expect(engine.get("viewport").x).toBeCloseTo(60);
    });

    it("stops where it is on cancel-gesture, which takes it as a gesture", () => {
        const { frames, engine } = started();
        expect(engine.can("cancel-gesture")).toBe(true);
        expect(engine.run("cancel-gesture").ok).toBe(true);
        expect(frames.pending).toBe(0);
        expect(engine.get("viewport").x).toBeCloseTo(50);
        expect(engine.run("cancel-gesture").ok).toBe(false);
    });

    it("cancels its pending frame on destroy and on a detached root", () => {
        const first = started();
        expect(first.frames.pending).toBe(1);
        first.engine.destroy();
        expect(first.frames.pending).toBe(0);
        unmountAll();
        const second = started();
        second.engine.adapter.detachRoot();
        expect(second.frames.pending).toBe(0);
    });
});

describe("animateViewport", () => {
    it("runs on the window it is given and stops", () => {
        const calls: number[] = [];
        const queue = new Map<number, FrameRequestCallback>();
        let id = 0;
        const view = {
            requestAnimationFrame: (callback: FrameRequestCallback) => {
                queue.set(++id, callback);
                return id;
            },
            cancelAnimationFrame: (frame: number) => queue.delete(frame),
        } as unknown as Window;
        const run = (time: number) => {
            const due = [...queue.values()];
            queue.clear();
            for (const callback of due) callback(time);
        };
        let done = false;
        const stop = animateViewport({
            view,
            from: { x: 0, y: 0, zoom: 1 },
            to: { x: 10, y: 20, zoom: 2 },
            duration: 10,
            easing: (t) => t,
            step: (viewport) => calls.push(viewport.x),
            done: () => {
                done = true;
            },
        });
        run(0);
        run(5);
        expect(calls).toEqual([0, 5]);
        stop();
        expect(queue.size).toBe(0);
        run(10);
        expect(done).toBe(false);
    });
});
