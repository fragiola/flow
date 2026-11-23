// From Splitter (fragiola/splitter, examples/shared/src/meta-types.ts), same author and licence.
// The shape of an example's metadata (src/meta/<id>.ts, shared by every framework). Site-internal:
// examples never import this from their code, only their metadata does. The fields map onto an
// entry of the site export's manifest.json (scripts/manifest.ts).
//
// The gallery groups examples by level (the site export contract's word, and the Epic's): by topic,
// from the first flow through nodes, edges, connections, interaction, layout, data and styling to
// whole apps (Epic #49). `examples.json` lists LEVELS as its `levels`, and each manifest entry's
// `level` is its level's id.

/** The gallery's groups, in the order the sidebar lists them. */
export const LEVELS = [
    "basics",
    "nodes",
    "edges",
    "connections",
    "interaction",
    "layout",
    "data",
    "styling",
    "apps",
] as const;

export type Level = (typeof LEVELS)[number];

export const LEVEL_TITLES: Record<Level, string> = {
    basics: "Basics",
    nodes: "Nodes",
    edges: "Edges",
    connections: "Connections",
    interaction: "Interaction",
    layout: "Layout",
    data: "Data and state",
    styling: "Styling",
    apps: "Apps",
};

export interface ExampleMeta {
    /** the example's name in the sidebar and the page title */
    title: string;
    /** one or two sentences: what it shows */
    description: string;
    /** its group in the gallery */
    level: Level;
    /** position inside its level, ascending */
    order: number;
    /** the APIs and techniques it shows, as short tags */
    features: string[];
    /** the docs page it belongs to, e.g. "/docs/guides/persistence" */
    docs?: string;
    /**
     * How the site sizes its frame. `"fill"` (the default, every flow): the example fills a frame
     * of `height`. `"flow"`: the frame grows with the content, `height` is its floor.
     */
    layout?: ExampleLayout;
    /** the frame height in pixels (default: {@link DEFAULT_HEIGHT} for its level) */
    height?: number;
}

export const LAYOUTS = ["fill", "flow"] as const;

export type ExampleLayout = (typeof LAYOUTS)[number];

/** The frame height of an example that names none: a flow needs room, a layout or an app more. */
export const DEFAULT_HEIGHT: Record<Level, number> = {
    basics: 460,
    nodes: 460,
    edges: 460,
    connections: 460,
    interaction: 460,
    layout: 600,
    data: 460,
    styling: 460,
    apps: 600,
};
