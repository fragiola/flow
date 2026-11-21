import {
    type AnyTypes,
    type CommandEvent,
    Flow,
    type FlowNodeInput,
    useFlow,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { useEffect, useState } from "react";
import { FlowInspector } from "../../inspector/flow-inspector";

// The model driven from code: each button runs one command (or an engine action) and the log
// lists what the model committed (`model.subscribe`), newest first; the inspector shows the
// document after it.

const features = [selection(), drag()] as const;

const nodes: FlowNodeInput[] = [
    { id: "a", type: "box", position: { x: 0, y: 0 }, data: { label: "a" } },
    { id: "b", type: "box", position: { x: 200, y: 80 }, data: { label: "b" } },
];

let added = 0;

function Buttons() {
    const { model, engine } = useFlow<AnyTypes, typeof features>();
    const [log, setLog] = useState<CommandEvent[]>([]);
    useEffect(
        () =>
            model.subscribe((event) =>
                setLog((list) => [event, ...list].slice(0, 10)),
            ),
        [model],
    );
    const actions: [string, () => unknown][] = [
        [
            "node.add",
            () => {
                added += 1;
                return model.run("node.add", {
                    id: `n${added}`,
                    type: "box",
                    position: { x: added * 40, y: 200 },
                    data: { label: `n${added}` },
                });
            },
        ],
        [
            "node.move a",
            () =>
                model.run("node.move", {
                    nodeId: "a",
                    position: { x: 40, y: -40 },
                }),
        ],
        [
            "node.set-data b",
            () =>
                model.run("node.set-data", {
                    nodeId: "b",
                    data: { label: "b!" },
                }),
        ],
        [
            "edge.add a→b",
            () => model.run("edge.add", { id: "ab", source: "a", target: "b" }),
        ],
        [
            "selection.set a, b",
            () => model.run("selection.set", { nodeIds: ["a", "b"] }),
        ],
        ["selection.remove", () => model.run("selection.remove", {})],
        ["fit-view", () => engine.run("fit-view", {})],
    ];
    return (
        <div
            data-flow-no-gesture=""
            className="palette-raised absolute top-2 start-2 flex w-56 flex-col gap-1 rounded-md border border-palette-line bg-palette-base p-2 text-xs"
        >
            {actions.map(([label, run]) => (
                <button
                    key={label}
                    type="button"
                    onClick={run}
                    className="rounded border border-palette-line px-2 py-0.5 text-start hover:bg-palette-soft"
                >
                    {label}
                </button>
            ))}
            <ol
                aria-label="Commands"
                className="mt-1 flex flex-col gap-0.5 font-mono"
            >
                {log.map((event, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a log, newest first
                    <li key={index} data-testid="command-name">
                        {event.command}
                    </li>
                ))}
            </ol>
        </div>
    );
}

export default function Commands() {
    return (
        <Flow.Root
            features={features}
            defaultNodes={nodes}
            defaultViewport={{ x: 320, y: 120, zoom: 1 }}
            className="size-full min-h-0 bg-(--fl-canvas-bg)"
        >
            <Flow.Background
                variant="dots"
                size={2}
                className="text-(--fl-grid-color)"
            />
            <Flow.Viewport>
                <Flow.Edges>
                    {(edge) => (
                        <Flow.Edge edge={edge}>
                            <Flow.EdgePath className="stroke-(--fl-edge-color) stroke-2" />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(node) => (
                        <Flow.Node
                            node={node}
                            className="palette-raised min-w-16 select-none rounded border border-palette-line bg-palette-base px-3 py-2 data-selected:border-(--fl-edge-selected)"
                        >
                            {String(node.data.label)}
                            <Flow.Handle type="target" side="top" />
                            <Flow.Handle type="source" side="bottom" />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
            <Buttons />
            <FlowInspector />
        </Flow.Root>
    );
}
