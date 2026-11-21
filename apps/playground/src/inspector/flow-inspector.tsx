import {
    type FlowEngineEvent,
    useEdges,
    useFlow,
    useNodes,
    useSelection,
    useViewport,
} from "@fragiola/flow-react";
import { useEffect, useState } from "react";

// The inspector of a scenario: what the model and the engine hold now. It renders inside a
// `Flow.Root` (it reads the flow with the hooks) as a panel over the canvas; its presses, keys and
// wheel are its own (`data-flow-no-gesture`, `data-flow-no-wheel`). Dev-only: never in an example.

/** The engine's gestures under way, read every frame while the inspector is shown. */
function useGestures(): string[] {
    const { engine } = useFlow();
    const [gestures, setGestures] = useState<string[]>([]);
    useEffect(() => {
        let frame = 0;
        let last = "";
        // every gesture's key, whichever features the flow has (a missing one throws)
        const is = engine.is as (key: string) => boolean;
        const read = () => {
            const now = (
                [
                    "panning",
                    "dragging",
                    "connecting",
                    "resizing",
                    "box-selecting",
                ] as const
            ).filter((key) => {
                try {
                    return is(key);
                } catch {
                    return false; // a feature the flow does not have
                }
            });
            const key = now.join(",");
            if (key !== last) {
                last = key;
                setGestures(now);
            }
            frame = requestAnimationFrame(read);
        };
        frame = requestAnimationFrame(read);
        return () => cancelAnimationFrame(frame);
    }, [engine]);
    return gestures;
}

function Json() {
    const { model } = useFlow();
    // re-rendered by every change of the nodes or the edges
    useNodes();
    useEdges();
    return (
        <pre
            data-testid="inspector-json"
            className="max-h-72 overflow-auto rounded bg-palette-soft p-2 text-[0.625rem] leading-tight"
        >
            {JSON.stringify(model.get("flow-json"), null, 2)}
        </pre>
    );
}

export function FlowInspector({ json = true }: { json?: boolean }) {
    const { engine } = useFlow();
    const viewport = useViewport();
    const selection = useSelection();
    const gestures = useGestures();
    const [events, setEvents] = useState<FlowEngineEvent[]>([]);
    useEffect(
        () =>
            engine.subscribe((event) => {
                if (event.type === "viewport-change") return;
                setEvents((list) => [event, ...list].slice(0, 8));
            }),
        [engine],
    );
    return (
        <aside
            aria-label="Inspector"
            data-flow-no-gesture=""
            data-flow-no-wheel=""
            className="palette-raised absolute top-2 end-2 flex max-h-[calc(100%-1rem)] w-72 flex-col gap-2 overflow-auto rounded-md border border-palette-line bg-palette-base p-2 font-mono text-[0.6875rem] text-palette-contrast shadow"
        >
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                <dt className="text-palette-accent/85">viewport</dt>
                <dd data-testid="inspector-viewport">
                    {viewport.x.toFixed(0)}, {viewport.y.toFixed(0)} ×{" "}
                    {viewport.zoom.toFixed(2)}
                </dd>
                <dt className="text-palette-accent/85">gestures</dt>
                <dd data-testid="inspector-gestures">
                    {gestures.join(", ") || "none"}
                </dd>
                <dt className="text-palette-accent/85">interactive</dt>
                <dd>{String(engine.is("interactive"))}</dd>
                <dt className="text-palette-accent/85">selected</dt>
                <dd data-testid="inspector-selection">
                    {[
                        ...selection.nodes.map((node) => node.id),
                        ...selection.edges.map((edge) => edge.id),
                    ].join(", ") || "none"}
                </dd>
            </dl>
            <ol
                aria-label="Engine events"
                data-testid="inspector-events"
                className="flex flex-col gap-0.5 border-t border-palette-line pt-1"
            >
                {events.map((event, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a log, newest first
                    <li key={index} className="truncate">
                        {event.type}{" "}
                        <span className="text-palette-accent/85">
                            {JSON.stringify({ ...event, type: undefined })}
                        </span>
                    </li>
                ))}
            </ol>
            {json && <Json />}
        </aside>
    );
}
