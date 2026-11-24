// @vitest-environment node
import { createFlowModel } from "@fragiola/flow-angular";
import { describe, expect, it } from "vitest";
import {
    type LayoutNode,
    layoutPositions,
} from "../src/examples/auto-layout/layout";
import {
    addChildCommands,
    childrenOf,
    collapsedIds,
    descendantsOf,
    isPlaceholder,
    PLACEHOLDER_SIZE,
    placeholderEdge,
    placeholderId,
    placeholderNode,
    TOPIC_SIZE,
    type TreeEdge,
    type TreeNode,
    toggleCommands,
    topicEdge,
    topicNode,
    topicOf,
    visibilityCommands,
    visibleIds,
} from "../src/examples/auto-layout/tree";

// The auto-layout example: the tree walks (children and descendants from the edges, placeholders
// apart), what shows under nested collapses, the commands that add a child and collapse or expand
// a topic (run on a real model, in one batch each), and the layout of the shown nodes only.

const ORIGIN = { x: 0, y: 0 };

// root ─ a ─ a1 ─ a1x
//      │   └ a2
//      └ b
const TOPICS: readonly (readonly [string, string?])[] = [
    ["root"],
    ["a", "root"],
    ["b", "root"],
    ["a1", "a"],
    ["a2", "a"],
    ["a1x", "a1"],
];

const treeNodes = () =>
    TOPICS.flatMap(([id]) => [
        topicNode(id, id.toUpperCase(), ORIGIN),
        placeholderNode(id, id.toUpperCase(), ORIGIN),
    ]);

const treeEdges = () =>
    TOPICS.flatMap(([id, parent]) => [
        ...(parent ? [topicEdge(parent, id)] : []),
        placeholderEdge(id),
    ]);

const modelOf = () =>
    createFlowModel({ version: 1, nodes: treeNodes(), edges: treeEdges() });

type Model = ReturnType<typeof modelOf>;

/** The model's nodes and edges as the tree reads them. */
const read = (model: Model) => ({
    nodes: model.get("all-nodes") as readonly TreeNode[],
    edges: model.get("all-edges") as readonly TreeEdge[],
});

const shownIn = (model: Model) =>
    model
        .get("all-nodes")
        .filter((node) => node.hidden !== true)
        .map((node) => node.id)
        .sort();

/** Collapses (or expands) a topic on the model, in one batch, as the example does. */
function toggle(model: Model, id: string, collapsed: boolean) {
    const { nodes, edges } = read(model);
    model.run("batch", {
        commands: toggleCommands(nodes, edges, id, collapsed),
    });
}

describe("ids", () => {
    it("names a topic's placeholder add-<topic>, and finds the topic back", () => {
        expect(placeholderId("a1")).toBe("add-a1");
        expect(isPlaceholder("add-a1")).toBe(true);
        expect(isPlaceholder("a1")).toBe(false);
        expect(topicOf("add-a1")).toBe("a1");
        expect(topicOf("a1")).toBe("a1");
        expect(placeholderEdge("a1")).toMatchObject({
            id: "a1-add-a1",
            source: "a1",
            target: "add-a1",
        });
    });
});

describe("childrenOf and descendantsOf", () => {
    const edges = treeEdges();

    it("lists a topic's children, without its placeholder", () => {
        expect(childrenOf(edges, "root")).toEqual(["a", "b"]);
        expect(childrenOf(edges, "a")).toEqual(["a1", "a2"]);
        expect(childrenOf(edges, "b")).toEqual([]);
    });

    it("lists every topic below one, depth first", () => {
        expect(descendantsOf(edges, "root")).toEqual([
            "a",
            "a1",
            "a1x",
            "a2",
            "b",
        ]);
        expect(descendantsOf(edges, "a")).toEqual(["a1", "a1x", "a2"]);
        expect(descendantsOf(edges, "a1x")).toEqual([]);
    });

    it("counts a topic two branches reach once", () => {
        const joined = [...edges, topicEdge("b", "a1x")];
        expect(
            descendantsOf(joined, "root").filter((id) => id === "a1x"),
        ).toEqual(["a1x"]);
    });
});

