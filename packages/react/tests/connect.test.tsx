import { connection } from "@fragiola/flow/connection";
import { reconnection } from "@fragiola/flow/reconnection";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
    createFlowModel,
    Flow,
    type FlowModel,
    useConnection,
    veto,
} from "../src/index";
import { installLayout, part, pointer, settle, task } from "./flow";

beforeEach(() => {
    installLayout();
});

const features = [connection(), reconnection()] as const;

function Connectable({ model }: { model: FlowModel }) {
    return (
        <Flow.Root model={model}>
            <Flow.Viewport>
                <Flow.Edges>
                    {(edge) => (
                        <Flow.Edge edge={edge}>
                            <Flow.EdgePath />
                            <Flow.ReconnectAnchor end="target" />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(node) => (
                        <Flow.Node node={node}>
                            <Flow.Handle type="target" side="top" />
                            <Flow.Handle type="source" side="bottom" />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine />
            </Flow.Viewport>
            <Status />
        </Flow.Root>
    );
}

function Status() {
    const current = useConnection();
    return (
        <output
            data-flow-part="status"
            data-status={current?.status ?? "none"}
        />
    );
}

function model(edges: { id: string; source: string; target: string }[] = []) {
    return createFlowModel(
        {
            version: 1,
            nodes: [task("a", 0, 0), task("b", 0, 200), task("c", 300, 200)],
            edges,
        },
        { features },
    ) as unknown as FlowModel;
}

const handle = (container: HTMLElement, nodeId: string, type: string) =>
    container.querySelector(
        `[data-flow-id="${nodeId}"] [data-handle-type="${type}"]`,
    ) as HTMLElement;

describe("connecting", () => {
    it("draws the connection line from a handle, marks the target, and adds the edge on the drop", async () => {
        const flow = model();
        const { container } = render(<Connectable model={flow} />);
        await settle();
        const root = part(container, "root");
        pointer(handle(container, "a", "source"), "pointerdown", {
            clientX: 50,
            clientY: 40,
        });
        pointer(root, "pointermove", { clientX: 52, clientY: 195 });
        const line = part(container, "connection-line");
        expect(line).toHaveAttribute("data-valid");
        expect(part(line, "connection-path").getAttribute("d")).toMatch(/^M/);
        expect(handle(container, "b", "target")).toHaveAttribute("data-valid");
        expect(handle(container, "a", "source")).toHaveAttribute(
            "data-connecting",
        );
        expect(root).toHaveAttribute("data-connecting");
        expect(part(container, "status")).toHaveAttribute(
            "data-status",
            "valid",
        );
        pointer(root, "pointerup", { clientX: 52, clientY: 195 });
        await settle();
        expect(
            container.querySelector('[data-flow-part="connection-line"]'),
        ).toBeNull();
        expect(flow.get("all-edges")).toMatchObject([
            { source: "a", target: "b" },
        ]);
        expect(
            container.querySelector('[data-flow-part="edge"]'),
        ).not.toBeNull();
    });

    it("marks a target a middleware refuses invalid, and adds nothing", async () => {
        const flow = model();
        flow.use((ctx, next) =>
            ctx.command === "edge.add" ? veto("no edges into b") : next(),
        );
        const { container } = render(<Connectable model={flow} />);
        await settle();
        const root = part(container, "root");
        pointer(handle(container, "a", "source"), "pointerdown", {
            clientX: 50,
            clientY: 40,
        });
        pointer(root, "pointermove", { clientX: 50, clientY: 200 });
        expect(part(container, "connection-line")).toHaveAttribute(
            "data-invalid",
        );
        expect(handle(container, "b", "target")).toHaveAttribute(
            "data-invalid",
        );
        pointer(root, "pointerup", { clientX: 50, clientY: 200 });
        expect(flow.get("all-edges")).toEqual([]);
    });

    it("moves an edge's end to another handle by its reconnect anchor", async () => {
        const flow = model([{ id: "ab", source: "a", target: "b" }]);
        const { container } = render(<Connectable model={flow} />);
        await settle();
        const root = part(container, "root");
        const anchor = part(container, "reconnect-anchor", "ab");
        expect(anchor).toHaveAttribute("data-end", "target");
        expect(anchor.getAttribute("cx")).toBe("50");
        expect(anchor.getAttribute("cy")).toBe("200");
        pointer(anchor, "pointerdown", { clientX: 50, clientY: 200 });
        pointer(root, "pointermove", { clientX: 350, clientY: 200 });
        pointer(root, "pointerup", { clientX: 350, clientY: 200 });
        await settle();
        expect(flow.get("edge-by", { id: "ab" })?.target).toBe("c");
        expect(
            part(container, "reconnect-anchor", "ab").getAttribute("cx"),
        ).toBe("350");
    });
});
