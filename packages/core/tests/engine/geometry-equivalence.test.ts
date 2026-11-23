// @vitest-environment jsdom
// The engine's cached geometry against a from-scratch computation (Epic #61, Issue #59): random
// flows (sub-flows, origins, hidden nodes, declared sizes and handles, every edge type, every
// z-index mode, culled or not) go through random commands, measurements, gestures, viewport and
// option changes; after each step every geometry read of the engine is compared with the reads of
// a fresh engine over the same document, sizes, handles, options and viewport. A stale cache (after
// a move, a resize, a reparent, a measurement, a removal, an option change) shows as a difference.
// Positions, sizes and viewport offsets are integers and zooms powers of two, so the handle
// measurements (client rects divided by the zoom) are exact in both engines.
import { afterEach, describe, expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import { drag } from "../../src/drag/drag";
import type { FlowEngineOptions } from "../../src/engine/create-flow-engine";
import { selection } from "../../src/selection/selection";
import { subflows } from "../../src/subflows/subflows";
import {
    type HandleSpec,
    type Mounted,
    mount,
    pointer,
    unmountAll,
} from "./harness";

afterEach(unmountAll);

const features = [selection(), subflows(), drag({ threshold: 0 })] as const;
type Features = typeof features;
type Flow = Mounted<Features>;

/** A seeded random source (mulberry32). */
function randomOf(seed: number) {
    let state = seed >>> 0;
    const next = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const int = (min: number, max: number) =>
        min + Math.floor(next() * (max - min + 1));
    const pick = <V>(values: readonly V[]): V =>
        values[Math.floor(next() * values.length)] as V;
    const chance = (p: number) => next() < p;
    return { next, int, pick, chance };
}
type Random = ReturnType<typeof randomOf>;

const SIDES = ["top", "right", "bottom", "left"] as const;
const EDGE_TYPES = [
    undefined,
    "bezier",
    "simplebezier",
    "smoothstep",
    "step",
    "straight",
    "custom",
] as const;
const ORIGINS = [undefined, { x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0 }];
const MODES = [undefined, "basic", "auto", "manual"] as const;
const ZOOMS = [0.5, 1, 2];

interface Scenario {
    json: FlowJson;
    sizes: Record<string, [number, number]>;
    handles: HandleSpec[];
    options: FlowEngineOptions;
}

/** An even size, so a centred origin keeps the boxes on integers. */
const evenSize = (random: Random): [number, number] => [
    2 * random.int(5, 60),
    2 * random.int(5, 40),
];

function pathOptionsOf(random: Random) {
    return random.chance(0.5)
        ? undefined
        : {
              curvature: random.pick([0.25, 0.5, 1]),
              borderRadius: random.int(0, 10),
              offset: random.int(5, 30),
          };
}

function scenario(random: Random): Scenario {
    const count = random.int(2, 22);
    const nodes: FlowJson["nodes"] = [];
    const sizes: Record<string, [number, number]> = {};
    const handles: HandleSpec[] = [];
    for (let i = 0; i < count; i++) {
        const id = `n${i}`;
        const node: Record<string, unknown> = {
            id,
            type: "default",
            position: { x: random.int(-300, 1200), y: random.int(-300, 900) },
            data: {},
        };
        const sizing = random.next();
        if (sizing < 0.2) {
            const [width, height] = evenSize(random);
            node.width = width;
            node.height = height;
        } else if (sizing < 0.45) {
            const [width, height] = evenSize(random);
            node.initialWidth = width;
            node.initialHeight = height;
            if (random.chance(0.6)) sizes[id] = evenSize(random);
        } else if (sizing < 0.9) {
            sizes[id] = evenSize(random);
        }
        if (random.chance(0.2)) node.origin = random.pick(ORIGINS.slice(1));
        if (random.chance(0.1)) node.hidden = true;
        if (random.chance(0.25)) node.zIndex = random.int(-2, 3);
        if (random.chance(0.15)) node.selected = true;
        if (random.chance(0.15)) node.sourcePosition = random.pick(SIDES);
        if (random.chance(0.15)) node.targetPosition = random.pick(SIDES);
        if (i > 0 && random.chance(0.3)) {
            node.parentId = `n${random.int(0, i - 1)}`;
            node.position = { x: random.int(0, 80), y: random.int(0, 60) };
            if (random.chance(0.3)) node.extent = "parent";
            if (random.chance(0.2)) node.expandParent = true;
        }
        if (random.chance(0.25)) {
            node.handles = [
                {
                    type: "source",
                    position: random.pick(SIDES),
                    x: random.int(0, 20),
                    y: random.int(0, 20),
                    width: 2 * random.int(0, 5),
                    height: 2 * random.int(0, 5),
                },
                {
                    id: "t1",
                    type: "target",
                    position: random.pick(SIDES),
                    x: random.int(0, 20),
                    y: random.int(0, 20),
                },
            ];
        }
        if (sizes[id] && random.chance(0.4)) {
            handles.push({
                nodeId: id,
                type: "source",
                side: random.pick(SIDES),
                x: random.int(0, 20),
                y: random.int(0, 20),
            });
            if (random.chance(0.5)) {
                handles.push({
                    nodeId: id,
                    handleId: "s1",
                    type: "source",
                    side: random.pick(SIDES),
                    x: random.int(0, 20),
                    y: random.int(0, 20),
                    size: 4,
                });
            }
        }
        nodes.push(node as FlowJson["nodes"][number]);
    }
    const edges: FlowJson["edges"] = [];
    const pairs = new Set<string>();
    const edgeCount = random.int(0, Math.min(30, count * 2));
    for (let j = 0; j < edgeCount; j++) {
        const source = `n${random.int(0, count - 1)}`;
        const target = `n${random.int(0, count - 1)}`;
        const sourceHandle = random.chance(0.2) ? "s1" : undefined;
        const targetHandle = random.chance(0.2) ? "t1" : undefined;
        const key = `${source}:${sourceHandle}:${target}:${targetHandle}`;
        if (pairs.has(key)) continue;
        pairs.add(key);
        const edge: Record<string, unknown> = { id: `e${j}`, source, target };
        if (sourceHandle) edge.sourceHandle = sourceHandle;
        if (targetHandle) edge.targetHandle = targetHandle;
        const type = random.pick(EDGE_TYPES);
        if (type) edge.type = type;
        if (random.chance(0.2)) edge.zIndex = random.int(-1, 4);
        if (random.chance(0.1)) edge.hidden = true;
        if (random.chance(0.15)) edge.selected = true;
        if (random.chance(0.15)) edge.pathOptions = pathOptionsOf(random) ?? {};
        edges.push(edge as FlowJson["edges"][number]);
    }
    const options: FlowEngineOptions = {
        defaultViewport: {
            x: random.int(-200, 200),
            y: random.int(-200, 200),
            zoom: random.pick(ZOOMS),
        },
        minZoom: 0.25,
        maxZoom: 4,
    };
    const origin = random.pick(ORIGINS);
    if (origin) options.nodeOrigin = origin;
    const mode = random.pick(MODES);
    if (mode) options.zIndexMode = mode;
    if (random.chance(0.6)) options.onlyRenderVisible = true;
    if (random.chance(0.3)) options.elevateNodesOnSelect = random.chance(0.5);
    if (random.chance(0.3)) options.elevateEdgesOnSelect = random.chance(0.5);
    const pathOptions = pathOptionsOf(random);
    if (pathOptions) options.pathOptions = pathOptions;
    return { json: { version: 1, nodes, edges }, sizes, handles, options };
}

/** Every geometry read of an engine, keyed by what it reads. */
function reads(flow: Flow, probe: { x: number; y: number }) {
    const { engine, model } = flow;
    const out: Record<string, unknown> = {};
    const ids = (list: readonly { id: string }[]) => list.map((e) => e.id);
    out.visibleNodes = ids(engine.get("visible-nodes"));
    out.visibleEdges = ids(engine.get("visible-edges"));
    out.drawnEdges = ids(engine.get("drawn-edges"));
    out.layers = engine.get("render-layers");
    out.bounds = engine.get("nodes-bounds", {});
    out.intersectingRect = ids(
        engine.get("intersecting-nodes", {
            rect: { x: probe.x, y: probe.y, width: 300, height: 200 },
        }),
    );
    out.insideRect = ids(
        engine.get("intersecting-nodes", {
            rect: { x: probe.x, y: probe.y, width: 600, height: 400 },
            partial: false,
        }),
    );
    for (const node of model.get("all-nodes")) {
        const nodeId = node.id;
        out[`node ${nodeId}`] = {
            rect: engine.get("node-rect-by", { nodeId }),
            z: engine.get("node-z-index-by", { nodeId }),
            handles: engine.get("handles-by", { nodeId }),
            internal: engine.get("internal-node-by", { nodeId }),
            measured: engine.is("node-measured", { nodeId }),
            toolbar: engine.get("node-toolbar-by", { nodeId }),
            intersecting: ids(engine.get("intersecting-nodes", { nodeId })),
            // a gesture's state (data-dragging) is the engine's own, not geometry
            attributes: {
                ...engine.adapter.attributes("node", { nodeId }),
                "data-dragging": undefined,
            },
        };
    }
    for (const edge of model.get("all-edges")) {
        const edgeId = edge.id;
        out[`edge ${edgeId}`] = {
            path: engine.get("edge-path-by", { edgeId }),
            toolbar: engine.get("edge-toolbar-by", { edgeId }),
        };
    }
    return out;
}

/** The state the test keeps to build a fresh engine like the one under test. */
interface Tracked {
    sizes: Record<string, [number, number]>;
    handles: HandleSpec[];
    options: FlowEngineOptions;
    culled: Set<string>;
    /** the observer of the engine under test (each fresh mount makes its own) */
    observer: ReturnType<Flow["observer"]>;
}

function fresh(flow: Flow, tracked: Tracked): Flow {
    const present = new Set(flow.model.get("all-nodes").map((node) => node.id));
    const sizes = Object.fromEntries(
        Object.entries(tracked.sizes).filter(([id]) => present.has(id)),
    );
    return mount(flow.model.get("flow-json"), {
        features,
        engine: {
            ...tracked.options,
            defaultViewport: flow.engine.get("viewport"),
        },
        sizes,
        handles: tracked.handles.filter((spec) => present.has(spec.nodeId)),
    }) as Flow;
}

function compare(
    flow: Flow,
    tracked: Tracked,
    probe: { x: number; y: number },
    at: string,
) {
    const other = fresh(flow, tracked);
    try {
        expect(reads(flow, probe), at).toEqual(reads(other, probe));
    } finally {
        other.engine.destroy();
        other.root.remove();
    }
}

/** One random step: a command, a measurement, a gesture, a viewport or an option change. */
function step(
    flow: Flow,
    tracked: Tracked,
    random: Random,
    serial: number,
): string {
    const { model, engine } = flow;
    const nodes = model.get("all-nodes");
    const edges = model.get("all-edges");
    const someNode = () => random.pick(nodes)?.id ?? "none";
    const someEdge = () => random.pick(edges)?.id ?? "none";
    const kind = random.int(0, 21);
    switch (kind) {
        case 0:
        case 1: {
            const nodeId = someNode();
            model.run("node.move", {
                nodeId,
                position: {
                    x: random.int(-300, 1200),
                    y: random.int(-300, 900),
                },
            });
            return `node.move ${nodeId}`;
        }
        case 2: {
            const nodeId = someNode();
            const [width, height] = evenSize(random);
            model.run("node.resize", { nodeId, width, height });
            return `node.resize ${nodeId}`;
        }
        case 3: {
            const nodeId = someNode();
            const node = model.get("node-by", { id: nodeId });
            model.run("node.set-flags", {
                nodeId,
                hidden: node?.hidden !== true,
            });
            return `node hidden ${nodeId}`;
        }
        case 4: {
            const nodeId = someNode();
            model.run("node.set-z-index", {
                nodeId,
                zIndex: random.chance(0.2) ? null : random.int(-2, 3),
            });
            return `node.set-z-index ${nodeId}`;
        }
        case 5: {
            const nodeId = someNode();
            const parentId = random.chance(0.3) ? null : someNode();
            model.run("node.set-parent", {
                nodeId,
                parentId,
                ...(random.chance(0.3) ? { extent: "parent" as const } : {}),
            });
            return `node.set-parent ${nodeId} ${parentId}`;
        }
        case 6: {
            const id = `added${serial}`;
            const size = random.chance(0.7) ? evenSize(random) : undefined;
            const result = model.run("node.add", {
                id,
                type: "default",
                position: {
                    x: random.int(-300, 1200),
                    y: random.int(-300, 900),
                },
                data: {},
                ...(random.chance(0.3)
                    ? { initialWidth: 40, initialHeight: 20 }
                    : {}),
            });
            if (result.ok) {
                if (size) tracked.sizes[id] = size;
                const element = flow.addNode(id, size);
                engine.adapter.registerNode(id, element);
            }
            return `node.add ${id}`;
        }
        case 7: {
            const nodeId = someNode();
            const result = model.run("node.remove", { nodeId });
            if (result.ok) {
                for (const id of result.value.removedNodeIds) {
                    engine.adapter.registerNode(id, null);
                    tracked.culled.delete(id);
                }
            }
            return `node.remove ${nodeId}`;
        }
        case 8: {
            const source = someNode();
            const target = someNode();
            model.run("edge.add", {
                source,
                target,
                ...(random.chance(0.2) ? { sourceHandle: "s1" } : {}),
                type: random.pick(EDGE_TYPES),
                ...(random.chance(0.2) ? { zIndex: random.int(-1, 4) } : {}),
            });
            return `edge.add ${source} ${target}`;
        }
        case 9: {
            const edgeId = someEdge();
            model.run("edge.remove", { edgeId });
            return `edge.remove ${edgeId}`;
        }
        case 10: {
            const edgeId = someEdge();
            const edge = model.get("edge-by", { id: edgeId });
            model.run("edge.set-flags", {
                edgeId,
                hidden: edge?.hidden !== true,
            });
            return `edge hidden ${edgeId}`;
        }
        case 11: {
            const edgeId = someEdge();
            model.run("edge.set-z-index", {
                edgeId,
                zIndex: random.int(-1, 4),
            });
            return `edge.set-z-index ${edgeId}`;
        }
        case 12: {
            const nodeIds = nodes
                .filter(() => random.chance(0.2))
                .map((n) => n.id);
            const edgeIds = edges
                .filter(() => random.chance(0.2))
                .map((e) => e.id);
            model.run("selection.set", { nodeIds, edgeIds });
            return "selection.set";
        }
        case 13: {
            const moved = nodes.filter(() => random.chance(0.3));
            model.run("batch", {
                commands: moved.map((node) => ({
                    command: "node.move",
                    payload: {
                        nodeId: node.id,
                        position: {
                            x: node.position.x + random.int(-50, 50),
                            y: node.position.y + random.int(-50, 50),
                        },
                    },
                })),
            });
            return "batch of moves";
        }
        case 14:
        case 15: {
            // a measurement: a rendered node's size changes (or it gets its first one)
            const candidates = nodes.filter((n) => !tracked.culled.has(n.id));
            const nodeId = random.pick(candidates)?.id;
            if (nodeId === undefined) return "no measurement";
            const size = evenSize(random);
            tracked.sizes[nodeId] = size;
            flow.sizes.set(nodeId, size);
            tracked.observer?.trigger([flow.node(nodeId)]);
            return `measure ${nodeId}`;
        }
        case 16: {
            engine.run("set-viewport", {
                x: random.int(-600, 400),
                y: random.int(-600, 400),
                zoom: random.pick(ZOOMS),
            });
            return "set-viewport";
        }
        case 17: {
            engine.run("pan-by", {
                x: random.int(-300, 300),
                y: random.int(-300, 300),
            });
            return "pan-by";
        }
        case 18: {
            const change: FlowEngineOptions = {};
            const which = random.int(0, 5);
            if (which === 0) change.pathOptions = pathOptionsOf(random) ?? {};
            if (which === 1) change.zIndexMode = random.pick(MODES.slice(1));
            if (which === 2) change.nodeOrigin = random.pick(ORIGINS.slice(1));
            if (which === 3)
                change.onlyRenderVisible = !(
                    tracked.options.onlyRenderVisible ?? false
                );
            if (which === 4) change.elevateEdgesOnSelect = random.chance(0.5);
            if (which === 5) change.elevateNodesOnSelect = random.chance(0.5);
            tracked.options = { ...tracked.options, ...change };
            engine.adapter.setOptions(change);
            return `setOptions ${JSON.stringify(change)}`;
        }
        case 19: {
            // a node's element goes while it stays in the flow (culled), or comes back
            const candidates = nodes.filter(
                (n) => !tracked.handles.some((spec) => spec.nodeId === n.id),
            );
            const nodeId = random.pick(candidates)?.id;
            if (nodeId === undefined) return "no cull";
            if (tracked.culled.has(nodeId)) {
                tracked.culled.delete(nodeId);
                engine.adapter.registerNode(nodeId, flow.node(nodeId));
                return `uncull ${nodeId}`;
            }
            tracked.culled.add(nodeId);
            engine.adapter.registerNode(nodeId, null);
            return `cull ${nodeId}`;
        }
        case 20: {
            const nodeId = someNode();
            model.run("node.set-data", { nodeId, data: { serial } });
            return `node.set-data ${nodeId}`;
        }
        default: {
            // a drag gesture on a node's element, compared mid-gesture by the caller
            const candidates = nodes.filter(
                (n) => n.hidden !== true && !tracked.culled.has(n.id),
            );
            const nodeId = random.pick(candidates)?.id;
            if (nodeId === undefined) return "no drag";
            const start = engine.get("node-rect-by", { nodeId });
            if (!start) return "no drag";
            const at = flow.client(start.x + 1, start.y + 1);
            pointer(flow.node(nodeId), "pointerdown", at);
            for (let i = 1; i <= 3; i++) {
                pointer(flow.root, "pointermove", {
                    clientX: at.clientX + i * random.int(-20, 20),
                    clientY: at.clientY + i * random.int(-20, 20),
                });
            }
            return `drag ${nodeId}`;
        }
    }
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const STEPS = 25;

describe("the cached engine geometry", () => {
    it.each(SEEDS)(
        "reads as a fresh engine's through random commands, measurements and views (seed %i)",
        (seed) => {
            const random = randomOf(seed);
            const { json, sizes, handles, options } = scenario(random);
            const flow = mount(json, {
                features,
                engine: options,
                sizes,
                handles,
            }) as Flow;
            const tracked: Tracked = {
                sizes: { ...sizes },
                handles,
                options,
                culled: new Set(),
                observer: flow.observer(),
            };
            const probe = {
                x: random.int(-200, 600),
                y: random.int(-200, 400),
            };
            compare(flow, tracked, probe, "mount");
            for (let i = 0; i < STEPS; i++) {
                const what = step(flow, tracked, random, i);
                compare(flow, tracked, probe, `step ${i}: ${what}`);
                if (what.startsWith("drag ")) {
                    pointer(flow.root, "pointerup", {});
                    compare(flow, tracked, probe, `step ${i}: drop`);
                }
            }
        },
    );
});
