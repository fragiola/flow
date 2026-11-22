// The interaction options and gesture events of #33 in Angular: the new engine options and
// `defaultEdgeOptions` as root inputs, one output per engine event (`ENGINE_EVENT_CALLBACKS`:
// `(nodeClick)`, `(moveStart)`, …), `flowHandle`'s `connectableStart` / `connectableEnd`, the
// Controls' lock switching dragging, connecting and selecting, and a reconnect anchor drawn only at
// an end that may move: React's `tests/interaction.test.tsx`.
import { Component, input, type OutputEmitterRef } from "@angular/core";
import { connection } from "@fragiola/flow/connection";
import { drag as dragFeature } from "@fragiola/flow/drag";
import { reconnection } from "@fragiola/flow/reconnection";
import { selection } from "@fragiola/flow/selection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    type AnyTypes,
    createFlowRef,
    ENGINE_EVENT_CALLBACKS,
    FLOW,
    type FlowEdge,
    type FlowEngineEvent,
    type FlowEngineEventOf,
    type FlowFeatures,
    type FlowNode,
    type FlowRef,
    FlowRootDirective,
    injectHandle,
} from "../src/public-api";
import { TestFlow } from "./fixtures";
import { click, drag, installLayout, part, render, settle, task } from "./flow";

beforeEach(installLayout);

type Ref = FlowRef<AnyTypes, FlowFeatures>;
type Callbacks = typeof ENGINE_EVENT_CALLBACKS;

/** The outputs the table names, each typed by its event: the root has every one (a type error otherwise). */
type EventOutputs = {
    readonly [K in keyof Callbacks as Uncapitalize<
        Callbacks[K]
    >]: OutputEmitterRef<FlowEngineEventOf<K>>;
};
const typed: (root: FlowRootDirective) => EventOutputs = (root) => root;

/** The root's outputs that are not an engine event's. */
const OWN_OUTPUTS = [
    "nodesChange",
    "edgesChange",
    "viewportChange",
    "viewportMove",
];

/** A flow binding the new options and some event outputs, each told to `on`. */
@Component({
    selector: "test-events-flow",
    imports: [FLOW],
    template: `
        <div
            flowRoot
            [defaultNodes]="defaultNodes()"
            [features]="features()"
            [flowRef]="flowRef()"
            [defaultEdgeOptions]="defaultEdgeOptions()"
            [preventScrolling]="preventScrolling()"
            [zoomOnScroll]="zoomOnScroll()"
            [paneClickDistance]="paneClickDistance()"
            (init)="on()?.('init', $event)"
            (nodeClick)="on()?.('nodeClick', $event)"
            (paneClick)="on()?.('paneClick', $event)"
            (moveStart)="on()?.('moveStart', $event)"
            (moveEnd)="on()?.('moveEnd', $event)"
        >
            <div flowViewport>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node"></div>
                </div>
            </div>
        </div>
    `,
})
class EventsFlow {
    readonly defaultNodes = input<readonly FlowNode[] | undefined>();
    readonly features = input<FlowFeatures | undefined>();
    readonly flowRef = input<Ref | undefined>();
    readonly defaultEdgeOptions = input<Partial<FlowEdge> | undefined>();
    readonly preventScrolling = input<boolean | undefined>();
    readonly zoomOnScroll = input<boolean | undefined>();
    readonly paneClickDistance = input<number | undefined>();
    readonly on = input<(name: string, event: FlowEngineEvent) => void>();
}

/** The calls `on` got for one output. */
const callsOf = (on: ReturnType<typeof vi.fn>, name: string) =>
    on.mock.calls
        .filter(([called]) => called === name)
        .map(([, event]) => event as FlowEngineEvent);

