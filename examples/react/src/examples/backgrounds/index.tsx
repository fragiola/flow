import {
    type BackgroundVariant,
    Flow,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { useState } from "react";
import { styles } from "./styles";

// `Flow.Background` draws one SVG pattern that pans and zooms with the flow: `dots`, `lines` or
// `cross`, every `gap` flow units, its marks `size` units big, in `currentColor`. Two backgrounds
// layer: here a coarse grid of lines every five cells over the chosen pattern.

interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

const features = [drag()] as const;

const VARIANTS: { value: BackgroundVariant; label: string }[] = [
    { value: "dots", label: "Dots" },
    { value: "lines", label: "Lines" },
    { value: "cross", label: "Cross" },
];

const GAPS = [16, 24, 40];

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "card",
        position: { x: 0, y: 0 },
        data: { label: "Drag me" },
    },
    {
        id: "b",
        type: "card",
        position: { x: 240, y: 120 },
        data: { label: "Zoom out" },
    },
];

export default function Backgrounds() {
    const [variant, setVariant] = useState<BackgroundVariant>("dots");
    const [gap, setGap] = useState(24);
    const [coarse, setCoarse] = useState(true);
    return (
        <div className={styles.layout}>
            <div
                role="toolbar"
                aria-label="Background"
                className={styles.toolbar}
            >
                <fieldset className={styles.group}>
                    <legend className={styles.legend}>Pattern</legend>
                    {VARIANTS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={variant === option.value}
                            onClick={() => setVariant(option.value)}
                            className={styles.segment}
                        >
                            {option.label}
                        </button>
                    ))}
                </fieldset>
                <fieldset className={styles.group}>
                    <legend className={styles.legend}>Gap</legend>
                    {GAPS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={gap === value}
                            onClick={() => setGap(value)}
                            className={styles.segment}
                        >
                            {value}
                        </button>
                    ))}
                </fieldset>
                <label className={styles.check}>
                    <input
                        type="checkbox"
                        checked={coarse}
                        onChange={(event) => setCoarse(event.target.checked)}
                    />
                    Coarse grid
                </label>
            </div>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                fitView={{ padding: 0.2, maxZoom: 1 }}
                className={styles.root}
            >
                <Flow.Background
                    data-testid="pattern"
                    variant={variant}
                    gap={gap}
                    size={
                        variant === "dots" ? 2.5 : variant === "cross" ? 8 : 1
                    }
                    className={styles.pattern}
                />
                {coarse && (
                    <Flow.Background
                        data-testid="coarse-grid"
                        variant="lines"
                        gap={gap * 5}
                        size={1.5}
                        className={styles.coarse}
                    />
                )}
                <Flow.Viewport>
                    <Flow.Nodes<Types>>
                        {(node) => (
                            <Flow.Node<Types>
                                node={node}
                                className={styles.node}
                            >
                                {node.data.label}
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                </Flow.Viewport>
            </Flow.Root>
        </div>
    );
}
