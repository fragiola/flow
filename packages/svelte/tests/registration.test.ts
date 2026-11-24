// Node registration (#54, Vue's "node registration" cases in `tests/nodes.test.ts`): a node
// registers with the engine in its attachment, at once, as its element is in place. A node the
// app adds is registered after its `await tick()` and before its content's (or a hand-rendered
// node's) `$effect` and `onMount`; one whose measurement throws is reported (`reportError`) and
// leaves the flush and the other nodes alone.
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AnyTypes, createFlowRef, type FlowFeatures } from "../src/index";
import RegistrationFlow from "./fixtures/registration-flow.svelte";
import { installLayout, part, render, task } from "./flow";

beforeEach(() => {
    installLayout();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

/** A flow of one node `a`, and whether the engine takes a node's focus (it is registered). */
async function flowOfOne(seen: [string, boolean][] = []) {
    const flow = createFlowRef<AnyTypes, FlowFeatures>();
    const view = await render(RegistrationFlow, {
        flowRef: flow,
        defaultNodes: [task("a")],
        seen,
    });
    const current = () => {
        if (!flow.current) throw new Error("not mounted");
        return flow.current;
    };
    return {
        ...view,
        model: () => current().model,
        registered: (nodeId: string) =>
            current().engine.check("focus-node", { nodeId }).ok,
    };
}

describe("node registration", () => {
    it("is done once Svelte has flushed: after the app's tick, focus-node finds an added node", async () => {
        const flow = await flowOfOne();
        expect(flow.registered("a")).toBe(true);
        flow.model().run("node.add", task("b", 0, 200));
        // not rendered yet
        expect(flow.registered("b")).toBe(false);
        await tick();
        expect(flow.registered("b")).toBe(true);
    });

    it("is done before a node content's $effect and onMount, and a hand-rendered useNode node's", async () => {
        const seen: [string, boolean][] = [];
        const flow = await flowOfOne(seen);
        seen.length = 0;
        flow.model().run("node.add", task("b", 0, 200));
        flow.model().run("node.add", task("c", 0, 400));
        await tick();
        expect(seen.sort()).toEqual([
            ["content b effect", true],
            ["content b mount", true],
            ["hand c effect", true],
            ["hand c mount", true],
        ]);
        expect(part(flow.container, "node", "c").tagName).toBe("DIV");
    });

    it("of one node that throws leaves the others registered, and reports the error", async () => {
        // jsdom has no reportError: the adapter's report, as a browser's
        const reported = vi.fn();
        vi.stubGlobal("reportError", reported);
        const flow = await flowOfOne();
        // b's first measurement (on its registration) throws
        const failure = new Error("measure b");
        const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get");
        const layout = width.getMockImplementation();
        let thrown = false;
        width.mockImplementation(function (this: HTMLElement) {
            if (!thrown && this.getAttribute("data-flow-id") === "b") {
                thrown = true;
                throw failure;
            }
            return layout?.call(this) ?? 0;
        });
        flow.model().run("node.add", task("b", 0, 200));
        flow.model().run("node.add", task("c", 0, 400));
        await tick();
        expect(thrown).toBe(true);
        expect(reported.mock.calls).toEqual([[failure]]);
        expect(flow.registered("a")).toBe(true);
        expect(flow.registered("c")).toBe(true);
        // the flush went on: c's element in place and measured
        expect(
            part(flow.container, "node", "c").dataset.measured,
        ).toBeDefined();
        // a later node still registers
        flow.model().run("node.add", task("d", 0, 600));
        await tick();
        expect(flow.registered("d")).toBe(true);
        expect(reported).toHaveBeenCalledTimes(1);
    });
});