describe("the root's event outputs", () => {
    it("has one per engine event, named from the core's table, and no other", () => {
        expect(typeof typed).toBe("function");
        const names = Object.values(ENGINE_EVENT_CALLBACKS).map(
            (name) => name.charAt(0).toLowerCase() + name.slice(1),
        );
        expect(names).toContain("nodeClick");
        expect(names).toContain("moveStart");
        expect(names).toContain("init");
        expect(names).toContain("delete");
        const outputs = Object.keys(
            (
                FlowRootDirective as unknown as {
                    ɵdir: { outputs: Record<string, string> };
                }
            ).ɵdir.outputs,
        ).filter((name) => !OWN_OUTPUTS.includes(name));
        expect(outputs.sort()).toEqual(names.sort());
    });

    it("emits each with the event", async () => {
        const on = vi.fn();
        const { container } = await render(EventsFlow, {
            defaultNodes: [task("a", 0, 0)],
            features: [selection()],
            on,
        });
        expect(callsOf(on, "init")).toEqual([{ type: "ready" }]);
        const root = part(container, "root");
        await drag(part(container, "node", "a"), root, [
            { clientX: 10, clientY: 10 },
        ]);
        expect(callsOf(on, "nodeClick")).toEqual([
            expect.objectContaining({ type: "node-click", nodeId: "a" }),
        ]);
        await drag(root, root, [
            { clientX: 500, clientY: 400 },
            { clientX: 540, clientY: 400 },
        ]);
        expect(callsOf(on, "paneClick")).toHaveLength(0);
        expect(callsOf(on, "moveStart")).toHaveLength(1);
        expect(callsOf(on, "moveEnd")).toEqual([
            expect.objectContaining({
                type: "viewport-change-end",
                viewport: { x: 40, y: 0, zoom: 1 },
            }),
        ]);
        await drag(root, root, [{ clientX: 500, clientY: 400 }]);
        expect(callsOf(on, "paneClick")).toHaveLength(1);
    });
});

describe("the new engine options and defaultEdgeOptions", () => {
    it("reach the engine, and the model the root creates", async () => {
        const flowRef = createFlowRef();
        const { container, set } = await render(EventsFlow, {
            flowRef,
            defaultNodes: [task("a"), task("b", 0, 200)],
            defaultEdgeOptions: { type: "step" },
            preventScrolling: false,
            zoomOnScroll: false,
        });
        const root = part(container, "root");
        const wheel = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: 10,
        });
        root.dispatchEvent(wheel);
        expect(wheel.defaultPrevented).toBe(false);
        await set({ preventScrolling: undefined });
        const prevented = new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: 10,
        });
        root.dispatchEvent(prevented);
        expect(prevented.defaultPrevented).toBe(true);
        flowRef.current?.model.run("edge.add", { source: "a", target: "b" });
        expect(flowRef.current?.model.get("all-edges")[0]?.type).toBe("step");
    });

    it("take the tap distances", async () => {
        const on = vi.fn();
        const { container } = await render(EventsFlow, {
            defaultNodes: [task("a")],
            paneClickDistance: 30,
            on,
        });
        const root = part(container, "root");
        await drag(root, root, [
            { clientX: 500, clientY: 400 },
            { clientX: 520, clientY: 400 },
        ]);
        expect(callsOf(on, "paneClick")).toHaveLength(1);
    });
});

/** A handle rendered by hand (`injectHandle`), no connection ending at it. */
@Component({ selector: "span[testEndless]", template: "" })
class EndlessHandle {
    readonly own = injectHandle({
        type: "target",
        side: "top",
        handleId: "hand",
        connectableEnd: false,
    });
}

/** Two nodes with named handles (and `e` between them, with `reconnectable`), for connections. */
@Component({
    selector: "test-handles-flow",
    imports: [FLOW, EndlessHandle],
    template: `
        <div
            flowRoot
            [defaultNodes]="nodes"
            [defaultEdges]="edges()"
            [features]="features"
            (connectStart)="on()?.('connectStart', $event)"
        >
            <div flowViewport>
                <div flowEdges>
                    <ng-template flowEdgesItem let-edge>
                        <svg:g [flowEdge]="edge">
                            <svg:path flowEdgePath />
                            <svg:circle flowReconnectAnchor end="source" />
                            <svg:circle flowReconnectAnchor end="target" />
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        @if (node.id === "a") {
                            <div flowHandle type="source" side="right" handleId="out" [connectableStart]="start()"></div>
                        } @else {
                            <div flowHandle type="target" side="left" handleId="in" [connectableEnd]="end()"></div>
                            <span testEndless></span>
                        }
                    </div>
                </div>
            </div>
        </div>
    `,
})
class HandlesFlow {
    readonly start = input<boolean | undefined>();
    readonly end = input<boolean | undefined>();
    readonly reconnectable = input<boolean | "source" | "target">();
    readonly on = input<(name: string, event: FlowEngineEvent) => void>();
    readonly nodes = [task("a", 0, 0), task("b", 300, 0)];
    readonly features = [connection(), reconnection()];

