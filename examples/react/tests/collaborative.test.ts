import { createFlowModel, type FlowNodeInput } from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { selection } from "@fragiola/flow-react/selection";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    changesOf,
    merged,
    type Presence,
    presenceAfter,
    REMOTE_META,
    receive,
    remoteSelection,
    syncModel,
} from "../src/examples/collaborative/sync";
import {
    bridgeTabs,
    createHub,
    type Entity,
    isMessage,
    type Message,
} from "../src/examples/collaborative/transport";

// The collaborative example's transport (a hub in memory, a bridge to other tabs over Node's own
// BroadcastChannel, no echo) and its sync (what a command changed, how a peer applies it, that
// nothing applied from a peer goes back, the presence).

const card = (id: string, x: number, y = 0): FlowNodeInput => ({
    id,
    type: "card",
    position: { x, y },
    data: { label: id },
});

describe("the hub", () => {
    it("delivers a message to every peer but its sender, stamped with who sent it", () => {
        const hub = createHub();
        const got: Record<string, Message[]> = { a: [], b: [], c: [] };
        const a = hub.join("a", "Alice", (m) => got.a?.push(m));
        hub.join("b", "Bob", (m) => got.b?.push(m));
        hub.join("c", "Carol", (m) => got.c?.push(m));
        a.send({ type: "cursor", at: { x: 1, y: 2 } });
        expect(got.a).toEqual([]);
        expect(got.b).toEqual([
            { type: "cursor", at: { x: 1, y: 2 }, from: "a", name: "Alice" },
        ]);
        expect(got.c).toHaveLength(1);
    });

    it("keeps the order when a peer answers while a message is delivered", () => {
        const hub = createHub();
        const seen: string[] = [];
        const a = hub.join("a", "A", (m) => seen.push(`a:${m.type}`));
        const b = hub.join("b", "B", (m) => {
            seen.push(`b:${m.type}`);
            if (m.type === "hello") b.send({ type: "leave" });
        });
        hub.join("c", "C", (m) => seen.push(`c:${m.type}`));
        a.send({ type: "hello" });
        expect(seen).toEqual(["b:hello", "c:hello", "a:leave", "c:leave"]);
    });

    it("forwards a message under its first sender, skipping the forwarder", () => {
        const hub = createHub();
        const got: Message[] = [];
        const bridge = hub.join("bridge", "tab", (m) => got.push(m));
        hub.join("a", "Alice", (m) => got.push(m));
        const foreign: Message = {
            type: "cursor",
            at: null,
            from: "far",
            name: "Bob",
        };
        bridge.forward(foreign);
        expect(got).toEqual([foreign]);
    });

    it("tells the others when a peer leaves, and then delivers nothing to or from it", () => {
        const hub = createHub();
        const got: Message[] = [];
        const a = hub.join("a", "Alice", (m) => got.push(m));
        const b = hub.join("b", "Bob", () => {
            throw new Error("left");
        });
        b.leave();
        expect(got).toEqual([{ type: "leave", from: "b", name: "Bob" }]);
        b.send({ type: "hello" });
        a.send({ type: "hello" });
        expect(hub.peers()).toEqual(["a"]);
        expect(() => hub.join("a", "again", () => {})).toThrow();
    });

    it("recognises a message from another tab, and refuses anything else", () => {
        expect(isMessage({ type: "hello", from: "x", name: "tab" })).toBe(true);
        expect(isMessage({ type: "shout", from: "x", name: "tab" })).toBe(
            false,
        );
        expect(isMessage({ type: "hello" })).toBe(false);
        expect(isMessage("hello")).toBe(false);
        expect(isMessage(null)).toBe(false);
    });
});

