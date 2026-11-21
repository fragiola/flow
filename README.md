# Flow

Headless node-based editors and diagrams for the web: nodes, edges, handles and connections on a
pannable, zoomable viewport. It ships behaviour, accessibility and composable primitives, and
**no CSS, no icons and no text**: you style every part. Part of [Fragiola](https://fragiola.com).

Documentation, guides and live examples: **<https://fragiola.com/flow>** (coming soon).

## Packages

| package | what it is | status |
| --- | --- | --- |
| `@fragiola/flow` | the framework-free core: the document, the model and its commands, the features, the engine | in progress |
| `@fragiola/flow-react` | the React primitives and hooks | planned |
| `@fragiola/flow-vue` | the Vue components and composables | planned |
| `@fragiola/flow-svelte` | the Svelte components | planned |
| `@fragiola/flow-angular` | the Angular directives | planned |

Nothing is published yet.

## Development

pnpm 11 and Node 24 or newer: `pnpm install`, then `pnpm check`, `pnpm typecheck`, `pnpm test`,
`pnpm build` and `pnpm check:package`. The project's rules are in [`AGENTS.md`](AGENTS.md).

Licence: MIT.