    edges(): FlowEdge[] {
        const reconnectable = this.reconnectable();
        return reconnectable === undefined
            ? []
            : [
                  {
                      id: "e",
                      source: "a",
                      sourceHandle: "out",
                      target: "b",
                      targetHandle: "in",
                      reconnectable,
                  } as FlowEdge,
              ];
    }
}

describe("flowHandle's connectableStart and connectableEnd", () => {
    it("reach the registration and the part attributes", async () => {
        const on = vi.fn();
        const { container } = await render(HandlesFlow, {
            start: false,
            end: false,
            on,
        });
        const out = part(container, "handle", "out");
        const into = part(container, "handle", "in");
        expect(out.hasAttribute("data-connectable-start")).toBe(false);
        expect(out.hasAttribute("data-connectable-end")).toBe(true);
        expect(into.hasAttribute("data-connectable-end")).toBe(false);
        expect(into.hasAttribute("data-connectable-start")).toBe(true);
        // injectHandle takes them too
        const hand = part(container, "handle", "hand");
        expect(hand.hasAttribute("data-connectable-end")).toBe(false);
        await drag(out, part(container, "root"), [
            { clientX: 100, clientY: 20 },
            { clientX: 200, clientY: 20 },
        ]);
        expect(callsOf(on, "connectStart")).toHaveLength(0);
    });

    it("start a connection where allowed", async () => {
        const on = vi.fn();
        const { container } = await render(HandlesFlow, { on });
        await drag(part(container, "handle", "out"), part(container, "root"), [
            { clientX: 100, clientY: 20 },
            { clientX: 200, clientY: 20 },
        ]);
        expect(callsOf(on, "connectStart")).toHaveLength(1);
    });
});

describe("flowReconnectAnchor", () => {
    const ends = (container: HTMLElement) =>
        [
            ...container.querySelectorAll(
                '[data-flow-part="reconnect-anchor"]',
            ),
        ].map((anchor) => anchor.getAttribute("data-end"));

    it("is in the document only at an end that may move", async () => {
        const { container } = await render(HandlesFlow, {
            reconnectable: "target",
        });
        expect(ends(container)).toEqual(["target"]);
    });

    it("draws both ends of a reconnectable edge", async () => {
        const { container } = await render(HandlesFlow, {
            reconnectable: true,
        });
        expect(ends(container)).toEqual(["source", "target"]);
    });
});

describe("the Controls' lock", () => {
    it("switches dragging, connecting and selecting, React Flow's way", async () => {
        const flowRef = createFlowRef();
        const { container } = await render(TestFlow, {
            flowRef,
            controls: true,
            defaultNodes: [task("a")],
            features: [selection(), dragFeature()],
        });
        const button = part(container, "toggle-interactive");
        expect(button.getAttribute("aria-pressed")).toBe("false");
        await click(button);
        const engine = flowRef.current?.engine;
        expect(engine?.is("interactive-by", { kind: "drag" })).toBe(false);
        expect(engine?.is("interactive-by", { kind: "connect" })).toBe(false);
        expect(engine?.is("interactive-by", { kind: "select" })).toBe(false);
        expect(engine?.is("interactive")).toBe(true);
        expect(button.getAttribute("aria-pressed")).toBe("true");
        // locked: a drag moves nothing
        await drag(part(container, "node", "a"), part(container, "root"), [
            { clientX: 10, clientY: 10 },
            { clientX: 60, clientY: 10 },
        ]);
        expect(
            flowRef.current?.model.get("node-by", { id: "a" })?.position.x,
        ).toBe(0);
        await click(button);
        expect(engine?.is("interactive-by", { kind: "drag" })).toBe(true);
        expect(button.getAttribute("aria-pressed")).toBe("false");
        // a flow locked by `interactive` unlocks whole
        engine?.run("set-interactive", { interactive: false });
        await settle();
        expect(button.getAttribute("aria-pressed")).toBe("true");
        await click(button);
        expect(engine?.is("interactive")).toBe(true);
    });
});