describe("the bridge to other tabs", () => {
    const bridges: { close(): void }[] = [];
    afterEach(() => {
        for (const bridge of bridges.splice(0)) bridge.close();
    });

    /** A message on the channel arrives in a later task. */
    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

    it("joins two pages' hubs, without echo, and says hello on opening", async () => {
        const channel = `collaborative-test-${Math.random()}`;
        const first = createHub();
        const second = createHub();
        const firstGot: Message[] = [];
        const secondGot: Message[] = [];
        const alice = first.join("alice", "Alice", (m) => firstGot.push(m));
        second.join("bob", "Bob", (m) => secondGot.push(m));
        bridges.push(bridgeTabs(first, channel));
        await settle();
        const late = bridgeTabs(second, channel);
        bridges.push(late);
        expect(late.connected).toBe(true);
        await settle();
        // the second page's hello reached the first page's peers
        expect(firstGot.map((m) => m.type)).toEqual(["hello"]);
        alice.send({ type: "selection", nodeIds: ["a"] });
        await settle();
        expect(secondGot).toEqual([
            { type: "selection", nodeIds: ["a"], from: "alice", name: "Alice" },
        ]);
        // nothing came back to the first page
        expect(firstGot.map((m) => m.type)).toEqual(["hello"]);
    });

    it("drops what a channel hands back from this page's own peers", () => {
        const hub = createHub();
        const got: Message[] = [];
        hub.join("alice", "Alice", (m) => got.push(m));
        let deliver: (event: { data: unknown }) => void = () => {};
        const posted: unknown[] = [];
        const bridge = bridgeTabs(hub, "fake", () => ({
            postMessage: (message) => posted.push(message),
            addEventListener: (_type, listener) => {
                deliver = listener;
            },
            close() {},
        }));
        expect(posted).toHaveLength(1); // the hello
        deliver({ data: { type: "hello", from: "alice", name: "Alice" } });
        deliver({ data: { type: "nonsense" } });
        expect(got).toEqual([]);
        deliver({ data: { type: "leave", from: "far", name: "Bob" } });
        expect(got).toEqual([{ type: "leave", from: "far", name: "Bob" }]);
        bridge.close();
    });

    it("says leave for each of this page's peers before its channel closes", () => {
        const hub = createHub();
        const alice = hub.join("alice", "Alice", () => {});
        hub.join("bob", "Bob", () => {});
        const posted: unknown[] = [];
        let closed = false;
        const bridge = bridgeTabs(hub, "fake", () => ({
            postMessage: (message) => {
                if (closed) throw new Error("posted after closing");
                posted.push(message);
            },
            addEventListener: () => {},
            close() {
                closed = true;
            },
        }));
        alice.send({ type: "cursor", at: { x: 1, y: 2 } });
        posted.length = 0;
        bridge.close();
        expect(closed).toBe(true);
        expect(posted).toEqual([
            { type: "leave", from: "alice", name: "Alice" },
            { type: "leave", from: "bob", name: "bob" },
        ]);
        // closing twice says nothing more
        bridge.close();
        expect(posted).toHaveLength(2);
    });

    it("does nothing where there is no BroadcastChannel", () => {
        vi.stubGlobal("BroadcastChannel", undefined);
        const bridge = bridgeTabs(createHub(), "none");
        vi.unstubAllGlobals();
        expect(bridge.connected).toBe(false);
        bridge.close();
    });
});

describe("what a command changed", () => {
    const a = { id: "a", position: { x: 0, y: 0 } } as Entity;
    const b = { id: "b", position: { x: 1, y: 0 } } as Entity;
    const ab = { id: "a-b", source: "a", target: "b" } as Entity;

    it("names the entities put and removed, without their selection", () => {
        const moved = { ...a, position: { x: 5, y: 5 }, selected: true };
        expect(
            changesOf(
                { nodes: [a, b], edges: [ab] },
                { nodes: [moved], edges: [] },
            ),
        ).toEqual({
            nodes: {
                put: [{ id: "a", position: { x: 5, y: 5 } }],
                remove: ["b"],
            },
            edges: { put: [], remove: ["a-b"] },
        });
    });

    it("is nothing when only the selection changed", () => {
        expect(
            changesOf(
                { nodes: [a, b], edges: [ab] },
                { nodes: [{ ...a, selected: true }, b], edges: [ab] },
            ),
        ).toBeUndefined();
    });

    it("merges into a document: each side keeps its own selection, and an edge goes with its node", () => {
        const selectedA = { ...a, selected: true };
        const result = merged(
            { nodes: [selectedA, b], edges: [ab] },
            {
                nodes: {
                    put: [
                        { id: "a", position: { x: 9, y: 9 } },
                        { id: "c", position: { x: 2, y: 2 } },
                    ],
                    remove: ["b"],
                },
                edges: { put: [], remove: [] },
            },
        );
        expect(result).toEqual({
            nodes: [
                { id: "a", position: { x: 9, y: 9 }, selected: true },
                { id: "c", position: { x: 2, y: 2 } },
            ],
            edges: [],
        });
    });

    it("replaces the whole document with a snapshot", () => {
        const result = merged(
            { nodes: [a, b], edges: [ab] },
            { nodes: { put: [b], remove: [] }, edges: { put: [], remove: [] } },
            true,
        );
        expect(result).toEqual({ nodes: [b], edges: [] });
    });
});