describe("visibleIds", () => {
    const nodes = treeNodes();
    const edges = treeEdges();
    const all = nodes.map((node) => node.id);

    it("shows everything when nothing is collapsed", () => {
        expect([...visibleIds(nodes, edges, new Set())].sort()).toEqual(
            [...all].sort(),
        );
    });

    it("hides a collapsed topic's descendants, their placeholders and its own", () => {
        const shown = visibleIds(nodes, edges, new Set(["a"]));
        expect(shown.has("a")).toBe(true);
        for (const id of [
            "a1",
            "a2",
            "a1x",
            "add-a1",
            "add-a2",
            "add-a1x",
            "add-a",
        ]) {
            expect(shown.has(id), id).toBe(false);
        }
        for (const id of ["root", "b", "add-root", "add-b"]) {
            expect(shown.has(id), id).toBe(true);
        }
    });

    it("keeps a subtree hidden under a collapsed topic inside a shown one", () => {
        const shown = visibleIds(nodes, edges, new Set(["a1"]));
        expect(shown.has("a1")).toBe(true);
        expect(shown.has("add-a1")).toBe(false);
        expect(shown.has("a1x")).toBe(false);
        expect(shown.has("a2")).toBe(true);
        // both collapsed: the outer one wins, the inner stays hidden with it
        const both = visibleIds(nodes, edges, new Set(["a", "a1"]));
        expect(both.has("a1")).toBe(false);
        expect(both.has("a1x")).toBe(false);
    });
});

describe("visibilityCommands", () => {
    it("writes only the flags that change, an edge hidden with its end", () => {
        const nodes = treeNodes();
        const edges = treeEdges();
        const shown = new Set(nodes.map((node) => node.id));
        shown.delete("a1x");
        shown.delete("add-a1x");
        expect(visibilityCommands(nodes, edges, shown)).toEqual([
            {
                command: "node.set-flags",
                payload: { nodeId: "a1x", hidden: true },
            },
            {
                command: "node.set-flags",
                payload: { nodeId: "add-a1x", hidden: true },
            },
            {
                command: "edge.set-flags",
                payload: { edgeId: "a1-a1x", hidden: true },
            },
            {
                command: "edge.set-flags",
                payload: { edgeId: "a1x-add-a1x", hidden: true },
            },
        ]);
    });
});

describe("addChildCommands", () => {
    const parent = topicNode("a", "A", { x: 40, y: 90 });

    it("adds the topic, its edge, its placeholder and that edge, at the parent's place", () => {
        const commands = addChildCommands(parent, "topic-7", "Topic 7");
        expect(commands.map((entry) => entry.command)).toEqual([
            "node.add",
            "edge.add",
            "node.add",
            "edge.add",
        ]);
        expect(commands[0]?.payload).toEqual({
            id: "topic-7",
            type: "topic",
            position: { x: 40, y: 90 },
            ...TOPIC_SIZE,
            data: { label: "Topic 7" },
        });
        expect(commands[1]?.payload).toEqual({
            id: "a-topic-7",
            source: "a",
            target: "topic-7",
        });
        expect(commands[2]?.payload).toMatchObject({
            id: "add-topic-7",
            type: "add",
            position: { x: 40, y: 90 },
            ...PLACEHOLDER_SIZE,
            selectable: false,
            data: { parentId: "topic-7", parentLabel: "Topic 7" },
        });
        expect(commands[3]?.payload).toMatchObject({
            id: "topic-7-add-topic-7",
            source: "topic-7",
            target: "add-topic-7",
        });
    });

    it("applies on a model in one batch; the parent keeps its placeholder", () => {
        const model = modelOf();
        const a = model.get("node-by", { id: "a" });
        if (!a) throw new Error("no a");
        const changes: unknown[] = [];
        model.subscribe((event) => changes.push(event));
        const result = model.run("batch", {
            commands: addChildCommands(a, "topic-1", "Topic 1"),
        });
        expect(result.ok).toBe(true);
        expect(changes).toHaveLength(1);
        const { nodes, edges } = read(model);
        expect(childrenOf(edges, "a")).toEqual(["a1", "a2", "topic-1"]);
        expect(nodes.some((node) => node.id === "add-topic-1")).toBe(true);
        expect(nodes.some((node) => node.id === "add-a")).toBe(true);
        expect(
            edges.some(
                (edge) =>
                    edge.source === "topic-1" && edge.target === "add-topic-1",
            ),
        ).toBe(true);
    });
});

describe("toggleCommands on a model", () => {
    it("collapses a subtree: its flag in data, its nodes and edges hidden", () => {
        const model = modelOf();
        toggle(model, "a", true);
        expect(model.get("node-by", { id: "a" })?.data).toMatchObject({
            collapsed: true,
        });
        expect(collapsedIds(read(model).nodes)).toEqual(new Set(["a"]));
        expect(shownIn(model)).toEqual(
            ["a", "add-b", "add-root", "b", "root"].sort(),
        );
        const hiddenEdges = model
            .get("all-edges")
            .filter((edge) => edge.hidden === true)
            .map((edge) => edge.id)
            .sort();
        expect(hiddenEdges).toEqual(
            [
                "a-a1",
                "a-a2",
                "a1-a1x",
                "a-add-a",
                "a1-add-a1",
                "a2-add-a2",
                "a1x-add-a1x",
            ].sort(),
        );
    });

    it("expands it back, except under a topic still collapsed", () => {
        const model = modelOf();
        toggle(model, "a1", true);
        toggle(model, "a", true);
        toggle(model, "a", false);
        expect(model.get("node-by", { id: "a" })?.data).toMatchObject({
            collapsed: false,
        });
        const shown = shownIn(model);
        expect(shown).toContain("a1");
        expect(shown).toContain("a2");
        expect(shown).toContain("add-a");
        expect(shown).not.toContain("a1x");
        expect(shown).not.toContain("add-a1");
        expect(model.get("edge-by", { id: "a1-a1x" })?.hidden).toBe(true);
        expect(model.get("edge-by", { id: "a-a1" })?.hidden).toBe(false);
        toggle(model, "a1", false);
        expect(shownIn(model)).toEqual(
            treeNodes()
                .map((node) => node.id)
                .sort(),
        );
    });
});

