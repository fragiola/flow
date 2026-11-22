// The JSON Schema of a flow document (D3), written by hand in the subset the validator checks, and
// tested equal to the document's types (`tests/types/schemas.ts`). Every schema here is
// self-contained (no `$ref`): `node.add` and `edge.add` take a node and an edge as their payloads,
// so their schemas are these, as `model.get("commands")` hands them to an assistant.

/** A point in flow coordinates. */
export const xySchema = {
    type: "object",
    description:
        "a point in flow coordinates: x grows to the right, y grows down",
    properties: {
        x: { type: "number", description: "the horizontal coordinate" },
        y: { type: "number", description: "the vertical coordinate" },
    },
    required: ["x", "y"],
    additionalProperties: false,
} as const;

/** A rectangle in flow coordinates: a node's `extent`. */
export const rectSchema = {
    type: "object",
    description:
        "a rectangle in flow coordinates: its top-left corner and its size",
    properties: {
        x: { type: "number", description: "its left edge" },
        y: { type: "number", description: "its top edge" },
        width: { type: "number", minimum: 0, description: "its width" },
        height: { type: "number", minimum: 0, description: "its height" },
    },
    required: ["x", "y", "width", "height"],
    additionalProperties: false,
} as const;

/** A node's `extent`: its parent's box, or a rectangle. */
export const extentSchema = {
    anyOf: [{ const: "parent" }, rectSchema],
    description:
        '"parent": it stays inside its parent\'s box; a rectangle (x, y, width, height): it stays inside it, in the coordinates of its position (requires the subflows feature)',
} as const;

/** A node's or an edge's place in its layer's stacking order. */
export const zIndexSchema = {
    type: "integer",
    description:
        "its place in the stacking order of its layer (nodes among nodes, edges among edges): a greater one is drawn above; default 0",
} as const;

/** A JSON object: a node's or an edge's data. */
export const dataSchema = {
    type: "object",
    description: "the app's data, a JSON object typed by the node or edge type",
} as const;

/** A node's flags, each optional (an absent flag is its default). */
export const nodeFlagProperties = {
    draggable: {
        type: "boolean",
        description: "it may be moved (`node.move`); default true",
    },
    selectable: {
        type: "boolean",
        description: "it may be selected (`selection.set`); default true",
    },
    connectable: {
        type: "boolean",
        description:
            "edges may start or end at it (`edge.add`, `edge.reconnect`); default true",
    },
    deletable: {
        type: "boolean",
        description:
            "it may be removed (`node.remove`, `selection.remove`); default true",
    },
    hidden: { type: "boolean", description: "it is not shown; default false" },
    focusable: {
        type: "boolean",
        description:
            "it takes DOM focus (with the keyboard feature); default true",
    },
} as const;

/** An edge's flags, each optional (an absent flag is its default). */
export const edgeFlagProperties = {
    selectable: {
        type: "boolean",
        description: "it may be selected (`selection.set`); default true",
    },
    deletable: {
        type: "boolean",
        description:
            "it may be removed (`edge.remove`, `selection.remove`); default true",
    },
    hidden: { type: "boolean", description: "it is not shown; default false" },
    reconnectable: {
        anyOf: [{ type: "boolean" }, { const: "source" }, { const: "target" }],
        description:
            'its ends may be moved to other nodes or handles (`edge.reconnect`): both (true), none (false), or only its "source" or its "target" end; default true',
    },
    focusable: {
        type: "boolean",
        description:
            "it takes DOM focus (with the keyboard feature); default true",
    },
    animated: {
        type: "boolean",
        description:
            "it is drawn animated (the app's CSS animates its data-animated parts); default false",
    },
} as const;

