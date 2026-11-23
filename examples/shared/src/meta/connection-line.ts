import type { ExampleMeta } from "../meta-types";

export default {
    title: "Connection line",
    description:
        "A connection line of your own: an elbow drawn by Flow.ConnectionLine's children, coloured by the target's validity. Select several nodes and drag from one of their handles: a line leaves each of them, and the drop connects them all.",
    level: "connections",
    order: 4,
    features: [
        "Flow.ConnectionLine children",
        "data-valid / data-invalid",
        "useFlowStore",
        "connect",
        "batch",
    ],
    docs: "/docs/guides/connection-rules",
} satisfies ExampleMeta;
