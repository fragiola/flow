import {
    Flow,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import {
    NodeResizer,
    RESIZE_POSITIONS,
    ResizeHandle,
    resize,
} from "@fragiola/flow-react/resize";
import { selection } from "@fragiola/flow-react/selection";
import { styles } from "./styles";

// `resize()` and `NodeResizer`: a handle on each corner and side of the node; dragging one resizes
// the node (`node.resize`, its `width` and `height` written to the document). Each resizer has its
// own limits over the feature's; the photo keeps its aspect ratio. The handles show while the node
// is selected (a style on the node's `data-selected`). With `keyboard()` each handle takes focus:
// Tab to one and use the arrows (Shift for a bigger step); each has its own name, the default
// handles have none.

interface Types extends FlowTypes {
    readonly nodes: {
        note: { label: string; text: string; limits: string };
        photo: { label: string };
    };
}

const features = [
    selection(),
    drag(),
    resize({ minWidth: 80, minHeight: 60 }),
    keyboard(),
] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "note",
        type: "note",
        position: { x: 0, y: 0 },
        width: 200,
        height: 120,
        selected: true,
        data: {
            label: "Note",
            text: "Resize me from any corner or side.",
            limits: "120–360 × 80–240",
        },
    },
    {
        id: "photo",
        type: "photo",
        position: { x: 260, y: 0 },
        width: 160,
        height: 120,
        data: { label: "Photo (4:3, keeps its ratio)" },
    },
];

/** Every corner and side, each named: with `keyboard()` a handle takes focus. */
function Handles({ nodeId }: { nodeId: string }) {
    return RESIZE_POSITIONS.map((position) => (
        <ResizeHandle
            key={position}
            position={position}
            aria-label={`Resize ${nodeId}: ${position}`}
            className={styles.resizeHandle}
        />
    ));
}

function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types>
            node={node}
            aria-label={node.data.label}
            className={styles.node}
        >
            <span className={styles.title}>{node.data.label}</span>
            {node.type === "note" ? (
                <>
                    <p className={styles.text}>{node.data.text}</p>
                    <span className={styles.limits}>{node.data.limits}</span>
                    <NodeResizer
                        minWidth={120}
                        maxWidth={360}
                        minHeight={80}
                        maxHeight={240}
                        className={styles.resizer}
                    >
                        <Handles nodeId={node.id} />
                    </NodeResizer>
                </>
            ) : (
                <>
                    <div
                        role="img"
                        aria-label="A placeholder photo"
                        className={styles.photo}
                    />
                    <NodeResizer keepAspectRatio className={styles.resizer}>
                        <Handles nodeId={node.id} />
                    </NodeResizer>
                </>
            )}
        </Flow.Node>
    );
}

export default function NodeResizerExample() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
    );
}
