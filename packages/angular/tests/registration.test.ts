// Node registration (#57, Epic #58; Vue's "node registration" cases, Svelte's
// `tests/registration.test.ts`): a node registers with the engine (which measures it) once Angular
// has rendered it, in the after-render `earlyRead` phase: after every insertion of the render, so
// the first measurement lays the page out once, and before the app's own after-render hooks of the
// later phases. A node the app adds is registered by the time the app's `afterNextRender` runs,
// and before its content's; one whose measurement throws is reported (`ErrorHandler`) and leaves
// the others registered.
import {
    afterNextRender,
    Component,
    EnvironmentInjector,
    ErrorHandler,
    input,
} from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    type AnyTypes,
    createFlowRef,
    FLOW,
    type FlowFeatures,
    type FlowNode,
    type FlowRef,
    injectFlow,
} from "../src/public-api";
import { installLayout, part, render, settle, task } from "./flow";

beforeEach(() => {
    installLayout();
});

afterEach(() => {
    vi.restoreAllMocks();
});

type Ref = FlowRef<AnyTypes, FlowFeatures>;

/** A node's content: tells whether its node is registered in its own `afterNextRender`. */
@Component({ selector: "test-registered-content", template: "" })
class RegisteredContent {
    readonly id = input.required<string>();
    readonly seen = input.required<(entry: string) => void>();
    private readonly flow = injectFlow();

    constructor() {
        afterNextRender(() => {
            const ok = this.flow.engine.check("focus-node", {
                nodeId: this.id(),
            }).ok;
            this.seen()(`content ${this.id()} ${ok}`);
        });
    }
}

@Component({
    selector: "test-registration-flow",
    imports: [FLOW, RegisteredContent],
    template: `
        <div flowRoot [defaultNodes]="defaultNodes()" [flowRef]="flowRef()">
            <div flowViewport>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        <test-registered-content [id]="node.id" [seen]="seen()" />
                    </div>
                </div>
            </div>
        </div>
    `,
})
class RegistrationFlow {
    readonly defaultNodes = input<readonly FlowNode[]>([task("a")]);
    readonly flowRef = input.required<Ref>();
    readonly seen = input<(entry: string) => void>(() => {});
}

/** A flow of one node `a`, and whether the engine takes a node's focus (it is registered). */
async function flowOfOne(seen: string[] = []) {
    const flow = createFlowRef<AnyTypes, FlowFeatures>();
    const view = await render(RegistrationFlow, {
        flowRef: flow,
        seen: (entry: string) => seen.push(entry),
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
    it("is done by the app's afterNextRender after it added a node, and before its content's", async () => {
        const seen: string[] = [];
        const flow = await flowOfOne(seen);
        expect(flow.registered("a")).toBe(true);
        seen.length = 0;
        flow.model().run("node.add", task("b", 0, 200));
        // not rendered yet
        expect(flow.registered("b")).toBe(false);
        afterNextRender(() => seen.push(`app b ${flow.registered("b")}`), {
            injector: TestBed.inject(EnvironmentInjector),
        });
        await settle();
        expect(seen).toEqual(["app b true", "content b true"]);
    });

    it("of one node that throws leaves the others registered, and reports the error", async () => {
        const errors = TestBed.inject(ErrorHandler);
        const reported = vi
            .spyOn(errors, "handleError")
            .mockImplementation(() => {});
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
        await settle();
        expect(thrown).toBe(true);
        expect(reported.mock.calls.map(([error]) => error)).toEqual([failure]);
        expect(flow.registered("a")).toBe(true);
        expect(flow.registered("c")).toBe(true);
        expect(
            part(flow.container, "node", "c").dataset.measured,
        ).toBeDefined();
        // a later node still registers
        flow.model().run("node.add", task("d", 0, 600));
        await settle();
        expect(flow.registered("d")).toBe(true);
        expect(reported).toHaveBeenCalledTimes(1);
    });
});
