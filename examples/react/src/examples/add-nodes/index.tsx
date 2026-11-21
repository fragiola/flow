import {
    Flow,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlowRef,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { CircleIcon, DiamondIcon, SquareIcon } from "lucide-react";
import type { DragEvent } from "react";
import { styles } from "./styles";

// Adding nodes from outside the flow. The palette's items are dragged with the browser's own drag
// and drop: the root accepts the drop, and `engine.get("screen-to-flow", { x, y })` turns the
// drop's client point into flow coordinates, where `node.add` puts the node. A click on an item
// adds one at the centre of the view instead. `useFlowRef` reaches the model and the engine from
// outside the root.

const SHAPES = [
    { shape: "circle", label: "Start", icon: CircleIcon },
    { shape: "square", label: "Task", icon: SquareIcon },
    { shape: "diamond", label: "Decision", icon: DiamondIcon },
] as const;

type Shape = (typeof SHAPES)[number]["shape"];

interface Types extends FlowTypes {
    readonly nodes: { shape: { shape: Shape; label: string } };
}

const features = [selection(), drag(), connection()] as const;

const MIME = "application/x-flow-shape";

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "first",
        type: "shape",
        position: { x: 0, y: 0 },
        data: { shape: "circle", label: "Start" },
    },
];

let count = 0;

function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types> node={node} className={styles.shape(node.data.shape)}>
            {node.data.label}
            <Flow.Handle type="target" side="top" className={styles.handle} />
            <Flow.Handle
                type="source"
                side="bottom"
                className={styles.handle}
            />
        </Flow.Node>
    );
}

export default function AddNodes() {
    const flow = useFlowRef<Types, typeof features>();

    /** Adds a node centred on a client point (a drop's, or the view's centre). */
    function addAt(shape: Shape, client: { x: number; y: number }) {
        const current = flow.current;
        if (!current) return;
        const point = current.engine.get("screen-to-flow", client);
        const label =
            SHAPES.find((item) => item.shape === shape)?.label ?? shape;
        count += 1;
        current.model.run("node.add", {
            id: `${shape}-${count}`,
            type: "shape",
            // the node's top-left corner, so that its middle lands on the point
            position: { x: point.x - 50, y: point.y - 20 },
            data: { shape, label: `${label} ${count}` },
        });
    }

    function addAtCentre(shape: Shape, button: HTMLElement) {
        const root = button
            .closest("[data-testid=add-nodes]")
            ?.querySelector('[data-flow-part="root"]');
        const box = root?.getBoundingClientRect();
        if (box)
            addAt(shape, {
                x: box.x + box.width / 2,
                y: box.y + box.height / 2,
            });
    }

    function onDrop(event: DragEvent<HTMLDivElement>) {
        const shape = event.dataTransfer.getData(MIME) as Shape;
        if (!SHAPES.some((item) => item.shape === shape)) return;
        event.preventDefault();
        addAt(shape, { x: event.clientX, y: event.clientY });
    }

    return (
        <div data-testid="add-nodes" className={styles.layout}>
            <aside aria-label="Node palette" className={styles.palette}>
                <p className={styles.paletteTitle}>Drag or click</p>
                {SHAPES.map(({ shape, label, icon: Icon }) => (
                    <button
                        key={shape}
                        type="button"
                        draggable
                        onDragStart={(event) => {
                            event.dataTransfer.setData(MIME, shape);
                            event.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={(event) =>
                            addAtCentre(shape, event.currentTarget)
                        }
                        className={styles.item}
                    >
                        <Icon />
                        {label}
                    </button>
                ))}
            </aside>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                defaultViewport={{ x: 160, y: 80, zoom: 1 }}
                flowRef={flow}
                onDragOver={(event) => {
                    if (!event.dataTransfer.types.includes(MIME)) return;
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
                    <Flow.Edges<Types>>
                        {(edge) => (
                            <Flow.Edge<Types> edge={edge}>
                                <Flow.EdgePath className={styles.edge} />
                            </Flow.Edge>
                        )}
                    </Flow.Edges>
                    <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
                    <Flow.ConnectionLine className={styles.connection} />
                </Flow.Viewport>
            </Flow.Root>
        </div>
    );
}
