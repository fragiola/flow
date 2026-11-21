import {
    createFlowModel,
    Flow,
    type FlowEdge,
    type FlowModel,
    useFlowRef,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import {
    MiniMap,
    MiniMapMask,
    MiniMapNode,
    minimap,
} from "@fragiola/flow-react/minimap";
import { reconnection } from "@fragiola/flow-react/reconnection";
import { selection } from "@fragiola/flow-react/selection";
import { MaximizeIcon, MinusIcon, PlusIcon, WorkflowIcon } from "lucide-react";
import { type DragEvent, useState } from "react";
import { Badge } from "#/components/atoms/badge";
import { CATALOG, type CatalogEntry } from "./catalog";
import { initialWorkflow } from "./data";
import { Inspector } from "./inspector";
import { Palette, STEP_MIME } from "./palette";
import { issuesOf, workflowRules } from "./rules";
import { renderStep } from "./step-node";
import { styles } from "./styles";
import type { Types } from "./types";
import { useWorkflow } from "./use-workflow";

// An automation editor built from the primitives: a palette of typed steps (drag one in, or click
// it), custom nodes with typed ports, connection rules as a middleware (a refused port turns red
// while you drag), a condition's two branches labelled on their edges, the inspector of the
// selected step, a minimap and the zoom controls. The palette and the inspector sit beside the
// root and work on the same model.

const features = [
    selection(),
    drag({ snapGrid: [10, 10] }),
    connection(),
    reconnection(),
    keyboard(),
    minimap(),
] as const;

type Features = typeof features;

let added = 0;

function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="connection"
            aria-label={`${edge.source} to ${edge.target}`}
            className={styles.edgeGroup}
        >
            <Flow.EdgePath className={styles.edgeHit} />
            <Flow.EdgePath className={styles.edge} />
            {edge.type === "branch" && (
                <Flow.EdgeLabel
                    className={styles.branchLabel(edge.data?.branch)}
                >
                    {edge.data?.branch}
                </Flow.EdgeLabel>
            )}
        </Flow.Edge>
    );
}

/** The header's status: how many issues the workflow has left. */
function Status({ model }: { model: FlowModel<Types, Features> }) {
    const { steps, edges } = useWorkflow(model);
    const count = steps.reduce(
        (sum, step) => sum + issuesOf(step, edges).length,
        0,
    );
    return (
        <>
            <Badge
                variant="soft"
                className={styles.statusBadge(count === 0)}
                data-testid="status"
            >
                {count === 0
                    ? "Ready"
                    : `${count} issue${count > 1 ? "s" : ""}`}
            </Badge>
            <button
                type="button"
                disabled={count > 0}
                className={styles.publish}
            >
                Publish
            </button>
        </>
    );
}

export default function WorkflowBuilder() {
    const [model] = useState<FlowModel<Types, Features>>(() => {
        const created = createFlowModel<Types, Features>(initialWorkflow, {
            features,
        });
        created.use(workflowRules);
        // a branch of a condition is labelled with its branch
        created.use((ctx, next) => {
            if (ctx.command === "edge.add") {
                const source = ctx.get("node-by", { id: ctx.payload.source });
                const branch = ctx.payload.sourceHandle;
                ctx.payload =
                    source?.type === "condition" &&
                    (branch === "yes" || branch === "no")
                        ? { ...ctx.payload, type: "branch", data: { branch } }
                        : { ...ctx.payload, type: "smoothstep" };
            }
            return next();
        });
        return created;
    });
    const flow = useFlowRef<Types, Features>();

    /** Adds a step centred on a client point (a drop's, or the canvas' centre). */
    function addStep(entry: CatalogEntry, client?: { x: number; y: number }) {
        const current = flow.current;
        if (!current) return;
        const size = current.engine.get("root-size");
        const viewport = current.engine.get("viewport");
        const point = client
            ? current.engine.get("screen-to-flow", client)
            : {
                  x: (size.width / 2 - viewport.x) / viewport.zoom,
                  y: (size.height / 2 - viewport.y) / viewport.zoom,
              };
        added += 1;
        const id = `${entry.id}-${added}`;
        // the new step is centred on the point, and selected so the inspector shows it
        current.model.run("batch", {
            commands: [
                {
                    command: "node.add",
                    payload: entry.create(id, {
                        x: Math.round(point.x - 110),
                        y: Math.round(point.y - 30),
                    }),
                },
                { command: "selection.set", payload: { nodeIds: [id] } },
            ],
        });
    }

    function onDrop(event: DragEvent<HTMLDivElement>) {
        const entry = CATALOG.find(
            (item) => item.id === event.dataTransfer.getData(STEP_MIME),
        );
        if (!entry) return;
        event.preventDefault();
        addStep(entry, { x: event.clientX, y: event.clientY });
    }

    return (
        <div className={styles.app}>
            <header className={styles.header}>
                <span className={styles.logo}>
                    <WorkflowIcon />
                </span>
                <div className={styles.headerText}>
                    <h1 className={styles.appTitle}>Order follow-up</h1>
                    <p className={styles.breadcrumb}>Automations · Draft</p>
                </div>
                <Status model={model} />
            </header>
            <Palette onAdd={(entry) => addStep(entry)} />
            <Flow.Root<Types, Features>
                model={model}
                flowRef={flow}
                fitView={{ padding: 0.08, maxZoom: 1 }}
                minZoom={0.3}
                pathOptions={{ borderRadius: 10 }}
                aria-label="Workflow canvas"
                role="group"
                onDragOver={(event) => {
                    if (!event.dataTransfer.types.includes(STEP_MIME)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={onDrop}
                className={styles.root}
            >
                <Flow.Background
                    variant="dots"
                    size={2}
                    className={styles.dots}
                />
                <Flow.Background variant="lines" className={styles.lines} />
                <Flow.Background variant="cross" className={styles.cross} />
                <Flow.Viewport>
                    <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                    <Flow.Nodes<Types>>{renderStep}</Flow.Nodes>
                    <Flow.ConnectionLine className={styles.connection} />
                </Flow.Viewport>
                <Flow.SelectionBox className={styles.box} />
                <Flow.Controls
                    role="group"
                    aria-label="Zoom"
                    className={styles.controls}
                >
                    <Flow.ZoomIn
                        aria-label="Zoom in"
                        className={styles.control}
                    >
                        <PlusIcon />
                    </Flow.ZoomIn>
                    <Flow.ZoomOut
                        aria-label="Zoom out"
                        className={styles.control}
                    >
                        <MinusIcon />
                    </Flow.ZoomOut>
                    <Flow.FitView
                        aria-label="Fit view"
                        className={styles.control}
                    >
                        <MaximizeIcon />
                    </Flow.FitView>
                </Flow.Controls>
                <MiniMap
                    width={120}
                    height={84}
                    role="img"
                    aria-label="Minimap of the workflow"
                    className={styles.minimap}
                >
                    {(view) => (
                        <>
                            {view.nodes.map((node) => (
                                <MiniMapNode
                                    key={node.nodeId}
                                    nodeId={node.nodeId}
                                    className={styles.minimapNode}
                                />
                            ))}
                            <MiniMapMask className={styles.minimapMask} />
                        </>
                    )}
                </MiniMap>
            </Flow.Root>
            <Inspector model={model} />
        </div>
    );
}