/** An edge's `pathOptions`: the shape of its path, each built-in type reading its own keys. */
export const edgePathOptionsSchema = {
    type: "object",
    description:
        "the shape of its path, over the engine's path options: each built-in type reads its own keys (bezier: curvature; smoothstep: borderRadius, offset, stepPosition, centerX, centerY; step: the same but borderRadius)",
    properties: {
        curvature: {
            type: "number",
            description:
                "bezier: the share of the distance a control point stands out by",
        },
        borderRadius: {
            type: "number",
            minimum: 0,
            description: "smoothstep: the corners' radius, in flow units",
        },
        offset: {
            type: "number",
            description:
                "smoothstep and step: how far an end stands out before turning, in flow units",
        },
        stepPosition: {
            type: "number",
            minimum: 0,
            description:
                "smoothstep and step: where the turn sits between the source (0) and the target (1); above 1 counts as 1",
        },
        centerX: {
            type: "number",
            description:
                "smoothstep and step: the x of a vertical turn, in flow coordinates",
        },
        centerY: {
            type: "number",
            description:
                "smoothstep and step: the y of a horizontal turn, in flow coordinates",
        },
    },
    additionalProperties: false,
} as const;

const selected = {
    type: "boolean",
    description: "it is selected (requires the selection feature)",
} as const;

/** A node, as a document or `node.add` gives it. */
export const nodeSchema = {
    type: "object",
    description: "a node",
    properties: {
        id: {
            type: "string",
            minLength: 1,
            description: "its id; generated when missing",
        },
        type: {
            type: "string",
            minLength: 1,
            description: "its type, from the app's registry",
        },
        position: {
            ...xySchema,
            description:
                "its top-left corner, in flow coordinates (relative to its parent with sub-flows)",
        },
        data: dataSchema,
        width: {
            type: "number",
            minimum: 0,
            description: "its width, when the document gives one",
        },
        height: {
            type: "number",
            minimum: 0,
            description: "its height, when the document gives one",
        },
        zIndex: zIndexSchema,
        ...nodeFlagProperties,
        selected,
        parentId: {
            type: "string",
            minLength: 1,
            description:
                "the node it lives in, its position relative to it (requires the subflows feature)",
        },
        extent: extentSchema,
        expandParent: {
            type: "boolean",
            description:
                "its parent grows to keep it inside (requires the subflows feature)",
        },
    },
    required: ["type", "position", "data"],
    additionalProperties: false,
} as const;

/** An edge, as a document or `edge.add` gives it. */
export const edgeSchema = {
    type: "object",
    description: "an edge between two nodes",
    properties: {
        id: {
            type: "string",
            minLength: 1,
            description: "its id; generated when missing",
        },
        source: {
            type: "string",
            minLength: 1,
            description: "the id of the node it starts at",
        },
        target: {
            type: "string",
            minLength: 1,
            description: "the id of the node it ends at",
        },
        sourceHandle: {
            type: "string",
            minLength: 1,
            description:
                "the source node's handle it starts at; none: the node's default source handle",
        },
        targetHandle: {
            type: "string",
            minLength: 1,
            description:
                "the target node's handle it ends at; none: the node's default target handle",
        },
        type: {
            type: "string",
            minLength: 1,
            description:
                'how it is drawn: "bezier" (the default), "simplebezier", "smoothstep", "step", "straight" or an app type',
        },
        data: dataSchema,
        zIndex: zIndexSchema,
        pathOptions: edgePathOptionsSchema,
        ...edgeFlagProperties,
        selected,
    },
    required: ["source", "target"],
    additionalProperties: false,
} as const;

/** A flow document, version 1. */
export const flowDocumentSchema = {
    type: "object",
    title: "Flow document",
    description: "a flow: its nodes and the edges between them",
    properties: {
        version: { const: 1, description: "the document format's version" },
        nodes: {
            type: "array",
            items: nodeSchema,
            description: "the nodes, in drawing order",
        },
        edges: {
            type: "array",
            items: edgeSchema,
            description: "the edges, in drawing order",
        },
    },
    required: ["version", "nodes", "edges"],
    additionalProperties: false,
} as const;