describe("two models in sync", () => {
    const features = [selection(), connection()] as const;
    const make = () =>
        createFlowModel(
            {
                version: 1,
                nodes: [card("a", 0), card("b", 200)],
                edges: [],
            },
            { features },
        );

    function pair() {
        const hub = createHub();
        const alice = make();
        const bob = make();
        const sent: Message[] = [];
        const join = (id: string, model: typeof alice) => {
            const peer = hub.join(id, id, (message) => {
                sent.push(message);
                receive(model, peer, message);
            });
            syncModel(model, peer);
            return peer;
        };
        join("Alice", alice);
        join("Bob", bob);
        return { alice, bob, sent };
    }

    it("applies a move, an addition, a connection and a removal on the other side", () => {
        const { alice, bob } = pair();
        alice.run("node.move", { nodeId: "a", position: { x: 40, y: 60 } });
        expect(bob.get("node-by", { id: "a" })?.position).toEqual({
            x: 40,
            y: 60,
        });
        bob.run("node.add", card("c", 100, 200));
        bob.run("edge.add", { id: "a-c", source: "a", target: "c" });
        expect(alice.get("node-by", { id: "c" })?.position).toEqual({
            x: 100,
            y: 200,
        });
        expect(alice.get("flow-json").edges.map((edge) => edge.id)).toEqual([
            "a-c",
        ]);
        alice.run("node.remove", { nodeId: "c" });
        expect(bob.get("node-by", { id: "c" })).toBeUndefined();
        expect(bob.get("flow-json").edges).toEqual([]);
    });

    it("never sends back what it applied from a peer: one message per command", () => {
        const { alice, bob, sent } = pair();
        const marks: unknown[] = [];
        bob.subscribe((event) => marks.push(event.meta));
        alice.run("node.move", { nodeId: "a", position: { x: 1, y: 1 } });
        expect(sent.filter((m) => m.type === "changes")).toHaveLength(1);
        expect(marks).toEqual([REMOTE_META]);
    });

    it("keeps a drag's transient steps transient on the other side", () => {
        const { alice, bob } = pair();
        const transient: boolean[] = [];
        bob.subscribe((event) => transient.push(event.transient));
        alice.run(
            "node.move",
            { nodeId: "a", position: { x: 5, y: 0 } },
            { transient: true },
        );
        alice.run("node.move", { nodeId: "a", position: { x: 9, y: 0 } });
        expect(transient).toEqual([true, false]);
        expect(bob.get("node-by", { id: "a" })?.position).toEqual({
            x: 9,
            y: 0,
        });
    });

    it("keeps each side's selection its own, and tells it as presence", () => {
        const { alice, bob, sent } = pair();
        alice.run("selection.set", { nodeIds: ["a"], mode: "replace" });
        expect(bob.get("node-by", { id: "a" })?.selected).not.toBe(true);
        expect(sent.filter((m) => m.type === "changes")).toEqual([]);
        expect(sent.at(-1)).toMatchObject({
            type: "selection",
            nodeIds: ["a"],
            from: "Alice",
        });
        // a move of the selected node on the other side leaves Alice's selection as it is
        bob.run("node.move", { nodeId: "a", position: { x: 3, y: 3 } });
        expect(alice.get("node-by", { id: "a" })).toMatchObject({
            selected: true,
            position: { x: 3, y: 3 },
        });
    });

    it("answers a hello with the document, which a newcomer takes as a whole", () => {
        const hub = createHub();
        const old = make();
        old.run("node.move", { nodeId: "b", position: { x: 7, y: 7 } });
        old.run("node.remove", { nodeId: "a" });
        const peer = hub.join("old", "Alice", (m) => receive(old, peer, m));
        const fresh = make();
        const newcomer = hub.join("new", "Bob", (m) =>
            receive(fresh, newcomer, m),
        );
        newcomer.send({ type: "hello" });
        expect(
            fresh
                .get("flow-json")
                .nodes.map((node) => [node.id, node.position]),
        ).toEqual([["b", { x: 7, y: 7 }]]);
    });
});

describe("the presence", () => {
    const from = (id: string, name: string) => ({ from: id, name });

    it("follows each peer's cursor and selection, and forgets a peer that left", () => {
        let presence: Presence = new Map();
        presence = presenceAfter(presence, {
            type: "cursor",
            at: { x: 1, y: 2 },
            ...from("1", "Bob"),
        });
        presence = presenceAfter(presence, {
            type: "selection",
            nodeIds: ["a", "b"],
            ...from("1", "Bob"),
        });
        presence = presenceAfter(presence, {
            type: "selection",
            nodeIds: ["b"],
            ...from("2", "Carol"),
        });
        expect(presence.get("1")).toEqual({
            name: "Bob",
            at: { x: 1, y: 2 },
            nodeIds: ["a", "b"],
        });
        expect(remoteSelection(presence)).toEqual(
            new Map([
                ["a", ["Bob"]],
                ["b", ["Bob", "Carol"]],
            ]),
        );
        const unchanged = presenceAfter(presence, {
            type: "hello",
            ...from("3", "tab"),
        });
        expect(unchanged).toBe(presence);
        presence = presenceAfter(presence, {
            type: "leave",
            ...from("1", "Bob"),
        });
        expect([...presence.keys()]).toEqual(["2"]);
    });
});
