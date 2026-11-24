// The tree behind the auto-layout example, as plain data: a topic's children and descendants read
// from the edges, which nodes show given the collapsed topics, and the commands (for one `batch`)
// that add a child, collapse a topic or expand it again. Under every shown topic sits a "+"
// placeholder, a node of its own (`add-<topic id>`) joined to its topic by an edge, laid out with
// the rest. Framework-free: no UI library, no DOM, so every framework's example uses it unchanged.

/** A point in flow units. */
export interface Point {
    readonly x: number;
    readonly y: number;
}

/** A topic's data: its label, and whether its subtree is folded away. */
export interface TopicData {
    readonly label: string;
    readonly collapsed?: boolean;
}

/** A placeholder's data: the topic it adds children to, and that topic's label (for its name). */
export interface PlaceholderData {
    readonly parentId: string;
    readonly parentLabel: string;
}

/** What the tree reads of a node: its id, type, data, place and whether it is hidden. */
export interface TreeNode {
    readonly id: string;
    readonly type?: string;
    readonly position: Point;
    readonly hidden?: boolean;
    readonly data: unknown;
}

/** What the tree reads of an edge: its id, its ends and whether it is hidden. */
export interface TreeEdge {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly hidden?: boolean;
}

/** A topic's declared box, and a placeholder's, in flow units: what dagre lays out. */
export const TOPIC_SIZE = { width: 150, height: 44 } as const;
export const PLACEHOLDER_SIZE = { width: 32, height: 32 } as const;

/**
 * A placeholder is never selected, focused as a node or deleted. It stays draggable and
 * connectable: `node.move` (the layout's moves) refuses a node that is not draggable, and
 * `edge.add` (its own edge, added after it) one that is not connectable.
 */
const PLACEHOLDER_FLAGS = {
    selectable: false,
    focusable: false,
    deletable: false,
} as const;

/** Its edge is drawn only: never selected, focused, deleted or reconnected. */
const PLACEHOLDER_EDGE_FLAGS = {
    selectable: false,
    focusable: false,
    deletable: false,
    reconnectable: false,
} as const;

const PLACEHOLDER = "add-";

/** The placeholder under a topic, and the edge to it. */
export const placeholderId = (topicId: string) => `${PLACEHOLDER}${topicId}`;
export const edgeId = (source: string, target: string) => `${source}-${target}`;

/** A placeholder's id starts with `add-`. */
export const isPlaceholder = (id: string) => id.startsWith(PLACEHOLDER);

/** The topic a placeholder belongs to. */
export const topicOf = (id: string) =>
    isPlaceholder(id) ? id.slice(PLACEHOLDER.length) : id;

/** A topic's data, read from a node. */
export const topicData = (node: TreeNode): TopicData => node.data as TopicData;

/** A topic node, in the document (with its size). */
export function topicNode(id: string, label: string, position: Point) {
    return {
        id,
        type: "topic" as const,
        position,
        ...TOPIC_SIZE,
        data: { label },
    };
}

/** The placeholder node under a topic. */
export function placeholderNode(
    topicId: string,
    topicLabel: string,
    position: Point,
) {
    return {
        id: placeholderId(topicId),
        type: "add" as const,
        position,
        ...PLACEHOLDER_SIZE,
        ...PLACEHOLDER_FLAGS,
        data: { parentId: topicId, parentLabel: topicLabel },
    };
}

/** The dashed edge from a topic to its placeholder. */
export function placeholderEdge(topicId: string) {
    return {
        id: edgeId(topicId, placeholderId(topicId)),
        source: topicId,
        target: placeholderId(topicId),
        ...PLACEHOLDER_EDGE_FLAGS,
    };
}

/** An edge from a topic to its child. */
export const topicEdge = (source: string, target: string) => ({
    id: edgeId(source, target),
    source,
    target,
});

/** A topic's children (topics only, no placeholder), in the edges' order. */
export function childrenOf(edges: readonly TreeEdge[], id: string): string[] {
    return edges
        .filter((edge) => edge.source === id && !isPlaceholder(edge.target))
        .map((edge) => edge.target);
}

/** Every topic below a topic, depth first (each once, even if two branches join). */
export function descendantsOf(
    edges: readonly TreeEdge[],
    id: string,
): string[] {
    const seen = new Set<string>();
    const walk = (from: string) => {
        for (const child of childrenOf(edges, from)) {
            if (seen.has(child) || child === id) continue;
            seen.add(child);
            walk(child);
        }
    };
    walk(id);
    return [...seen];
}

