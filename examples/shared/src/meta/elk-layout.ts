import type { ExampleMeta } from "../meta-types";

export default {
    title: "ELK layout",
    description:
        "A data pipeline whose nodes have several named inputs and outputs, laid out by ELK (async) with each handle a port on its side: ELK orders the ports to uncross the edges, and the new handle order and the nodes' places land in one batch; switching between the layered and tree algorithms lays it out again, and a request id drops a stale result.",
    level: "layout",
    order: 2,
    features: [
        "elkjs",
        "ports (sourceHandle / targetHandle)",
        "width / height",
        "batch",
        "node.set-data",
        "node.move",
        "fit-view (duration)",
    ],
    docs: "/docs/concepts/model-and-commands#transient-steps-and-batches",
} satisfies ExampleMeta;
