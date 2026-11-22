import {
    Flow,
    type FlowEngineEventOf,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlowRef,
    type XY,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import {
    type KeyboardEvent as ReactKeyboardEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import { styles } from "./styles";

// A context menu of your own. The root tells a right click (or the menu key) where it happened:
// `onNodeContextMenu` on a node, `onSelectionContextMenu` on one of several selected nodes,
// `onPaneContextMenu` on the canvas, each with the client point (`client`), the flow point
// (`point`) and the DOM event, whose default the example prevents to show its menu instead of the
// browser's. The menu stands at the client point inside the frame; a click on the canvas or a
// node, Escape, a pan, focus leaving it or a choice closes it, and focus goes back to the task (or
// the canvas) it was opened on. With `keyboard()` tasks take focus, so the menu key (or Shift +
// F10) opens a task's menu too; the arrows walk its items. `onNodeDoubleClick` marks a task done,
// as the menu's first item does. These come from the engine's own taps: a right click that ended
// a pan opens nothing.

interface Types extends FlowTypes {
    readonly nodes: { task: { label: string; done: boolean } };
}

const features = [selection(), drag(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "plan",
        type: "task",
        position: { x: 0, y: 0 },
        data: { label: "Plan", done: false },
    },
    {
        id: "build",
        type: "task",
        position: { x: 200, y: 80 },
        data: { label: "Build", done: false },
    },
    {
        id: "ship",
        type: "task",
        position: { x: 400, y: 0 },
        data: { label: "Ship", done: false },
    },
];

/** What the menu acts on, and where it stands (relative to the frame). */
type Menu =
    | { kind: "node"; nodeId: string; at: XY }
    | { kind: "selection"; nodeIds: readonly string[]; at: XY }
    | { kind: "pane"; point: XY; at: XY };

let added = 0;

function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-label={`${node.data.label}${node.data.done ? ", done" : ""}`}
            className={styles.node}
        >
            {node.data.done ? `✓ ${node.data.label}` : node.data.label}
            <Flow.Handle type="target" side="left" className={styles.handle} />
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

export default function ContextMenu() {
    const flow = useFlowRef<Types, typeof features>();
    const frame = useRef<HTMLDivElement>(null);
    const [menu, setMenu] = useState<Menu | null>(null);
    const first = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (menu) first.current?.focus();
    }, [menu]);

    /** The menu's place: the client point, inside the frame. */
    const at = (client: XY): XY => {
        const box = frame.current?.getBoundingClientRect();
        return { x: client.x - (box?.x ?? 0), y: client.y - (box?.y ?? 0) };
    };

    /** Opens a menu instead of the browser's. */
    const open = (
        event: { event: MouseEvent; client: XY },
        next: (where: XY) => Menu,
    ) => {
        event.event.preventDefault();
        setMenu(next(at(event.client)));
    };

    const onNode = (event: FlowEngineEventOf<"node-context-menu">) =>
        open(event, (where) => ({
            kind: "node",
            nodeId: event.nodeId,
            at: where,
        }));
    const onSelection = (event: FlowEngineEventOf<"selection-context-menu">) =>
        open(event, (where) => ({
            kind: "selection",
            nodeIds: event.nodeIds,
            at: where,
        }));
    const onPane = (event: FlowEngineEventOf<"pane-context-menu">) =>
        open(event, (where) => ({
            kind: "pane",
            point: event.point,
            at: where,
        }));

    /** Closes the menu, giving focus back to the task it was opened on (or the canvas). */
    const close = () => {
        if (!menu) return;
        const opener =
            (menu.kind === "node"
                ? frame.current?.querySelector<HTMLElement>(
                      `[data-flow-part="node"][data-flow-id="${menu.nodeId}"]`,
                  )
                : undefined) ??
            frame.current?.querySelector<HTMLElement>(
                '[data-flow-part="root"]',
            );
        setMenu(null);
        opener?.focus({ preventScroll: true });
    };
    const model = () => flow.current?.model;

    /** The arrows, Home and End walk the menu's items; Escape closes it. */
    const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
        }
        const items = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
                '[role="menuitem"]',
            ),
        ];
        const at = items.indexOf(document.activeElement as HTMLElement);
        const next =
            event.key === "ArrowDown"
                ? (at + 1) % items.length
                : event.key === "ArrowUp"
                  ? (at - 1 + items.length) % items.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : -1;
        if (next < 0) return;
        event.preventDefault();
        items[next]?.focus();
    };

    const toggleDone = (nodeId: string) => {
        const node = model()?.get("node-by", { id: nodeId });
        if (node)
            model()?.run("node.set-data", {
                nodeId,
                data: { done: !node.data.done },
            });
    };

    const duplicate = (nodeId: string) => {
        const node = model()?.get("node-by", { id: nodeId });
        if (!node) return;
        added += 1;
        model()?.run("node.add", {
            id: `${nodeId}-copy-${added}`,
            type: "task",
            position: { x: node.position.x + 30, y: node.position.y + 60 },
            data: { label: `${node.data.label} copy`, done: false },
        });
        close();
    };
    const remove = (nodeIds: readonly string[]) => {
        model()?.run("batch", {
            commands: nodeIds.map((nodeId) => ({
                command: "node.remove" as const,
                payload: { nodeId },
            })),
        });
        close();
    };
    const addAt = (point: XY) => {
        added += 1;
        model()?.run("node.add", {
            id: `task-${added}`,
            type: "task",
            position: point,
            data: { label: `Task ${added}`, done: false },
        });
        close();
    };

    return (
        <div ref={frame} className={styles.frame}>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                fitView={{ padding: 0.3, maxZoom: 1 }}
                flowRef={flow}
                onNodeContextMenu={onNode}
                onSelectionContextMenu={onSelection}
                onPaneContextMenu={onPane}
                onPaneClick={close}
                onNodeClick={close}
                onMoveStart={close}
                onNodeDoubleClick={(event) => toggleDone(event.nodeId)}
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
                    <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
                </Flow.Viewport>
            </Flow.Root>
            {menu && (
                <div
                    role="menu"
                    aria-label="Actions"
                    tabIndex={-1}
                    onKeyDown={onMenuKey}
                    onBlur={(event) => {
                        // focus left the menu (Tab, a click elsewhere): it closes
                        if (!event.currentTarget.contains(event.relatedTarget))
                            setMenu(null);
                    }}
                    style={{ left: menu.at.x, top: menu.at.y }}
                    className={styles.menu}
                >
                    {menu.kind === "node" && (
                        <>
                            <button
                                ref={first}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    toggleDone(menu.nodeId);
                                    close();
                                }}
                                className={styles.item}
                            >
                                {model()?.get("node-by", { id: menu.nodeId })
                                    ?.data.done
                                    ? "Mark not done"
                                    : "Mark done"}
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => duplicate(menu.nodeId)}
                                className={styles.item}
                            >
                                Duplicate
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => remove([menu.nodeId])}
                                className={styles.danger}
                            >
                                Delete
                            </button>
                        </>
                    )}
                    {menu.kind === "selection" && (
                        <button
                            ref={first}
                            type="button"
                            role="menuitem"
                            onClick={() => remove(menu.nodeIds)}
                            className={styles.danger}
                        >
                            Delete {menu.nodeIds.length} tasks
                        </button>
                    )}
                    {menu.kind === "pane" && (
                        <button
                            ref={first}
                            type="button"
                            role="menuitem"
                            onClick={() => addAt(menu.point)}
                            className={styles.item}
                        >
                            Add a task here
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