/**
 * The ids of the nodes that show when the topics in `collapsed` are folded: a topic shows when
 * no topic above it is collapsed; a placeholder when its topic shows and is not collapsed.
 */
export function visibleIds(
    nodes: readonly TreeNode[],
    edges: readonly TreeEdge[],
    collapsed: ReadonlySet<string>,
): Set<string> {
    const hidden = new Set<string>();
    for (const id of collapsed) {
        for (const below of descendantsOf(edges, id)) hidden.add(below);
    }
    const shown = new Set<string>();
    for (const node of nodes) {
        if (isPlaceholder(node.id)) {
            const topic = topicOf(node.id);
            if (!hidden.has(topic) && !collapsed.has(topic)) shown.add(node.id);
        } else if (!hidden.has(node.id)) {
            shown.add(node.id);
        }
    }
    return shown;
}

/** The topics whose data says they are collapsed. */
export function collapsedIds(nodes: readonly TreeNode[]): Set<string> {
    return new Set(
        nodes
            .filter((node) => !isPlaceholder(node.id))
            .filter((node) => topicData(node).collapsed === true)
            .map((node) => node.id),
    );
}

/** One command of a `batch`, as plain data (the flow's `BatchEntry` accepts it). */
export type TreeCommand =
    | {
          readonly command: "node.add";
          readonly payload:
              | ReturnType<typeof topicNode>
              | ReturnType<typeof placeholderNode>;
      }
    | {
          readonly command: "edge.add";
          readonly payload:
              | ReturnType<typeof topicEdge>
              | ReturnType<typeof placeholderEdge>;
      }
    | {
          readonly command: "node.set-flags";
          readonly payload: {
              readonly nodeId: string;
              readonly hidden: boolean;
          };
      }
    | {
          readonly command: "edge.set-flags";
          readonly payload: {
              readonly edgeId: string;
              readonly hidden: boolean;
          };
      }
    | {
          readonly command: "node.set-data";
          readonly payload: {
              readonly nodeId: string;
              readonly data: { readonly collapsed: boolean };
          };
      };

/**
 * The commands that add topic `id` (labelled `label`) under `parent`, for one `batch`: the topic
 * and its edge, its own placeholder and that edge. Both start at the parent's place, for the
 * layout to move them out; the parent keeps its placeholder.
 */
export function addChildCommands(
    parent: TreeNode,
    id: string,
    label: string,
): TreeCommand[] {
    const at = parent.position;
    return [
        { command: "node.add", payload: topicNode(id, label, at) },
        { command: "edge.add", payload: topicEdge(parent.id, id) },
        { command: "node.add", payload: placeholderNode(id, label, at) },
        { command: "edge.add", payload: placeholderEdge(id) },
    ];
}

/**
 * The flags that make the document show exactly `shown`: a `node.set-flags { hidden }` for each
 * node whose flag differs, an `edge.set-flags { hidden }` for each edge whose flag differs (an
 * edge shows when its target does).
 */
export function visibilityCommands(
    nodes: readonly TreeNode[],
    edges: readonly TreeEdge[],
    shown: ReadonlySet<string>,
): TreeCommand[] {
    const commands: TreeCommand[] = [];
    for (const node of nodes) {
        const hidden = !shown.has(node.id);
        if ((node.hidden === true) !== hidden) {
            commands.push({
                command: "node.set-flags",
                payload: { nodeId: node.id, hidden },
            });
        }
    }
    for (const edge of edges) {
        const hidden = !shown.has(edge.target) || !shown.has(edge.source);
        if ((edge.hidden === true) !== hidden) {
            commands.push({
                command: "edge.set-flags",
                payload: { edgeId: edge.id, hidden },
            });
        }
    }
    return commands;
}

/**
 * The commands that collapse topic `id` (`collapsed: false` expands it), for one `batch`: its
 * flag in its data, then the hidden flags of every node and edge whose visibility changes. A
 * collapse hides its descendants, their placeholders and its own; an expand shows them again,
 * except those under a topic still collapsed.
 */
export function toggleCommands(
    nodes: readonly TreeNode[],
    edges: readonly TreeEdge[],
    id: string,
    collapsed: boolean,
): TreeCommand[] {
    const folded = collapsedIds(nodes);
    if (collapsed) folded.add(id);
    else folded.delete(id);
    return [
        {
            command: "node.set-data",
            payload: { nodeId: id, data: { collapsed } },
        },
        ...visibilityCommands(nodes, edges, visibleIds(nodes, edges, folded)),
    ];
}
