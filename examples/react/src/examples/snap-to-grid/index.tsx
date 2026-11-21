import {
    Flow,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { useRef, useState } from "react";
import { styles } from "./styles";

// `drag({ snapGrid })` moves a dragged node onto the grid: its top-left corner lands on a multiple
// of the grid (the other dragged nodes keep their offsets). The background draws the same grid
// (`gap`). A feature's options are fixed when the model is made, so another grid size remounts the
// root, starting from the nodes as they are now.

interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

const SIZES = [10, 20, 40];

const initial: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "card",
        position: { x: 0, y: 0 },
        data: { label: "Snaps" },
    },
    {
        id: "b",
        type: "card",
        position: { x: 200, y: 80 },
        data: { label: "to the" },
    },
    {
        id: "c",
        type: "card",
        position: { x: 80, y: 200 },
        data: { label: "grid" },
    },
];

function SnappingFlow({
    grid,
    nodes,
    onNodesChange,
}: {
    grid: number;
    nodes: readonly FlowNodeInput<Types>[];
    onNodesChange: (nodes: readonly FlowNode<Types>[]) => void;
}) {
    // made once per grid size: the root reads its features once
    const [features] = useState(
        () => [selection(), drag({ snapGrid: [grid, grid] })] as const,
    );
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            onNodesChange={onNodesChange}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            className={styles.root}
        >
            <Flow.Background
                variant="dots"
                gap={grid}
                size={2}
                className={styles.dots}
            />
            <Flow.Background
                variant="lines"
                gap={grid}
                className={styles.lines}
            />
            <Flow.Background
                variant="cross"
                gap={grid}
                className={styles.cross}
            />
            <Flow.Viewport>
                <Flow.Nodes<Types>>
                    {(node) => (
                        <Flow.Node<Types> node={node} className={styles.node}>
                            {node.data.label}
                            <span
                                data-testid="position"
                                className={styles.position}
                            >
                                {node.position.x}, {node.position.y}
                            </span>
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
    );
}

export default function SnapToGrid() {
    const [grid, setGrid] = useState(20);
    // the nodes as they are now, for the next remount
    const nodes = useRef<readonly FlowNodeInput<Types>[]>(initial);
    return (
        <div className={styles.layout}>
            <fieldset className={styles.toolbar}>
                <legend className={styles.legend}>Grid size</legend>
                {SIZES.map((size) => (
                    <button
                        key={size}
                        type="button"
                        aria-pressed={grid === size}
                        onClick={() => setGrid(size)}
                        className={styles.segment}
                    >
                        {size} px
                    </button>
                ))}
            </fieldset>
            <SnappingFlow
                key={grid}
                grid={grid}
                nodes={nodes.current}
                onNodesChange={(next) => {
                    nodes.current = next;
                }}
            />
        </div>
    );
}
