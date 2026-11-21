# @fragiola/flow-angular

Composable, unstyled Angular directives for **Flow**, headless node-based editors and diagrams:
`[flowRoot]`, `[flowViewport]`, `[flowNodes]`, `[flowNode]`, `[flowHandle]`, `[flowEdges]`,
`[flowEdge]`, `[flowBackground]`, `[flowControls]`, … on your own elements, over the
framework-free core `@fragiola/flow` (re-exported whole, so an Angular app installs this one
package). The opt-in features are on their own entries (`@fragiola/flow-angular/selection`,
`/drag`, `/connection`, `/reconnection`, `/resize`, `/subflows`, `/keyboard`, `/minimap`). No CSS,
no icons, no text: you style every part, through its `data-flow-part` and state attributes.

Not usable yet: version `0.0.0`, nothing is published.

Documentation: **<https://fragiola.com/flow>** (coming soon). ESM only. Angular 22 or later
(signals, standalone directives, zoneless).