describe("layoutPositions", () => {
    const boxes = (nodes: readonly TreeNode[]): LayoutNode[] =>
        nodes.map((node) => ({
            id: node.id,
            width: isPlaceholder(node.id)
                ? PLACEHOLDER_SIZE.width
                : TOPIC_SIZE.width,
            height: isPlaceholder(node.id)
                ? PLACEHOLDER_SIZE.height
                : TOPIC_SIZE.height,
            hidden: node.hidden,
        }));

    const overlapping = (
        positions: Map<string, { x: number; y: number }>,
        layout: LayoutNode[],
    ) => {
        const rects = layout.flatMap((node) => {
            const at = positions.get(node.id);
            return at ? [{ ...node, ...at }] : [];
        });
        const pairs: string[] = [];
        for (const [index, a] of rects.entries()) {
            for (const b of rects.slice(index + 1)) {
                const apart =
                    a.x + a.width <= b.x ||
                    b.x + b.width <= a.x ||
                    a.y + a.height <= b.y ||
                    b.y + b.height <= a.y;
                if (!apart) pairs.push(`${a.id}/${b.id}`);
            }
        }
        return pairs;
    };

    it("places every node, children below their parents, none overlapping", () => {
        const nodes = treeNodes();
        const edges = treeEdges();
        const layout = boxes(nodes);
        const positions = layoutPositions(layout, edges);
        expect(positions.size).toBe(nodes.length);
        for (const { source, target } of edges) {
            const parent = positions.get(source);
            const child = positions.get(target);
            expect(child?.y ?? 0, `${target} under ${source}`).toBeGreaterThan(
                (parent?.y ?? 0) + TOPIC_SIZE.height,
            );
        }
        expect(overlapping(positions, layout)).toEqual([]);
    });

    it("lays out the shown nodes only: a hidden one gets no place", () => {
        const model = modelOf();
        toggle(model, "a", true);
        const { nodes, edges } = read(model);
        const layout = boxes(nodes);
        const positions = layoutPositions(layout, edges);
        expect([...positions.keys()].sort()).toEqual(shownIn(model));
        expect(overlapping(positions, layout)).toEqual([]);
        // the collapsed topic, now a leaf, sits beside its sibling's subtree
        expect(positions.get("a")?.y).toBe(positions.get("b")?.y);
    });

    it("gives places the model takes, placeholders too, in one batch of moves", () => {
        const model = modelOf();
        toggle(model, "a1", true);
        const { nodes, edges } = read(model);
        const positions = layoutPositions(boxes(nodes), edges);
        const result = model.run("batch", {
            commands: [...positions].map(([nodeId, position]) => ({
                command: "node.move" as const,
                payload: { nodeId, position },
            })),
        });
        expect(result.ok).toBe(true);
        for (const [id, at] of positions) {
            expect(model.get("node-by", { id })?.position, id).toEqual(at);
        }
        // the hidden ones stay where they were
        expect(model.get("node-by", { id: "a1x" })?.position).toEqual(ORIGIN);
    });

    it("moves the siblings apart when a child is added", () => {
        const model = modelOf();
        const before = layoutPositions(
            boxes(read(model).nodes),
            read(model).edges,
        );
        const a1 = model.get("node-by", { id: "a1" });
        if (!a1) throw new Error("no a1");
        model.run("batch", {
            commands: addChildCommands(a1, "topic-1", "Topic 1"),
        });
        const { nodes, edges } = read(model);
        const layout = boxes(nodes);
        const after = layoutPositions(layout, edges);
        expect(after.get("topic-1")?.y ?? 0).toBeGreaterThan(
            (after.get("a1")?.y ?? 0) + TOPIC_SIZE.height,
        );
        expect(overlapping(after, layout)).toEqual([]);
        // its sibling makes room for it
        expect(after.get("a1x")).not.toEqual(before.get("a1x"));
    });
});
