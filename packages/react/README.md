# @fragiola/flow-react

Composable, unstyled React primitives for **Flow**, headless node-based editors and diagrams:
`Flow.Root`, `Flow.Viewport`, `Flow.Nodes`, `Flow.Node`, `Flow.Handle`, `Flow.Edges`, `Flow.Edge`,
`Flow.Background`, `Flow.Controls`, … over the framework-free core `@fragiola/flow` (re-exported
whole, so a React app installs this one package). The opt-in features are on their own entries
(`@fragiola/flow-react/selection`, `/drag`, `/connection`, `/reconnection`, `/resize`, `/subflows`,
`/keyboard`, `/minimap`). No CSS, no icons, no text: you style every part, through its
`data-flow-part` and state attributes.

Not usable yet: version `0.0.0`, nothing is published.

Documentation: **<https://fragiola.com/flow>** (coming soon). ESM only. React 19.
