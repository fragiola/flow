// A culled flow (`onlyRenderVisible`, #54) before the engine: the server render and the first
// client render draw no node or edge (no size to cull by yet, and every node mounted once costs
// the open), their layers kept; hydrating that HTML warns of no mismatch, and the engine then
// renders the nodes and edges in view. A flow that is not culled renders every one on the server.
// The server HTML comes from a Vite server's SSR build of the fixture (`tests/static.test.ts`).
import { resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { flushSync, hydrate, unmount } from "svelte";
import {
    createServer,
    defaultClientConditions,
    defaultServerConditions,
    type ViteDevServer,
} from "vite";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { withSourceCondition } from "../../../scripts/source-condition.ts";
import TestFlow from "./fixtures/test-flow.svelte";
import { installLayout, part, settle, task } from "./flow";

let vite: ViteDevServer;

beforeAll(async () => {
    vite = await createServer({
        configFile: false,
        root: resolve(import.meta.dirname, ".."),
        logLevel: "silent",
        plugins: [svelte()],
        resolve: { conditions: withSourceCondition(defaultClientConditions) },
        ssr: {
            resolve: {
                conditions: withSourceCondition(defaultServerConditions),
            },
        },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
        appType: "custom",
    });
}, 30_000);

afterAll(async () => {
    await vite?.close();
});

beforeEach(() => {
    installLayout();
});

/** The fixture rendered on the server (`svelte/server` in Node, as an app's SSR). */
async function serverHtml(props: Record<string, unknown>): Promise<string> {
    const server = (await vite.ssrLoadModule("svelte/server")) as {
        render: (component: unknown, options: unknown) => { body: string };
    };
    const fixture = (await vite.ssrLoadModule(
        "/tests/fixtures/test-flow.svelte",
    )) as { default: unknown };
    return server.render(fixture.default, { props }).body;
}

// a → b → c in the 800 × 600 view, y → z out of it
const flow = () => ({
    defaultNodes: [
        task("a", 0, 0),
        task("b", 0, 200),
        task("c", 200, 200),
        task("y", 1200, 0),
        task("z", 1200, 200),
    ],
    defaultEdges: [
        { id: "ab", source: "a", target: "b" },
        { id: "bc", source: "b", target: "c" },
        { id: "yz", source: "y", target: "z" },
    ],
});

const ids = (container: ParentNode, name: string) =>
    [...container.querySelectorAll<HTMLElement>(`[data-flow-part="${name}"]`)]
        .map((element) => element.dataset.flowId)
        .sort();

describe("a culled flow before the engine", () => {
    it("renders the layers and no node or edge on the server; every one when not culled", async () => {
        const culled = await serverHtml({ ...flow(), onlyRenderVisible: true });
        expect(culled).toContain('data-flow-part="nodes"');
        expect(culled).toContain('data-flow-part="edges"');
        expect(culled).not.toContain('data-flow-part="node"');
        expect(culled).not.toContain('data-flow-part="edge"');
        expect(culled).not.toContain('data-flow-part="handle"');
        const all = await serverHtml(flow());
        for (const id of ["a", "b", "c", "y", "z"]) {
            expect(all).toMatch(
                new RegExp(`data-flow-part="node" data-flow-id="${id}"`),
            );
        }
        for (const id of ["ab", "bc", "yz"]) {
            expect(all).toMatch(
                new RegExp(`data-flow-part="edge" data-flow-id="${id}"`),
            );
        }
    });

    it("hydrates the server HTML with no mismatch, then renders the nodes and edges in view", async () => {
        const props = { ...flow(), onlyRenderVisible: true };
        const html = await serverHtml(props);
        const target = document.body.appendChild(document.createElement("div"));
        target.innerHTML = html;
        const nodesLayer = part(target, "nodes");
        const edgesLayer = part(target, "edges");
        const warn = vi.spyOn(console, "warn");
        const error = vi.spyOn(console, "error");
        const app = hydrate(TestFlow, { target, props: props as never });
        flushSync();
        await settle();
        const messages = [...warn.mock.calls, ...error.mock.calls].flat();
        expect(messages.join("\n")).not.toMatch(/hydration|mismatch/i);
        // the server's layers are kept (a mismatch would render them again)
        expect(part(target, "nodes")).toBe(nodesLayer);
        expect(part(target, "edges")).toBe(edgesLayer);
        // the engine knows the view: the nodes and edges in it
        expect(part(target, "root").style.touchAction).toBe("none");
        expect(ids(target, "node")).toEqual(["a", "b", "c"]);
        expect(ids(target, "edge")).toEqual(["ab", "bc"]);
        expect(part(target, "node", "b").dataset.measured).toBeDefined();
        await unmount(app);
    });
});
