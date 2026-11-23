# Flow

A **headless** library for node-based editors and diagrams: nodes, edges, handles and connections
on a pannable, zoomable viewport (workflow builders, pipelines, mind maps, state machines). It ships
behaviour, accessibility and composable primitives. It ships **no CSS, no icons, no class names and
no text**. Styling belongs 100% to the consuming developer; the package never assumes Tailwind,
shadcn or anything else.

Its behaviour reference is xyflow (`../references/xyflow`, MIT): studied, **never copied or
ported** (see [Provenance](#provenance-xyflow)). Its architecture is Fragiola's (the guidelines,
`../guidelines/`), shared with Dockable (`../dockable`), Data Grid (`../data-grid`) and Splitter
(`../splitter`): a framework-free core, a typed model of commands, opt-in features from a registry,
an engine per flow on screen, and one thin adapter per framework.

Each framework has an adapter, so **every piece of logic that isn't rendering lives in the core**.

| package | name | contains | depends on | status |
|---|---|---|---|---|
| `packages/core` | `@fragiola/flow` | the document and its JSON Schemas, the typed model and its commands, the feature registry and the features, the engine that binds a flow to the DOM | DOM only, zero runtime deps | Epic #4: the model (#2) and the engine (#3) |
| `packages/react` | `@fragiola/flow-react` | the `Flow.*` primitives and hooks over the core, the core re-exported, the features' subpaths mirrored | the core (`workspace:*`); peers `react`, `react-dom` `^19` | Epic #8: the adapter (#5) |
| `packages/vue` | `@fragiola/flow-vue` | the same primitives as Vue components, the hooks as composables, the core re-exported, the features' subpaths mirrored | the core (`workspace:*`); peer `vue` `^3.5` | Epic #11: the adapter (#9) |
| `packages/svelte` | `@fragiola/flow-svelte` | the same primitives as Svelte 5 components, the hooks as runes (`.svelte.ts`), the core re-exported, the features' subpaths mirrored | the core (`workspace:*`); peer `svelte` `^5.29.0` | Epic #14: the adapter (#12) |
| `packages/angular` | `@fragiola/flow-angular` | the same primitives as Angular standalone directives on the app's elements, the hooks as injection functions (signals), the core re-exported, the features' subpaths mirrored as ng-packagr secondary entry points | the core (`workspace:*`); peer `@angular/core` `^22.0.0` | Epic #17: the adapter (#15) |
| `apps/playground` | private | the dev app: the examples in place, scenarios, the unstyled fixture Playwright drives, the inspector | the React package | Epic #8 (#6) |
| `examples/shared` | `examples-shared`, private | what every framework's examples share: metadata, the five themes, the embed protocol, the manifest, every Playwright spec | no framework | Epic #8 (#6) |
| `examples/react` | `examples-react`, private | the React examples (the site's gallery and its embed app), vendored Fragiola UI | the React package | Epic #8 (#6) |
| `examples/vue` | `examples-vue`, private | the same examples in Vue (its embed app), the theme copied from `examples/react`, Fragiola UI's pieces ported to Vue | the Vue package | Epic #11 (#10) |
| `examples/svelte` | `examples-svelte`, private | the same examples in Svelte 5 (its embed app), the theme copied from `examples/react`, Fragiola UI's pieces ported to Svelte | the Svelte package | Epic #14 (#13) |
| `examples/angular` | `examples-angular`, private | the same examples in Angular 22 (its embed app), the theme copied from `examples/react`, Fragiola UI's pieces ported to Angular directives | the Angular package | Epic #17 (#16) |
| `site` | private | the fragiola.com/flow site export (`site:export`, `site:dev`, the docs, the landing) and the repository's guard tests (`site/tests/`) | the examples apps (`examples-<framework>`) | Epic #8 (#7) |

Every package stays at `0.0.0`; nothing is published (D15).

## Non-negotiable rules

These are the decisions of Epic #4. A change that breaks one is a decision for the maintainer, not
an implementation detail. Where the Epic's decisions say nothing, the Fragiola guidelines
(`../guidelines/`) apply.

1. **Packages (D1).** `@fragiola/flow` (core), then `@fragiola/flow-react`, `-vue`, `-svelte`,
   `-angular` in later Epics, all at `0.0.0`. Each adapter re-exports the core (`export *`) and
   depends on it with `workspace:*`. Repo `fragiola/flow`, fragiola.com slug `/flow`, title
   "Flow", dev port **5185**.
2. **Feature registry from the first feature (D2)** (guidelines `architecture/features.md`; where
   data-grid and tree drift, `decisions.md#feature-registry`, follow data-grid). The **core**
   holds the document, nodes, edges, handles, the viewport (pan and zoom), measurement, edge paths,
   `fit-view`, and the data Background and Controls need. Each **feature** is a factory on its own
   subpath `@fragiola/flow/<subpath>`:
   - `selection()` `/selection`: click, multi-select, box select, the `selection.*` commands;
   - `drag()` `/drag`: node dragging, snap to grid, multi-node drag, extent;
   - `connection()` `/connection`: drag from a handle, the connection line, validity;
   - `reconnection()` `/reconnection`: requires `connection`;
   - `resize()` `/resize`: NodeResizer gestures, min/max, aspect ratio;
   - `subflows()` `/subflows`: `parentId`, relative positions, `extent: "parent"`, expand parent;
   - `keyboard()` `/keyboard`: focus traversal, arrow moves, Delete, Escape;
   - `minimap()` `/minimap`: minimap geometry, pan and zoom from the minimap.

   A bundle guard (`scripts/check-features.ts`, in `pnpm build`) fails when the main entry imports
   a feature.
3. **Document (D3).** `{ version: 1, nodes: FlowNode[], edges: FlowEdge[] }`, JSON-shaped, frozen,
   validated by its JSON Schema (`FlowValidationError` with `issues`; `validateFlow(json)`);
   `model.get("flow-json")` round-trips. Ids are explicit, generated with an injectable `createId`
   when missing (no global `crypto`).
   - A node: `id`, `type` (narrowed by the `Types` registry), `position {x, y}`, `data`, optional
     `width`/`height`, `zIndex` (#24), flags (`draggable`, `selectable`, `connectable`,
     `deletable`, `hidden`), `parentId`/`extent` only with `subflows()` (`extent`: `"parent"` or,
     #24, a flow `Rect` `{ x, y, width, height }`).
   - An edge: `id`, `source`, `target`, `sourceHandle?`, `targetHandle?`, `type` (`bezier` |
     `simplebezier` (#27) | `smoothstep` | `step` | `straight` | an app type), `data`, `zIndex` (#24), flags.
   - A field of a feature that is not installed is a validation issue.
4. **The viewport is view state (D4).** `{ x, y, zoom }` lives in the engine
   (`engine.get("viewport")`; engine actions `set-viewport`, `pan-by`, `zoom-in`, `zoom-out`,
   `zoom-to`, `fit-view`, `center-on`), never in the document. The engine writes the viewport
   transform to its element directly: the framework never reconciles it. Adapters expose a
   controlled `viewport` and an uncontrolled `defaultViewport`.
5. **Glossary (D5).** node, edge, handle (a node's connection point, `source` or `target`),
   connection (an edge being drawn), viewport; nodes and edges are **selected**; a node has a
   **parent** (sub-flows). The concepts docs use these words, and only these.
6. **Commands (D6)**, `<entity>.<verb>`, payload ids `<entity>Id`: `node.add`, `node.remove`,
   `node.move`, `node.resize`, `node.set-data`, `node.set-flags`, `node.set-parent`, `edge.add`,
   `edge.remove`, `edge.reconnect`, `edge.set-data`, `edge.set-flags`, `selection.set`,
   `selection.clear`, `selection.remove`, `batch` (#24 added `node.set-z-index`,
   `edge.set-z-index`). Removing a node removes its edges (and, with
   `subflows()`, its children) in one step. The catalogue is made with `defineCommand` and JSON
   Schemas, like Dockable's; `model.get("commands")` lists it;
   `packages/core/scripts/generate-command-docs.ts --check` runs in `pnpm check`
   (`check:commands`) and writes `site/docs/api/commands.mdx` (it may create the folder).
7. **Connection rules are middleware (D7).** No `isValidConnection` callback: validity is
   `model.can("edge.add", …)` during the drag, so a middleware veto marks the target invalid
   (`data-invalid`) and refuses the drop. The same for reconnection.
8. **Handles are registered by the view (D8).** The Handle primitive registers
   `{ nodeId, handleId, type, side }` with the engine (`engine.adapter`); the engine measures handle
   centres relative to their node. `edge.add` checks node ids in the model, and handle ids against
   the engine's registry only through the engine path. Handle sides are
   `top | right | bottom | left`: diagram geometry (x right, y down) that RTL does not flip, an
   exception to "sides are logical" (proposed to the guidelines).
9. **Rendering split (D9).** Nodes are framework DOM positioned from model state (a structural
   `transform`). Edges are SVG paths whose `d` comes from engine keys (`edge-path-by { edgeId }`,
   returning the path, the label point and the end points), recomputed when nodes move or are
   measured. The engine measures nodes with the root's `defaultView.ResizeObserver`. During a
   drag, node moves are `transient` commands; the final one is not.
10. **Pointer Events (D10)** for every gesture (pan, drag, box select, connect, reconnect, resize,
    minimap), with pointer capture; wheel zoom and pinch; one path for mouse, touch and pen
    (guidelines `decisions.md#drag-and-drop`).
11. **Part attributes (D11).** `data-flow-part` on every element of every primitive (`root`,
    `viewport`, `nodes`, `node`, `edges`, `edge`, `handle`, `connection-line`, `selection-box`,
    `background`, `controls`, `minimap`, `minimap-node`, `minimap-mask`, `resizer`,
    `resize-handle`, `toolbar`, …) and `data-flow-id` with the entity id; no path attribute (a
    graph is not a tree). State: boolean `data-selected`, `data-dragging`, `data-connecting`,
    `data-valid`/`data-invalid`, and `data-handle-type`, `data-side`. Core helpers give the
    attributes, so every adapter is identical.
12. **No text, no names, no CSS (D12).** Primitives set no `aria-label`. Announcements (a node
    moved, an edge connected) are engine events the app feeds into its own live region (shown in
    an example). No class names in the core.
13. **Five verbs on model and engine (D13):** `run`, `can`, `check`, `get`, `is`, bound,
    `(key, payload, options?)`; guard tests keep the surfaces exact. Everything only an adapter
    calls is under `engine.adapter`. Keys are kebab-case; a command's key contains a dot
    (`node.move`), an engine action's never does (`fit-view`); a `get` key that takes an id ends in
    `-by` (`edge-path-by { edgeId }`).
14. **Core guard (D14).** `packages/core/tests/guard.test.ts`: no framework import, zero runtime
    deps, no global `document`/`window`/`requestAnimationFrame`/`ResizeObserver`/`crypto`, no
    `any` in exported declarations, no CSS, and no ported-code headers (nothing is ported).
15. **No release yet (D15).** No Changesets, no `release.yml`, no `.changeset/`, no npm trust, no
    publish; packages stay at `0.0.0`. `pnpm check:package` runs in CI as a packaging check only.
    Adding release is a separate Epic, after the maintainer validates the library.
16. **Toolchain (D16)**, pinned to the newest sibling (`../splitter`): pnpm 11.23.0, Node ≥ 24,
    TypeScript 7.0.2, tsdown 0.23.0, Vitest 5.0.2, Biome 2.5.14, Playwright 1.63.0. Pin dependencies
    to exact versions published at least 7 days ago (`npm view <pkg> time`). Exception: the Svelte
    package (and its smoke app) pins TypeScript 6.0.3, since `svelte-check` and `svelte-package`
    take TypeScript 5 or 6 only (as Vue's `vue-tsc`); so does the Angular package (and its smoke
    app), since `ngc` and ng-packagr take `typescript >=6.0 <6.1`. The workspace packages
    resolve to their sources through the `@fragiola/source` export condition
    (`scripts/source-condition.ts`, the tsconfig `customConditions`); the published `exports` are
    `publishConfig.exports`, dist-only. **No runtime dependency** in the core.

App policy stays in the app: undo/redo, persistence and translations are never in a package; the
examples show them as copyable code.

## Commands

| command | does |
|---|---|
| `pnpm install` | install dependencies |
| `pnpm check` | Biome lint + format + assist (non-mutating), then `check:layout` and `check:commands` |
| `pnpm check:commands` | builds the core, then `packages/core/scripts/generate-command-docs.ts --check`: fails when `site/docs/api/commands.mdx` drifts from the command registry (tested by `site/tests/command-docs.test.ts`). Regenerate with `pnpm --filter @fragiola/flow generate:commands` |
| `pnpm check:layout` | the source layout check (`scripts/check-layout.ts`, from Dockable): every tracked name kebab-case, a package's `src/` root holds only its entries |
| `pnpm check:fix` | Biome check with auto-fix |
| `pnpm format`, `pnpm lint` | Biome format (writes), Biome lint |
| `pnpm typecheck` | `pnpm -r typecheck` (TypeScript 7, no emit; `packages/svelte`: `svelte-check --fail-on-warnings` on TypeScript 6; `packages/angular` and `examples/angular`: `ngc -p tsconfig.json`, strict templates, on TypeScript 6.0) |
| `pnpm test` | Vitest: `core` (node; a test that needs a DOM opts into jsdom), `react`, `vue`, `svelte` and `angular` (jsdom; a server render opts into node; Angular's through `@analogjs/vite-plugin-angular` and a zoneless TestBed) and `site` (the repository's guard tests) |
| `pnpm build` | `pnpm -r build` (tsdown for the core, React and Vue: each one's main entry and one entry per feature; `svelte-package` for Svelte: `dist/` file for file; ng-packagr for Angular: `dist/fesm2022` and `dist/types`, one bundle per entry, then its `scripts/check-dist.ts`), then the `.d.ts` check (`scripts/check-dts.ts`: no `any`) and the features' bundle guard (`scripts/check-features.ts`: no main entry, nor a chunk it imports, built from a feature's folder, read from the source maps, or for the unbundled Svelte build from the file's own path; a package's main entry is its published `exports["."]` target, Angular's FESM bundle; tested with a planted import by `site/tests/check-features.test.ts`) |
| `pnpm check:package` | builds the packages, packs them with pnpm, checks the packed `exports` are the repo's without the source condition (only `types`/`import`/`svelte`/`default`, targets in `dist`), runs `publint --strict` and `attw --profile esm-only` on the tarballs (Svelte: one exception, see [The Svelte adapter](#the-svelte-adapter-issue-12)); for each adapter of `ADAPTERS` (React, Vue, Svelte, Angular) checks its exact core pin and runs its smoke app: a scratch app outside the workspace that installs the adapter's tarball only, typechecks (strict, no `skipLibCheck`), builds and loads its dev server: Vite + React at the pins of `examples/react`; Vite + a Vue single-file component checked by `vue-tsc` on TypeScript 6, at the pins of `examples/vue`; Vite + a Svelte 5 component checked by `svelte-check` on TypeScript 6, at the pins of `examples/svelte`; Vite + Analog (`@analogjs/vite-plugin-angular`) with a standalone component checked by `ngc` (strict templates) on TypeScript 6.0, at the pins of `examples/angular` (`smokeVersion`: the examples app's pin, else the package's, for an adapter whose examples app comes in a later Issue: none today) (`scripts/check-package.ts`) |
| `pnpm dev` | the playground (`apps/playground`, port 5197; `PLAYGROUND_PORT` moves it) |
| `pnpm e2e` | Playwright: the playground's suite (Chromium and Firefox, its dev server, the sources), then each examples app's (`examples/*/playwright.config.ts`: the shared specs against a production build of its embed, built against the packages' `dist`: run `pnpm build` first) |
| `pnpm --filter examples-react dev` | the React embed alone, port 5185 (`PORT` moves it; `?id=<id>&theme=<name>`) |
| `pnpm --filter examples-vue dev` | the Vue embed alone, port 5186 (`PORT` moves it; `?id=<id>&theme=<name>`) |
| `pnpm --filter examples-svelte dev` | the Svelte embed alone, port 5187 (`PORT` moves it; `?id=<id>&theme=<name>`) |
| `pnpm --filter examples-angular dev` | the Angular embed alone, port 5188 (`PORT` moves it; `?id=<id>&theme=<name>`) |
| `pnpm --filter examples-react vendor` | vendors Fragiola UI (`scripts/vendor-fragiola.ts`; `FRAGIOLA_REGISTRY` points it elsewhere) |
| `pnpm site:export --base /flow --out <dir>` | the site export (contract v1.7): builds the packages and each framework's embed, writes the pages, `examples.json`, `project.json` and the manifests, then validates the output and exits non-zero on any violation ([The site export](#the-site-export-issue-7)) |
| `pnpm perf` | the large-flow frame times (Epic #61, `scripts/perf.ts`, not in CI): `--framework react` (the default) or `vue` (#51); builds the core, that framework's package and its embed (into a temporary directory), serves it (`examples/shared/e2e/serve.ts`, its own process group, stopped on exit) and drives `stress-test` in Chromium with Playwright: per size, the open time and the nodes mounted meanwhile, then a pan, a zoom out and back and a node drag of 120 steps at 60 Hz; prints median / p95 / max frame times per size and gesture, the median of the runs. `--sizes 1000,10000,20000`, `--runs 3`, `--steps 120`, `--no-build` (the packages' last `dist`), `--dist <dir>` (an embed built before with `EMBED_BASE=/`), `--profile <dir>` (CPU profiles of each size's first open and gestures), `--json <file>`, `--headed`, `--verbose`. About a minute for the defaults |
| `pnpm site:dev --base /flow --port 5185` | every framework's embed with hot reload behind one port (`site/dev-proxy.ts`), for `www`'s dev mode |

There is no `changeset` or `release:version` script (D15).

## CI

`.github/workflows/ci.yml` (its comment header describes every job) runs on pull requests, on a
manual run (`workflow_dispatch`) and on a push to `main`; **a push to `main` runs no tests, only the
www trigger**: main is what its pull request tested (guidelines `repository.md#ci`). Every other job
is `if: github.event_name != 'push'` or needs one that is (`site/tests/ci-workflow.test.ts`). Its
jobs:

- **Checks**: `pnpm check`, `typecheck`, `test`, `build`.
- **Package**: `pnpm check:package`.
- **Changes**: picks the E2E suites a pull request can affect (`scripts/e2e-suites.ts`, a
  `git diff` against the merge commit's first parent, tested by `site/tests/e2e-suites.test.ts`):
  none for docs only (`site/docs/**`, `*.md`, `AGENTS.md`); `packages/react/**` or
  `examples/react/**`: the playground and examples react; `packages/<framework>/**` or
  `examples/<framework>/**` (vue, svelte, angular): examples `<framework>`; any other path, and a
  manual run: every suite. **It is an allow-list of what may skip**: a new rule names what it
  skips, never what it runs; an unknown path runs everything.
- **E2E (playground)**: when `Changes` says so, `pnpm --filter playground run e2e` (Chromium and
  Firefox, the dev server: nothing built).
- **E2E (examples \<framework\>, \<shard\>)**: a matrix over `Changes`' `examples` output, two shards each, (every
  `examples/<framework>` with a `playwright.config.ts`: Angular, React, Svelte and Vue): builds the packages, then
  `pnpm --filter examples-<framework> run e2e`.
- **Site export**: `pnpm site:export --base /flow --out "$RUNNER_TEMP/site-export"`, self-validated
  the way www's deploy runs it.
- **Trigger www build**: on a push to `main` only, a `repository_dispatch` of type
  `project-updated` (`client_payload` `slug: flow`, `sha`) to `fragiola/www`, with the
  `WWW_DISPATCH_TOKEN` secret (a fine-grained token with Contents: read & write on
  `fragiola/www`); without the secret the step is skipped, not failed. The secret is the
  maintainer's to add.

No Changesets job and no release workflow (D15); `site/tests/ci-workflow.test.ts` checks the
triggers, the push rule, the two site jobs and that neither exists.

Every job that runs Playwright runs in `mcr.microsoft.com/playwright:v1.63.0-noble`
(`container.options: --user 1001`), its tag the exact `@playwright/test` the apps pin (1.63.0 in
the playground, `examples/shared` and `examples/react`), and **never runs `playwright install`**;
`site/tests/ci-workflow.test.ts` ties the tag to the version, so upgrading Playwright changes both
in one PR. `main` has no required checks: a skipped job blocks nothing.

**Shards: two per examples app.** Shard a suite when its test step alone passes about 3 minutes.
On Epic #49's pull request (#62) the React examples' Playwright step took 3 min 53 s at CI's 2
workers (460 tests: 220 smoke runs, 44 examples × 5 themes), so the `E2E (examples <framework>)`
matrix runs every framework in two shards (`shard: ["1/2", "2/2"]`, `--shard`): the ports bring
Vue's, Svelte's and Angular's suites to React's size. Each shard builds its own embed. The
playground's suite (214 tests, ~3 min 26 s for the whole job) stays in one. Measured locally
after #48 (4 workers): the playground in ~59 s; React's examples in ~120 s; Vue's, Svelte's and
Angular's 328 each, 226 run and the 102 `PENDING` ones skipped, in ~27 to ~37 s. After #51 (Epic
#52), Vue's 462, every one run (none `PENDING`), in ~56 s; React's 462 in ~2 min.

Pushing a change under `.github/workflows/` needs a token with the `workflow` scope, or a push
over SSH (use SSH).

## The model (Issue #2)

`createFlowModel<Types, typeof features>(json, { features, createId, freeze })` loads a version 1
document (validated: `FlowValidationError` with `issues`; `validateFlow(json, { features })` returns
them), holds it frozen, and exposes exactly `run`, `can`, `check`, `get`, `is`, `use`, `subscribe`,
`dispatch` (bound; `tests/model/create-flow-model.test.ts` and `tests/types/model.ts` keep the
surface exact). The source layout of the core:

| folder | holds |
| --- | --- |
| `src/schema/` | the JSON Schema subset, its validator and `FromSchema` (from Dockable) |
| `src/document/` | the document's types, its JSON Schema, flags' defaults, `createId`, loading, `validateFlow`, `FlowValidationError` |
| `src/state/` | the draft (copy on write, untouched nodes shared), the `get`/`is` key registry (`queries.ts`) and the core's keys |
| `src/commands/` | `defineCommand`, the core catalogue, one file per entity (`node.ts`, `edge.ts`, `batch.ts`), the shared rules |
| `src/model/` | `createFlowModel` and its bus |
| `src/features/` | `FEATURE_KEYS` (what each feature owns, by name), the registry (`composeFeatures`, `featuresOf`, `featureEngine`), the feature contract, the keyboard links (`keyboard-links.ts`, #27: what `connection()` and `resize()` offer `keyboard()` through `host.shared`) |
| `src/<feature>/` | one folder per feature: its factory, its commands, its entry `index.ts` |

**Commands** (`model.get("commands")`, every description and schema; reference:
`site/docs/api/commands.mdx`):

| command | feature | does |
| --- | --- | --- |
| `node.add` | core | adds a node (id generated when missing); a taken id is refused |
| `node.remove` | core | removes a node, its edges and (subflows) its children, in one step; refused when one is not deletable |
| `node.move` | core | moves a node, kept to its extent; refused when not draggable; transient |
| `node.resize` | core | sets a node's size (and position); transient |
| `node.set-data`, `edge.set-data` | core | shallow-merge a data patch |
| `node.set-flags`, `edge.set-flags` | core | set some flags |
| `node.set-z-index`, `edge.set-z-index` | core | set the `zIndex` in place (`null`: the default, 0; #24) |
| `edge.add` | core | joins two connectable nodes; one edge per pair of handles and direction |
| `edge.remove` | core | removes an edge; refused when not deletable |
| `batch` | core | several commands, all or nothing, one event; transient when each may be |
| `node.set-parent` | `subflows()` | puts a node into a parent (or back), keeping its place on screen; refuses cycles |
| `edge.reconnect` | `reconnection()` | moves an edge's ends; refused when not reconnectable |
| `selection.set` | `selection()` | `replace` (default), `add` or `toggle` nodes and edges; refused when not selectable; transient |
| `selection.clear` | `selection()` | deselects everything |
| `selection.remove` | `selection()` | removes what is selected and deletable (the Delete key) |

Error codes: `unknown_command`, `invalid_payload` (schema, or a field of a feature not installed),
`not_found` (a missing node or edge, or a command of a feature not installed, naming it),
`refused`, `vetoed`, `queued`, `middleware_error`.

**Keys.** `get`: `node-by { id }`, `edge-by { id }`, `all-nodes`, `all-edges`,
`commands-to { nodes?, edges? }` (the commands that bring the document to them: controlled props),
`node-edges-by { nodeId, handleType?, handleId? }`, `connected-edges-by { nodeIds }`,
`incomers-by { nodeId }`, `outgoers-by { nodeId }` (#27: the nodes at the other end of the
edges that end at a node / start from it, in the document's node order, each once),
`absolute-position-by { nodeId }`, `flow-json`, `commands`; #36: `node-connections-by { nodeId,
handleType?, handleId? }` (`node-edges-by` as `NodeConnection`s: `edgeId`, `source`,
`sourceHandle`, `target`, `targetHandle`) and `nodes-data-by { nodeIds }` (`NodeData`: `id`,
`type`, `data`, in the order asked, unknown ids left out), for the hooks; `selected-nodes`, `selected-edges`
(`selection()`); `node-children-by { nodeId }`, `node-parent-by { nodeId }` (`subflows()`). `is`:
`node-draggable`, `node-selectable`, `node-connectable`, `node-deletable`, `node-hidden`
`{ nodeId }`; `edge-selectable`, `edge-deletable`, `edge-hidden`, `edge-reconnectable`
`{ edgeId }`; `node-selected`, `edge-selected` (`selection()`).

**Features** (D2): each factory returns a frozen object with its resolved `options` (read by its
engine side, #3). Model side today: `selection()` (commands, keys, the `selected` field of nodes
and edges), `subflows()` (`node.set-parent`, keys, `parentId` / `extent` / `expandParent`, removal
of children, extent clamping and parent growth with the document's sizes), `reconnection()`
(`edge.reconnect`; requires `connection()`). `drag()`, `resize()`, `connection()`, `keyboard()`,
`minimap()` run the core's commands (`node.move`, `node.resize`, `edge.add`, `selection.remove`)
from their engine sides (see [The engine](#the-engine-issue-3)). A command, key
or document field of a feature that is not installed is a type error and a runtime refusal
(`not_found`, `invalid_payload`, a validation issue), naming the feature.

**The engine side.** `featuresOf(model)` gives the composed features; `featureEngine(composed,
host)` composes their `engine(host)` sides once per engine (keys merged, a key two features add
throws; the hooks walked in install order). `FeatureEngineHost` and `FeatureEngine`
(`src/features/types.ts`) are the contract; the `engineRun`/`engineGet`/`engineIs` lists of
`FEATURE_KEYS` name each feature's engine keys, and `EngineActionKeyOf<F>`, `EngineGetKeyOf<F>`,
`EngineIsKeyOf<F>` type the engine's verbs by the installed features like the model's.

## The engine (Issue #3)

`createFlowEngine<Types, typeof features>(model, options)` is one flow on screen. Its surface is
exactly `run`, `can`, `check`, `get`, `is`, `subscribe`, `destroy` and `adapter`, bound and frozen
(`tests/engine/create-flow-engine.test.ts`, `tests/types/engine.ts`). It never touches the global
`document`/`window`: the root's `ownerDocument`/`defaultView` give the `ResizeObserver` and the
microtask queue. It changes the flow only through `model.run`.

| folder | holds |
| --- | --- |
| `src/geometry/` | the path helpers (`bezierPath`, `simpleBezierPath` (#27), `smoothStepPath`, `stepPath`, `straightPath`, each with its label point, written from the geometry; #35: the step turn's `stepPosition`, `centerX`, `centerY`, bezier's `labelOffset`, `edgeCenter`), rectangles, the viewport's math, `viewportForBounds` (#27: the framing `fit-view` uses, exported); #38: the pure, engine-free geometry the engine and the adapters' first render share: `node-layout.ts` (a node's origin, absolute position and box through `nodeBox`, parameterised by a size lookup: the engine's fixed ?? measured ?? initial, the static fixed ?? initial; the declared handles and `matchHandle`), `edge-geometry.ts` (edge ends and `pathOf`, moved from `src/engine/` with a handle type of its own), `z-order.ts` (`ZIndexMode`, the stack values, the drawing order, `renderLayers`), `static-geometry.ts` (`staticGeometry`). No DOM global and nothing from `src/engine/`: `tests/guard.test.ts` checks it |
| `src/attributes/` | the part attribute names and `partAttributes` (D11) |
| `src/engine/` | `createFlowEngine`, the key registry (`verbs.ts`), the adapter contract (`adapter.ts`), events (`events.ts`), measurement, the press target (`dom.ts`), edge geometry, the background pattern, the toolbar positions (`node-toolbar.ts`, `edge-toolbar.ts`), node moves shared by drag and keyboard, the one structural style writer, the viewport animation (`viewport-animation.ts`), the auto-pan step (`auto-pan.ts`) |
| `src/connect-session/` | the connection under way, shared by `connection()` and `reconnection()` through `host.shared` (no entry; the bundle guard counts it as both features' code) |
| `src/<feature>/<feature>-engine.ts` | each feature's engine side |

**Options** (`FlowEngineOptions`): `root`, `defaultViewport` (`{ x: 0, y: 0, zoom: 1 }`),
`minZoom` 0.5, `maxZoom` 2, `translateExtent` (a flow `Rect`), `panOnDrag` true (`true`: the
primary button, a touch, a pen; or the mouse buttons that pan the pane, `[0]`, `[1]`, `[2]`),
`panActivationKey` `" "` (held, a primary drag pans from anywhere, nodes included, and no other
gesture starts; `null` none), `panOnScroll` false, `panOnScrollMode` `"free"` (`"horizontal"`,
`"vertical"`: the other axis' deltas are ignored), `panOnScrollSpeed` 1, `zoomActivationKey` (Meta
on Apple platforms, Control elsewhere, from the root window's `navigator`; with `panOnScroll`, the
wheel zooms while it is held; `null` none), `zoomOnScroll` true, `zoomOnPinch` true,
`zoomOnDoubleClick` true, `zoomStep` 1.2, `fitView` (true or `fit-view`'s payload: once every
visible node is measured; #38: a node's `initialWidth` / `initialHeight` count as known until it is
measured, and the fit is not redone when the measured sizes differ), `interactive` true, `onlyRenderVisible` false, `pathOptions`
(`curvature` 0.5, `borderRadius` 5, `offset` 20), `autoPan` true (`AutoPanOptions` `{ speed: 10,
margin: 30 }`: pixels a frame at the edge, pixels from the edge it starts at), `easing` (a cubic
ease in and out; `ViewportEasing`), `nodeOrigin` `{ x: 0, y: 0 }` (#24: the point of a node's box
its position stands at, as shares of its size, for the nodes on the flow), `nodeExtent` (#24: a
flow `Rect` every node's box stays inside when dragged, moved by the arrows or resized),
`elevateNodesOnSelect` true, `elevateEdgesOnSelect` false (#24; #38: true by default in `zIndexMode`
`"auto"`, an explicit value honoured), `zIndexMode` `"auto"` (#38: `"basic"` today's order, every
edge below every node; `"auto"` an edge at least as high as its ends' stack values (without their
selection raise) when one of them has a parent, plus the raise when selected; `"manual"` only the
`zIndex` values), and #32's `paneClickDistance` 3,
`nodeClickDistance` 3 (the tap distances on the pane and on anything else), `preventScrolling` true
(the wheel over the flow never scrolls the page), `nodesFocusable` true, `edgesFocusable` true, and
`autoPan`'s per-gesture switches (`{ node, connect, selection, resize }`). `adapter.setOptions`
takes each of them (the four adapters' roots take the new ones in #25 and #33).

**Actions** (`engine.run`; `can`/`check` are their dry runs): `set-viewport { x?, y?, zoom? }`,
`pan-by { x, y }` (pixels), `zoom-in` / `zoom-out { step?, around? }` (refused at the limit: a
Controls button's disabled state is `!engine.can("zoom-in")`), `zoom-to { zoom, around? }`,
`fit-view { padding? 0.1, nodeIds?, minZoom?, maxZoom? }` (refused before a size is known;
#35: `padding` a share, `"<n>px"` or `{ top?, right?, bottom?, left? }` of them, a plain number
unchanged; `includeHidden` fits hidden nodes of known size too),
`center-on { x, y, zoom? }`, `focus-node { nodeId }`, `set-interactive { interactive?, drag?,
connect?, select?, reconnect? }` (gestures and keys stop changing the flow, all of them or one
kind, pan and zoom stay; #32: the per-kind switches, its result every switch; #33: the Controls'
toggle switches `drag`, `connect` and `select`),
`cancel-gesture`
(also stops a viewport animation; refused when neither is under way). `set-viewport`, `zoom-in`,
`zoom-out`, `zoom-to`, `fit-view` and `center-on` take `duration` (ms, default 0: at once; a
negative or non-number one is `invalid_payload` at `/duration`): the result is the final viewport
(zoom limits and extent kept), reached frame by frame on the root window's
`requestAnimationFrame` with a `viewport-change { gesture: false }` per frame; another viewport
action (`pan-by` and `focus-node`'s reveal included), a gesture's viewport change (pan, wheel,
pinch, minimap, auto-pan), a pan press, `cancel-gesture`, `detachRoot` and `destroy` stop it where
it is (the pending frame cancelled).
`around` and the selection box are **root-relative** pixels; `screen-to-flow` / `flow-to-screen`
take and give **client** points (a pointer's `clientX`/`clientY`, a drop's).

**Reads** (`engine.get`): `viewport`, `root-size`, `edge-path-by { edgeId }` (`{ path, label,
source, sourceSide, target, targetSide }`, undefined until both nodes have a size; an app type gets
the bezier), `node-rect-by { nodeId }` (absolute, size 0 until known), `nodes-bounds { nodeIds? }`,
`screen-to-flow`, `flow-to-screen`, `visible-nodes` (in view, plus the unmeasured; #59: with
`onlyRenderVisible`, none before the root has a size, `visible-edges` and `drawn-edges` neither),
`visible-edges`, `drawn-edges` (#59: these three keep their frozen array while their content is
unchanged; a node rect and an edge path are frozen, the same object until they change) (#24: the edges to draw in drawing order, shown and with measured
nodes, in view with `onlyRenderVisible`, by z-order; #38: by the `zIndexMode`'s edge value, document
order among equals), `node-z-index-by { nodeId }` (#24: the node's structural `z-index`; #38: its
rank, negative, while there are several render levels), `render-layers` (#38: `RenderLayer[]`
`{ level, zIndex, nodeIds, edgeIds }`, see below), `handles-by { nodeId }`, `background-pattern { variant?, gap?, size?, offset? }`
(one SVG pattern tile on the screen: dots, lines, cross), `node-toolbar-by { nodeId | nodeIds, side?,
align?, offset? }` (a root-relative anchor outside the zoom; #27: `nodeIds` stands beside their
bounds), `edge-toolbar-by { edgeId, position?: "label" | "source" | "target", offset?: XY }` (#27:
the edge's point on the screen, the toolbar's centre there, undefined until it is drawn; #35:
`point?: XY` a flow point over `position`, `alignX` / `alignY` start/center/end set the anchors),
`intersecting-nodes { nodeId } | { rect }, partial?` (#27: the shown nodes of known size sharing
area with it, `partial: false` wholly inside, the node itself left out), `viewport-for-bounds
{ bounds, padding?, minZoom?, maxZoom? }` (#27: what `fit-view` would set, undefined without a root
size; #35: `fit-view`'s padding forms); features: `selection-box` (selection), `selection-rect` (selection, #35: the flow `Rect`
of the selected nodes while two or more were selected by a box, until the selection changes
otherwise, or whenever two or more are selected with `selection({ rect: "always" })`; null
otherwise and while a box is drawn),
`internal-node-by { nodeId }` (#36: an `InternalNode`, `id`, `node`, `absolutePosition`, `rect`,
`measured`, `zIndex`, `handles`; undefined for an unknown node),
`dragging-node-ids` (drag), `connection` (connection: `from`, `fromPoint`, `toPoint`, `toSide`,
`to`, `status` valid/invalid/null, `path`, `reconnecting`), `minimap-view { width, height }`
(minimap: `viewBox`, `viewBoxAttribute`, `scale`, `nodes`, `view`, `maskPath` for
`fill-rule="evenodd"`), `minimap-point-to-flow { client }` (#35: a client point on the minimap
under it, else the first, as a flow point; undefined without a sized minimap). `edge-path-by`
merges the edge's `pathOptions` over the engine's (#35). **Questions** (`engine.is`): `interactive`, `interactive-by { kind }` (#32), `ready` (#32),
`panning`, `node-measured`;
`box-selecting`; `dragging`, `node-dragging`; `resizing`, `node-resizing`; `connecting`;
`edge-reconnecting`; `node-focusable`, `edge-focusable` (keyboard: the adapter sets `tabindex="0"`).

**Events** (`engine.subscribe`, D12, for the app's live region or a controlled viewport):
`viewport-change { viewport, gesture }`, `drag-start`, `nodes-move { nodeIds, source: "pointer" |
"keyboard" }`, `drag-cancel`, `connect-start { nodeId, handleId, handleType, input }`,
`connect-target { nodeId, handleId, handleType, index, count }` (#27, keyboard only),
`connect { edgeId, source, target, input }`, `connect-cancel { refused, input, dropped, from, to, client,
point }` (#27: `input` is a `MoveSource`, `"pointer"` or `"keyboard"`; #32: where it ended, a
`ConnectionDrop`), `reconnect-start`, `reconnect`, `reconnect-cancel { edgeId, end, refused, dropped, from,
to, client, point }`, `resize { nodeId, width, height, source }` (#27: `source`), `box-select`,
`remove { nodeIds, edgeIds }`; #32: `viewport-change-start` / `viewport-change-end { viewport,
gesture }`, `ready`, `node-click` / `edge-click` / `pane-click`, the `*-double-click` and
`*-context-menu` variants and `selection-context-menu` (`{ nodeId | edgeId | nodeIds, edgeIds,
point, client, event }`, a `FlowPointerInfo`), `box-select-start { client, point }`,
`resize-start { nodeId, width, height }`, `resize-cancel { nodeId }`; #35: `selection-drag-start`,
`selection-drag` (each step), `selection-drag-end { nodeIds, client, point }` (a
`SelectionDragStep`) for a drag of the `nodes-selection` part (instead of `drag-start`; the drop
still tells `nodes-move` first, a cancel `drag-cancel`), and `selection-context-menu` on that part;
#36: `minimap-click { element, point, client, event }` (a `FlowPointerInfo` and the tapped minimap
element: a tap on a minimap, its flow point through that minimap's box; each adapter's `MiniMap`
calls its callback only when `element` is its own; the root captures the pointer, so the DOM's `click` never reaches the minimap), not in
`ENGINE_EVENT_CALLBACKS` (no root callback: each adapter's `MiniMap` tells it).

**The adapter contract** (`engine.adapter`, what `Flow.*` primitives call; an app never does):

- `attachRoot(element)` / `detachRoot()`: the engine listens to the root itself (`pointerdown`,
  `pointermove`, `pointerup`, `pointercancel`, `lostpointercapture`, `wheel` non-passive,
  `dblclick`, `keydown`, `focusin`, `contextmenu`), and to the root's `ownerDocument` (`keydown`,
  `keyup`: the activation keys held) and `defaultView` (`blur`: they are released), captures the
  pointer on the root, and writes its `touch-action: none`. The adapter forwards no event.
- `attachViewport(element | null)`: the engine writes `transform` and `transform-origin` on it; the
  framework never renders a transform there (D4). Nodes render inside it at their absolute
  position: `node-rect-by`'s `x`, `y` as a structural `transform: translate(x, y)` (its
  origin applied, #38: its own `origin` or the engine's `nodeOrigin`: the core is the one source of
  a node's place), `node-z-index-by` as its
  structural `z-index` (#24), flat (a child is not nested in its parent's element), and the
  document's `width`/`height` when given (a resize writes them). Edges are drawn in `drawn-edges`'
  order (#24): an SVG's order is its drawing order; #38: by render level, below.
- `registerNode(nodeId, element | null)` (observed: its `offsetWidth`/`offsetHeight`),
  `registerHandle({ nodeId, handleId?, type, side, connectable?, connectableStart?,
  connectableEnd? }, element | null)` (D8: its centre relative to its node, from the client rects
  divided by the zoom; #32: a handle may only start or only end connections, `data-connectable-start`
  / `data-connectable-end` on its part).
- `attributes(part, payload)`: the record to spread on each part (`data-flow-part`, `data-flow-id`,
  the state booleans as `""`/absent). Every press, key and wheel is resolved from these attributes
  (`dom.ts`), so every part must carry them: `root`, `viewport`, `nodes`, `edges`, `background` are
  the pane; `node`; `handle`; `edge`/`edge-path`/`edge-label`; `reconnect-anchor { edgeId, end }`
  (`data-end`: an edge end's grab area, drawn above the handles); `resize-handle { nodeId,
  position, direction?, variant? }` (`data-position`: `top-left` … `left`, inside the node's
  element; #38: `data-direction`, the handle's own direction, read at the press or the key and
  winning over its resizer's, and `data-variant` `handle` or `line`, `line` on a side only, a
  styling marker; `resizeHandleAttributes` without an engine); `edges-layer { level }` (#38:
  `data-level`, one render level's wrapper, `edgesLayerAttributes` without an engine; a press on it
  is the pane's); `minimap`,
  `minimap-node`, `minimap-mask`; `nodes-selection` (#35, no payload: the rectangle around the
  selection, rendered in the viewport at `selection-rect` as a structural `transform:
  translate(x, y)`, `width`, `height` when non-null; a press drags the selection with `drag()`'s
  own gesture, led by its first draggable node, so threshold, snap, extent and auto-pan are a node
  drag's; `data-dragging` while it drags; a context menu is the selection's; #38: with `keyboard()`
  its record holds `tabindex: "0"` and its keys are a focused selected node's, the arrows moving
  the selection (`step`, `fastStep`, extents, snap off), a delete key removing it, Escape clearing
  it, Enter and Space nothing; the app names it); anything else (`controls`, `toolbar`, `panel`) is left alone
  (a `toolbar`'s record takes `{ nodeId }`, or since #27 `{ edgeId }` for an edge's, as its
  `data-flow-id`, and nothing for several nodes'). With `keyboard()` and `connection()`, a
  connectable `handle`'s record holds `tabindex: "0"`; with `keyboard()` and `resize()`, every
  `resize-handle`'s does (#27): spread it as an attribute.
  Inside a node, fields, buttons, links and `data-flow-no-gesture` start no gesture;
  `data-flow-no-wheel` keeps its wheel; a node holding a `data-flow-drag-handle` element
  (`DRAG_HANDLE_ATTRIBUTE`, #24) drags only from it.
- `setPartOptions("resizer", nodeId, { minWidth, … } | null)`: a resizer's own limits (#35: and
  `direction`).
- `setPartOptions("minimap", "", { inversePan?, zoomStep? } | null)` (#36): a `MiniMap`'s props
  over `minimap()`'s, one set per root (several minimaps share it), set on mount and change, `null`
  on unmount.
- `setOptions(partial)`: root props that change (`minZoom`, `panOnDrag`, `pathOptions`,
  `interactive`, …).
- `subscribe(listener)` / `getSnapshot()`: the view changed (`{ viewport, measured, gesture }`):
  edges, the connection line, the selection box, the minimap, toolbars and state attributes
  re-render from it; node and edge data from `model.subscribe`. Measurements are told once per
  task (the root window's microtask), so a mount re-renders once.
- **The hooks' helpers** (#36, core exports): `watchKeyPress(target, keys, onChange) => stop` (the
  combo matcher every `useKeyPress` uses: `"Shift"`, `"Meta+s"`, a list = any of them, `key` or
  `code` without case, forgotten on the window's `blur` and Meta's release) and
  `sameFlowValue(a, b)` (arrays and plain records compared deep, the rest by identity).
- `settings.onlyRenderVisible`: render `visible-nodes` instead of every node (the edges' list,
  `drawn-edges`, applies it itself: #25's adapters render it and filter nothing).
- `refocus(element)` (#38): an element whose part and id (`data-flow-part`, `data-flow-id`) were
  the last focused in the flow (the engine remembers them from the root's `focusin`, and forgets a
  blurred one) is focused again (`preventScroll`) when focus was lost (the owner document's active
  element is its body or none). Each adapter's `Flow.Edge` calls it on mount: an edge that moves
  to another render level's SVG is remounted (React, Vue, Svelte) or moved (Angular), which drops
  focus.

**Declared geometry (#38).** Node fields, with their schemas (the schema test keeps them equal to
the types): `width` / `height` (fixed, over the measured size, as before), `initialWidth` /
`initialHeight` (>= 0, used until measured), `handles?: DeclaredHandle[]` (`{ id?, type, position,
x, y, width? = 0, height? = 0 }`, the box relative to the node box's top-left corner; its point is
the box's centre, the point the engine measures for a rendered handle; used only until a handle of
that node, type and id is measured: measured handles always win; matched by the engine's
`handleOf` rule), `sourcePosition` / `targetPosition` (the default end's side when no handle gives
one; bottom / top stay the defaults) and `origin` (an `XY` over `nodeOrigin` for that node,
exactly where `nodeOrigin` applies: a child keeps its top-left corner in its parent, a parent's
origin moves its box and so its children). The engine falls back to the same pure helpers until a
node is measured; `node-measured` stays measured or fixed (not initial). `staticGeometry(flow,
options?)` (`{ nodeOrigin, pathOptions, zIndexMode, elevateNodesOnSelect, elevateEdgesOnSelect }`)
returns frozen plain data, `{ nodeRects, nodeZIndexes, edgePaths, drawnEdges, layers }` keyed by
id, as the engine's reads give them before anything is measured.

**The SSR rule (#38, #39).** The server's geometry and the first client render are the same pure
function of the same inputs: while `engine` is null, each adapter computes `staticGeometry(<the
model's document>, <the root's nodeOrigin, pathOptions, zIndexMode, elevate…>)` once per
document/options change, shares it through its context, and its `Edges` / `Edge` / `EdgePath`
draw `layers` and `edgePaths[id]` (with `partAttributes`), its `Node` stands at `nodeRects[id]`
with `nodeZIndexes[id]`. No hydration mismatch, and no jump when the measured geometry equals the
declared one. Edge labels are not in the server HTML (they portal once mounted).

**Render layers (#38, #39).** `render-layers`: with `"basic"`, or no edge value above the lowest
shown node value, ONE level `{ level: 0, zIndex: undefined, nodeIds: all shown, edgeIds:
drawn-edges }` and `node-z-index-by` unchanged: today's DOM. Otherwise the thresholds T are the
sorted distinct edge values above the lowest node value, levels 0..|T|: an edge of value T[j-1] is
level j (others 0), a node's level is how many thresholds are <= its value (an edge at a node's
value stays below it). The structural z-indexes are then ranks in the order level 0 edges, level
0 nodes by value, level 1 edges, …, each rank r of M mapped to r - M (negative), so what the app
renders after the layers (connection line, selection box, `nodes-selection`) stays above. The
rendering decision: **nodes never change wrapper** (a move would remount them in every framework,
losing state, focus, measurement, a gesture under way); `Flow.Edges` with one level is today's
DOM, with several one `edges-layer` wrapper per level (`data-level`, structural position absolute,
top/left 0, 100 %, overflow visible, pointer-events none, `z-index` the level's) holding that
level's `svg` `edges` and its edges' labels; `Flow.Nodes` drops its `isolation: isolate` while
there are several levels, so the node ranks interleave with the edge layers in the viewport's
stacking context. App CSS must not make the nodes or edges layer a stacking context (opacity,
transform, filter, isolation, z-index), or the layering breaks (`concepts/nodes-and-edges.mdx`).

**Large flows (Epic #61, #59): the cached geometry.** `EngineGeometry`
(`src/engine/engine-geometry.ts`) holds what the reads are built from; every read syncs it first
and it recomputes only what changed, so a viewport step costs grid queries and a drag step the
moved nodes and their edges. Its caches and what invalidates each:

| cache | holds | recomputed when |
| --- | --- | --- |
| node entry | the absolute box (`node-rect-by`, `knownRect`), size known, measured (`node-measured`), shown | the node's document entry changes (identity), an ancestor's does (a child stands in its parent: the parent → children map), its measurement changes (`Measurements.takeTouched()`: size or handles), `nodeOrigin` changes (all) |
| edge entry | the ends, drawable (not hidden, its nodes shown and sized), the path (`edge-path-by`, built on first read) | the edge changes, a node at either end is recomputed (the node → edges map); the path alone when `pathOptions` change (compared by value) |
| node grid, edge grid | `SpatialGrid` (`src/geometry/spatial-grid.ts`, cells of 256 flow units, a rectangle over 64 cells or out of reach in a list every query checks, a query wider than the grid scans): shown nodes of known size by box, drawable edges by their ends' box | with their entry |
| `visible-nodes`, `visible-edges` | a grid query (plus the shown nodes of unknown size), in document order | the view rect, or any node (edge) entry, changes |
| `drawn-edges` | `drawingOrder` of the drawable edges (in view with `onlyRenderVisible`) | the edges shown, or the order version, change |
| stack values, layering | `nodeStackValue` / `edgeStackValue` per id; the node part (shown nodes and values), its `nodeLevels` per thresholds, `layersOf` | the order version: a node's `hidden`, `zIndex`, `selected` or `parentId`, a node's size known or not, an edge's drawable, any edge change, an addition or removal, the z options; the node levels only when the thresholds change; the layers when the drawn edges change |
| bounds, readiness | the shown nodes' bounds; counts of shown, unsized and unmeasured nodes (`ready`, the fit on init) | any node entry |

How the sync knows what changed: the node and edge lists by identity; a commit that only replaced
items in place records the list it copied and the ids (`src/state/replaced-items.ts`, a WeakMap,
internal; up to 32 commits back), so a drag step reads one id instead of comparing the list; else
the lists are compared item by item (same length and ids), else rebuilt (an addition, a removal,
a reorder). The model's reads share one reader and query context per commit, and a draft that
replaces a node in place keeps the base's id index (no copy per move). One adapter notification
per gesture step (a pan's first step included: `tests/engine/gesture-notifications.test.ts`).
`tests/engine/geometry-equivalence.test.ts` compares every geometry read with a fresh engine's
through random flows and steps; `engine-geometry.test.ts` covers each invalidation;
`pnpm --filter @fragiola/flow bench` (`vitest.bench.config.ts`, not in `pnpm test`) prints the
large-flow micro-benchmark.

## The React adapter (Issue #5)

`@fragiola/flow-react` renders and wires; every rule is the core's. `export *` of the core (a local
name that shadows a core one fails `tests/index.test.ts`), the `Flow` namespace (`parts.ts`), the
hooks, `createFlowRef` / `useFlowRef`, and one entry per feature mirrored from the core's subpaths
(`/selection`, `/subflows`, `/drag`, `/resize`, `/connection`, `/reconnection`, `/keyboard`,
`/minimap`: each re-exports the core's factory; `/minimap` adds `MiniMap`, `MiniMapNode`,
`MiniMapMask`, `/resize` adds `NodeResizer`, `ResizeHandle`, `RESIZE_POSITIONS`). The main entry
never imports a feature (the bundle guard reads its source maps: `src/<feature>/` is a feature's
code in every package).

| folder | holds |
| --- | --- |
| `src/components/` | one primitive per file |
| `src/hooks/` | the public hooks, `create-flow-ref.ts`, `internal.ts` (`useFlowValue`: a value read from the model and the engine, kept while equal) |
| `src/utils/` | `merge-props.ts`, `use-render.ts` (`render`, refs, `className` / `style` functions, structural style), `shallow-equal.ts`, `engine-facade.ts`, `flow-store.ts` (#60: the one subscription per model and engine every `useFlowValue` reads) |
| `src/<feature>/` | a feature's entry, and its primitives (`minimap/`, `resize/`) |

**Primitives** (`Flow.*`; every element carries `data-flow-part`, entities `data-flow-id`, the
engine's state attributes from `engine.adapter.attributes(part, payload)`):

| primitive | element | does |
| --- | --- | --- |
| `Root` | `div` `root` | owns the model (or takes `model`) and the engine, attaches the root; `position: relative; overflow: hidden` |
| `Viewport` | `div` `viewport` | `attachViewport`: the engine writes its transform, React never does (none before the engine: the identity viewport); `isolation: isolate` (#40: its own stacking context from the server on) |
| `Nodes` | `div` `nodes` | children function per node not hidden (`visible-nodes` with `onlyRenderVisible`), keyed by id; `isolation: isolate` (#25: the nodes' `z-index` stays inside the layer; #39: dropped while `render-layers` has several levels) |
| `Node` | `div` `node` | `registerNode`; `transform: translate(x, y)` from `node-rect-by` (its origin applied), `z-index` from `node-z-index-by` (#25), the document's `width`/`height`; before the engine, #39: the static geometry's `nodeRects` / `nodeZIndexes`; `tabIndex` from `node-focusable` |
| `Handle` | `div` `handle` | `registerHandle({ nodeId, handleId, type, side, connectable })`; centred on its side by default (a style may move it); the engine's record, `tabindex` as `tabIndex` (#28: with `keyboard()` + `connection()`) |
| `Edges` | `div` + `svg` `edges` | children function per edge of `drawn-edges`, in its order (#25: shown, measured, by z-order); the `div` is the HTML layer labels portal into; #39: `render-layers` (the static geometry's `layers` before the engine), one level today's DOM, several an `edges-layer` `div` per level (`data-level`, its `z-index`) with its `svg` and its labels' layer |
| `Edge` | `g` `edge` | default child `EdgePath`; `pointer-events: visibleStroke`; `tabIndex` from `edge-focusable`; #39: `engine.adapter.refocus(element)` on mount |
| `EdgePath` | `path` `edge-path` | `d` from `edge-path-by` (a `d` of your own draws an app type), `fill="none"` |
| `EdgeLabel` | `div` `edge-label` | portal into the edges' HTML layer, centred on the label point |
| `ReconnectAnchor` | `circle` `reconnect-anchor` | an end's grab area (`end`), transparent, `r` 10 |
| `ConnectionLine` | `svg` `connection-line` | while a connection is drawn; default child `path` `connection-path`, or a children function |
| `SelectionBox` | `div` `selection-box` | while a box is drawn, root-relative |
| `NodesSelection` | `div` `nodes-selection` | #36: inside `Viewport` after `Nodes`, at `selection-rect` (null: nothing); structural `position: absolute; top: 0; left: 0; transform: translate(x, y); width; height`; state `{ rect, dragging }`; the engine drags it; #39: its record spread through `attributeProps` (`tabIndex` with `keyboard()`) |
| `Background` | `svg` `background` | `background-pattern`: `pattern` `background-pattern`, `circle`/`path` `background-mark` in `currentColor`, `rect` `background-fill` |
| `Controls` | `div` `controls` | a group for the buttons |
| `ZoomIn`, `ZoomOut`, `FitView` | `button` `zoom-in`, `zoom-out`, `fit-view` | run their action (with their `duration` prop, #25; #36: `FitView`'s `padding`, `nodeIds`, `includeHidden`, `minZoom`, `maxZoom`, only those given); `disabled` / `data-disabled` while `!engine.can(...)` |
| `ToggleInteractive` | `button` `toggle-interactive` | `set-interactive`; #33: switches `drag`, `connect` and `select` (React Flow's interactive button), locked (`aria-pressed`) while none of them is allowed (`interactive-by`); `data-interactive` while unlocked |
| `NodeToolbar` | `div` `toolbar` | portal into the root at `node-toolbar-by` (outside the zoom); `open`, default while its node is selected; #28: `nodeIds` (not empty: beside their bounds, no enclosing node needed, no `data-flow-id`, shown while every one is selected) |
| `EdgeToolbar` | `div` `toolbar` | #28: portal into the root at `edge-toolbar-by` (outside the zoom, its centre on the point); `edgeId` (default the enclosing `Edge`'s), `position` (`"label"` / `"source"` / `"target"`), `offset` (`XY`), `open`, default while its edge is selected; #36: `point` (a flow `XY`), `alignX` / `alignY`; `data-flow-id` its edge's id |
| `MiniMap` (`/minimap`) | `svg` `minimap` | `width` × `height` (200 × 150), `minimap-view`; children default: a `MiniMapNode` per node and the `MiniMapMask`; #36: `inversePan`, `zoomStep` (`setPartOptions("minimap", "", …)`), `onClick(event, point)` (the `minimap-click` event, not the DOM click) |
| `MiniMapNode`, `MiniMapMask` | `rect` `minimap-node`, `path` `minimap-mask` | a node's box; the mask (`fill-rule="evenodd"`) |
| `NodeResizer` (`/resize`) | `div` `resizer` | `setPartOptions("resizer", nodeId, { minWidth, … })` (#36: `direction`); default children: a `ResizeHandle` at each corner and side |
| `ResizeHandle` | `div` `resize-handle` | `data-position`; placed on its corner or along its side; #28: the engine's record (`resize-handle { nodeId, position }`: `tabindex` with `keyboard()` + `resize()`, as `tabIndex`); #39: `direction` (`data-direction`, over the resizer's) and `variant` (`data-variant`, `line` on a side only), both in its state; `resizeHandleAttributes` without an engine |

**Root props:** `model`, or `defaultNodes` / `defaultEdges` (read once) and the controlled `nodes` /
`edges` with `onNodesChange` / `onEdgesChange`; `features` and `createId` (read once: a changed
`features` warns); `viewport` (controlled: `set-viewport`) / `defaultViewport` and
`onViewportChange(viewport, gesture)` (the `viewport-change` event); `fitView` (read once); the
engine options `minZoom`, `maxZoom`, `translateExtent`, `panOnDrag`, `panOnScroll`, `zoomOnScroll`,
`zoomOnPinch`, `zoomOnDoubleClick`, `zoomStep`, `interactive`, `onlyRenderVisible`, `pathOptions`,
and #23's and #24's (#25) `autoPan`, `panActivationKey`, `panOnScrollMode`, `panOnScrollSpeed`,
`zoomActivationKey`, `easing`, `nodeOrigin`, `nodeExtent`, `elevateNodesOnSelect`,
`elevateEdgesOnSelect`, and #33's `paneClickDistance`, `nodeClickDistance`, `preventScrolling`,
`nodesFocusable`, `edgesFocusable` (the core's names and defaults; `panOnDrag` takes mouse
buttons too; a change sends only the keys that changed, `adapter.setOptions`);
`defaultEdgeOptions` (#33, read once: the model option); `flowRef`; and #33's event callbacks
(`RootEventProps`): one `on<Name>` per entry of the core's `ENGINE_EVENT_CALLBACKS` (`onInit`,
`onMoveStart`, `onMoveEnd`, `onNodeClick`, `onNodeDoubleClick`, `onNodeContextMenu`, the edge's
and the pane's, `onSelectionContextMenu`, `onSelectionStart`, `onSelectionEnd`,
`onNodeDragStart`, `onNodesMove`, `onNodeDragCancel`, `onConnectStart`, `onConnectTarget`,
`onConnect`, `onConnectCancel`, `onReconnectStart`, `onReconnect`, `onReconnectCancel`,
`onResizeStart`, `onResizeEnd`, `onResizeCancel`, `onDelete`), each called with the engine
event, the latest prop read, none spread on the element. `Handle` / `useHandle` take
`connectableStart` and `connectableEnd` (#33); `ReconnectAnchor` renders nothing at an end its
edge's `reconnectable` keeps fixed (`model.is("edge-reconnectable", { edgeId, end })`).

**Hooks:** `useFlow<T, F>()` → `{ model, engine }` (the engine a facade: there from the first
render, an action refused before the mount); part hooks `useNode(node)`, `useEdge(edge)`,
`useHandle({ type, side, handleId?, connectable?, nodeId? })` → `{ state, props }`; values
`useViewport()`, `useConnection()`, `useSelection()` (`{ nodes, edges }`), `useNodes()`,
`useEdges()`. `createFlowRef<T, F>()` / `useFlowRef<T, F>()`: `ref.current` is `{ model, engine }`
while the root is mounted.

Selecting hooks (#36, on `useFlowValue`; each re-renders only when its value changes, render-count
tests in `tests/hooks.test.tsx`; the other adapters mirror them):

- `useFlowStore<S, T, F>(selector: ({ model, engine }) => S, equal = Object.is)`.
- `useNodeId(): string | null` (the enclosing `Flow.Node`'s; the parts' own lookup is
  `usePartNodeId` in `context.ts`).
- `useNodesData<T>(id): NodeData<T> | null`, `useNodesData<T>(ids): readonly NodeData<T>[]`
  (`nodes-data-by`, `sameFlowValue`).
- `useNodeConnections({ id?, handleId?, type? } = {}): readonly NodeConnection[]`
  (`node-connections-by` with `handleType: type`; throws outside a node without `id`).
- `useInternalNode<T>(id): InternalNode<T> | undefined` (`internal-node-by`, `sameFlowValue`).
- `useKeyPress(keys, { target? }): boolean` (`watchKeyPress` on `target`, default the root
  element's `ownerDocument.defaultView`; re-listens only when the keys' JSON changes).
- `useOnViewportChange({ onStart?, onChange?, onEnd? })`: `(viewport, gesture)` from the engine's
  three viewport events, the latest callbacks, no re-render.

Decisions of the adapter (#5):

- **The engine is created in the root's layout effect** (the tree's), destroyed in its cleanup: a
  StrictMode double mount creates two and keeps the second (starting at the first one's viewport);
  the first render and a server render have no engine: #39, they draw the static geometry (see
  the SSR rule under the engine).
- **Re-rendering:** `useFlowValue` reads a value again on every change of the model's lists and
  every `adapter.subscribe` notification, and keeps the last object while equal (records by their
  entries, edge paths by value), so a pan re-renders only what shows the viewport (the
  background, the minimap, toolbars, the zoom buttons). #60: through one store per root and an
  `entity` scope for a node's or an edge's own parts, which a viewport step does not read again
  (see the large-flow decisions in React). `Nodes` and `Edges` memo each entity's
  render on the entity and the children function: a drag step re-renders the moved nodes and
  their edges only. A new children function re-renders every node: in a controlled flow, keep it
  stable (`useCallback`, a module function).
- **Controlled `nodes` / `edges` map onto commands through a core key**, `model.get("commands-to",
  { nodes?, edges? })` (`packages/core/src/state/commands-to.ts`): the commands a user would run,
  one `batch` with `meta: { source: "controlled" }` (which `onNodesChange` does not echo). The
  props are the app's document: a flag that stops a user (`draggable`, `deletable`,
  `connectable`) is unlocked for its step and locked again in the same batch; what no command
  expresses (a node's type, a removed data key, a size given back) removes and adds the entity
  again with its id; the drawing order is not synced. A batch a middleware refuses runs step by
  step; whenever the model then differs from the props (a veto, an extent clamp), the change
  callbacks get the model's lists, so the app's state follows the model. Only a list whose
  identity changed is diffed. Alternative: the diff in the adapter (tree's `sync`); refused: every
  adapter would re-implement it.
- **Labels and toolbars are portals**: SVG holds no HTML, so `EdgeLabel` goes to the HTML layer of
  `Edges` (inside the viewport, in flow coordinates); `NodeToolbar` goes to the root (outside the
  zoom).
- **Inner elements carry part names of their own** (`connection-path`, `background-pattern`,
  `background-mark`, `background-fill`; the control buttons' `zoom-in`, …): every element has a
  part (D11), and the engine leaves parts it does not know alone.
- **SVG presentation defaults** are structural: `fill="none"` on paths, `currentColor` for the
  background's marks, a transparent reconnect anchor, so an unstyled flow draws correctly; any
  attribute or style of the consumer overrides them.
- **A handle's place on its side is a default the consumer's style overrides** (`baseStyle` in
  `use-render.ts`), unlike the structural keys that always win (`position`), so an app may put
  several handles on one side.
- **No role and no name**: nodes and edges get `tabIndex` from the engine and no role
  (`aria-roledescription` would be text); the app names them.
- **Every feature subpath is mirrored**, even those with no adapter code (the tree's): a React
  app imports the features from the one package it installs.
- **Known limits:** jsdom lays nothing out, so the adapter tests stub the layout (`tests/flow.tsx`);
  the gestures' real feel is the playground E2E's (#6, Chromium and Firefox, mouse and touch).
- **A resize corner is above its sides** (`zIndex: 1` in its structural place, #6): the side
  handles span their whole side.
- **The viewport and gesture options (#25).** An engine option's sent key tells `null` from
  `undefined` (`panActivationKey={null}` is none, an absent one the default: undefined in
  `setOptions` puts the default back) and keeps a function (`easing`) by identity (JSON drops it);
  an equal new object (`nodeOrigin={{ x: 0.5, y: 0.5 }}` on each render) sends nothing. The node's
  structural `z-index` is `node-z-index-by` (every node gets one, 0 by default, so each node is a
  stacking context, as in xyflow); a render without an engine (the first, the server's) takes the
  place and `z-index` from the static geometry (#39; before it, `absolute-position-by` and no
  `z-index`). The `Nodes` layer is `isolation: isolate` (#25's review, all four
  adapters): without a stacking context of its own, a selected node's 10 000 would paint over
  what follows the layer in the viewport (the connection line drawn from it, the app's overlays);
  a node's z-index orders the nodes only (playground E2E `gestures.spec.ts`, the adapters'
  `options` tests). The core's `nodeZ` answers a node without a parent without walking a chain
  (it is read per node on every pan frame). `ZoomIn`, `ZoomOut`, `FitView` take `duration` (the payload
  has it when given: `can` and `run` get `{ duration }`, or `{}`); #36 adds `FitView`'s other
  payload fields the same way (`givenPayload` in `use-control-button.ts`). The edges' own filter is gone: `Edges`
  renders `drawn-edges`, which applies `onlyRenderVisible` itself. `DRAG_HANDLE_ATTRIBUTE`
  reaches the package through `export *`. Tested through a wrapped engine
  (`tests/options.test.tsx`: `vi.mock` of the core's `createFlowEngine`, its frozen engine and
  adapter inherited by a wrapper that records `setOptions` and `run`).

Decisions of the toolbars and keyboard handles in React (#28, Epic #29; what the four adapters
share is under [Decisions taken during implementation](#decisions-taken-during-implementation)):

- **`attributeProps` (`utils/use-render.ts`) is the one place an engine record becomes props**:
  the core gives DOM names, React takes `tabindex` as `tabIndex` (a number; the lowercase name
  warns in React 19). `useHandle`'s `props` and `ResizeHandle` go through it (tested: no
  `console.error` with `keyboard()`); `Node` and `Edge` keep their `tabIndex` from
  `node-focusable` / `edge-focusable`.
- **`EdgeToolbar` portals from inside the SVG `Edge`**: `createPortal` takes the container's
  namespace, so its `div` is HTML (no layer needed, unlike Vue).

Decisions of #36 in React (the first adapter; Vue, Svelte, Angular follow):

- **`MiniMap`'s `onClick` is the engine's `minimap-click`**: the root captures the pointer, so a
  DOM click never reaches the minimap; the contract test gives it `onDoubleClick` instead.
- **One set of minimap part options per root** (id `""`): every `MiniMap` shares them, the last to
  set them wins, and unmounting one clears them (documented on the limitations page).
- **No `ResizeLine` part**: a side `ResizeHandle` spans its side; `direction` is the resizer's (the
  engine keeps it per node). #39: a `ResizeHandle` takes its own `direction` (over the resizer's)
  and `variant="line"` (a styling marker, side handles only), so React Flow's `NodeResizeControl`
  line variant is a styled `ResizeHandle`.
- **Parity lists while the others catch up**: `AHEAD_IN_REACT` in `site/tests/docs-reference.test.ts`
  and the three adapters' `tests/index.test.ts` leave `NodesSelection` out; each helper empties it.

Decisions of #39 in React (Vue, Svelte, Angular follow):

- **The root shares one static geometry** through its context while `engine` is null (computed again
  only when the model's node or edge list, or the static options' JSON, changed), so the server's output and the first client render
  are the same; `zIndexMode` is a root prop, forwarded to the engine and to `setOptions` like the
  #24/#25/#33 options. `tests/server.test.tsx` (paths in `renderToString`), `tests/layers.test.tsx`
  (one level keeps today's DOM; several: wrappers, labels in their level, the nodes layer without
  isolation; refocus), `tests/options.test.tsx` (the `"auto"` default raises a selected edge;
  `"basic"` keeps the old order).
- **An edge that changes level remounts** (its `EdgeSlot` is under another level's `svg`): its
  focus comes back through `refocus`; a node never moves.

Decisions of large flows in React (Epic #61, #60; the other adapters take them up in their
stress-test port Epics):

- **One store per model and engine** (`utils/flow-store.ts`, a `WeakMap` by engine, or by model
  before it): it subscribes once to the model (a commit counts only when `all-nodes` or
  `all-edges` changed identity, as the old per-reader cache did) and to the engine, and every
  `useFlowValue` reads its version instead of subscribing to both and reading the lists itself.
  It listens to the engine from its creation (the engine's `destroy` drops it), but to the model
  only while it has a reader: an app-owned model outlives its roots, and a listener kept on it
  held every unmounted root's store and destroyed engine (StrictMode: one per mount). Starting
  again, or read with no reader, it compares the lists with the last ones seen and moves its
  versions if they changed (`tests/flow-store.test.tsx`). The engine's `destroy` also empties
  its cached geometry (`EngineGeometry.release`). Alternative: a subscription per reader (as before); refused: at 2 600 mounted nodes each
  notification called ~8 000 snapshots.
- **Two scopes.** `view` (the default): every change. `entity` (`useNode`, `useEdge`,
  `useEdgePath`, `EdgePath`, `EdgeLabel`, `ReconnectAnchor`, `useHandle`, `MiniMapNode`,
  `NodeResizer`, `ResizeHandle`): not told a viewport-only notification, since a node's or an
  edge's own view (place, path, attributes, `z-index`, focusability) does not follow the viewport;
  except while there are several render levels (now or at the last notification: the store reads
  `render-layers` on each one), where `node-z-index-by` follows the drawn edges.
- **A measurement tells only what it changed.** A reader naming its node or edge (`useNode`, the
  edge parts) is told a measured-only notification only when its node's `node-rect-by` or
  `node-measured`, or its edge's `edge-path-by`, changed identity (the engine keeps them the same
  objects until they change, #59); a reader without one hears every measurement. After any other
  change the kept values are dropped, and the next measurement tells those readers again.
  Alternative: the measured ids in `ViewChange`; refused: the adapter contract and its exact
  tests would change, for the same result.
- **A culled flow renders nothing before the engine** (`onlyRenderVisible`, the server render
  and the first client render): `Nodes` renders no node and `Edges` no edge (its static levels
  kept, empty), where they drew every node's static geometry for one render (10 000 mounted and
  torn down: ~700 ms to open). A flow that is not culled keeps its first render; the static
  geometry is still computed (hand-rendered nodes read it). On the limitations page.
- **Render counts are tested** (`tests/render-counts.test.tsx`, with a wrapped engine counting the
  entity reads): a pan and zoom steps re-render and read no node or edge; nodes brought into view
  render alone and their measurement reads the others' boxes and paths only; a step that changes
  the render levels places the nodes again; a drag step re-renders the node and its edge.

For the playground and examples (#6, see [The playground and the examples](#the-playground-and-the-examples-issue-6)): wrap the flow in a sized element (the root fills it); put
`Edges` before `Nodes` inside `Viewport`, and `Background`, `SelectionBox`, `Controls`, `MiniMap`
outside it; give nodes `user-select: none`; style through `[data-flow-part]` and the state
attributes (`data-selected`, `data-dragging`, `data-connecting`, `data-valid` / `data-invalid`,
`data-handle-type`, `data-side`, `data-position`, `data-end`, `data-disabled`).

## The Vue adapter (Issue #9)

`@fragiola/flow-vue` is the React adapter in Vue 3.5: the same 26 primitives (the 21 of `Flow`,
`MiniMap`, `MiniMapNode`, `MiniMapMask` on `/minimap`, `NodeResizer`, `ResizeHandle` on
`/resize`), in files of the same names (`components/<name>.ts`, `minimap/`, `resize/`:
`tests/index.test.ts` compares them with React's), the same elements, part names, state
attributes, structural styles, props and state fields, over the same core keys. `export *` of the
core, the `Flow` namespace (`parts.ts`), the composables, `createFlowRef` / `useFlowRef`,
`typedFlow`, and the eight feature entries mirrored. Components are `defineComponent` + `h()` in
`.ts` (Splitter's and Tree's way), built by tsdown and typechecked by `tsc` (TypeScript 7); only
the smoke app's single-file component needs `vue-tsc` (TypeScript 6).

| folder | holds |
| --- | --- |
| `src/components/` | one primitive per file |
| `src/composables/` | the public composables, `create-flow-ref.ts`, `internal.ts` (`useFlowValue`, `sameValue`) |
| `src/utils/` | `primitive.ts` (`definePrimitive`, `FlowComponent`), `render.ts` (`renderElement`: `as`, the `render` slot, attrs merged under the structural style, `elementRef`, `onClient`), `shallow-equal.ts`, `engine-facade.ts` (React's) |
| `src/<feature>/` | a feature's entry, and its primitives (`minimap/`, `resize/`) |
| `src/` root | `index.ts`, `parts.ts`, `context.ts` (the injection keys), `typed.ts` |

**How React's API maps to Vue:**

| React | Vue |
| --- | --- |
| `render={<section />}` | `as="section"` or `:as="MyComponent"` (the props merged into it) |
| `render={(props, state) => …}` | the `render` scoped slot: `{ props, state, children }` (`v-bind="props"`) |
| children functions (`Nodes`, `Edges`, `ConnectionLine`, `MiniMap`) | the default scoped slot: `v-slot="{ node }"`, `{ edge }`, `{ connection }`, `{ view }` |
| `children` of a part | its default slot, given `{ state }` |
| `className` / `style` functions of the state | `class` / `style` values only (see below); the state through the slots and the `data-*` |
| `ref` | a template ref: the component, its `$el` the element (`EdgeLabel`, `NodeToolbar`, `EdgeToolbar`: their element renders elsewhere, reach it through the `render` slot) |
| `nodes` + `onNodesChange`, `edges` + `onEdgesChange` | `v-model:nodes`, `v-model:edges` (`update:nodes`, `update:edges`) |
| `viewport` + `onViewportChange(viewport, gesture)` | `v-model:viewport` (`update:viewport`, `(viewport, gesture)`) |
| `flowRef={ref}`, `ref.current` | `:flow-ref="flow"`, `flow.value` (reactive, `markRaw`, Tree's) |
| `useNode(node)` → `{ state, props }` | `useNode(nodeOrGetter)` → `{ state, props }` as computed refs (`useEdge`, `useHandle` too) |
| `useViewport()`, `useConnection()`, `useSelection()`, `useNodes()`, `useEdges()` | the same names, computed refs |
| `<Flow.Nodes<Types>>`, `<Flow.Root<Types, typeof features>>` | `const Flow = typedFlow<Types, typeof features>()` (a template takes no type argument) |

Decisions of the Vue adapter (#9):

- **The model's state never becomes reactive.** The root bumps one `shallowRef` counter
  (`revision`) on every model commit and every `adapter.subscribe` notification; each part reads
  the model and the engine in a `computed` (`useFlowValue`) that keeps its last object while equal
  (React's comparison), so Vue re-renders only what changed. The engine and the root element are
  `shallowRef`s; lists given by the app go through `toRaw` (`plainList`), so no proxy reaches the
  model, and the model's frozen lists given back by `update:nodes` are never proxied (Vue skips
  frozen objects).
- **A generic directive from the package is `any`-typed in a template** (ngc's type-check of a
  directive declared as `FlowRootDirective<any, any>`, an app's case and `examples/angular`'s):
  the core's `EdgeTypeOf<any>` is `string`, as `AnyTypes`'s, so an untyped `[defaultEdges]` or
  `[(edges)]` with a custom edge type is taken (#17's review: only the built-in types were;
  `examples/angular/tests/untyped-lists.ts` and the core's `tests/types/model.ts` keep it).
- **Controlled lists reuse `commands-to`**, exactly React's algorithm (one `batch` with `meta:
  { source: "controlled" }`, step by step after a veto, the model's lists reported back when they
  differ from the props), in a `watch` of the two lists' identity; a model the app gives is brought
  to the starting props before the mount (client only). No core key was added.
- **The engine is created in the root's `onMounted`** (children mount first) and destroyed in
  `onUnmounted`, after its parts have let their elements go. A part that attaches to the engine
  (root, viewport, node, handle) reads `engine` in its render, so it patches and its function ref
  (`elementRef`, called on every patch, acting on a change only) registers it. A server render has
  no engine (the React adapter's first render); nothing subscribes on the server (`onClient`).
- **Another `model` remounts the flow** (the root is keyed by its model, Tree's `Root`), instead of
  React's in-place engine swap.
- **Each node's and each edge's slot is its own component** (`NodeSlot`, `EdgeSlot`), whose props
  are the entity and the slot function: a drag step re-renders the moved nodes only, and a pan
  none (the viewport reads its own state only when it is used). What else it shows follows Vue's
  reactivity (a ref, a prop the slot reads). A compiled template's slot keeps its identity; a new
  one (a render function's closure, a slot reading an outer slot's scope: Vue's dynamic slots)
  re-renders every entity, as React does on a new children function (#11's review: the slot read
  through a getter kept such a closure stale).
- **Edge labels render in the edges' HTML layer through a registry, not a `Teleport`**: a Vue
  `Teleport` out of an SVG keeps creating SVG elements (its namespace sticks), so `EdgeLabel`
  hands a render function to `Edges`, whose layer renders it (with the edge provided again);
  `EdgeLabel` itself renders nothing where it is written. `NodeToolbar` (HTML in HTML) is a
  `Teleport` to the root.
- **`class` and `style` take Vue's forms (string, array, object), not functions of the state**:
  Vue normalizes both when it creates a node (a template's `:class` too), so a function never
  reaches the primitive. The state is the `render` slot's and the default slot's, and the `data-*`
  attributes'. The contract tests check that instead of React's functions.
- **Bare boolean attributes are `true`** (`pan-on-scroll`, `fit-view`, `open`, `connectable`,
  `keep-aspect-ratio`, `disabled`), absent ones stay `undefined` so the core's defaults apply
  (Tree's `primitiveProps`); `fitView` takes a boolean or a payload.
- **`typedFlow<T, F>()`** types `Root` (model, lists, features, events), `Nodes`, `Node`, `Edges`,
  `Edge` by the registry; the untyped `Flow.Root` takes any features.
- **The viewport and gesture options (#25)** are React's root props in kebab-case attributes
  (`:auto-pan`, `:pan-on-drag="[1, 2]"`, `pan-activation-key`, `pan-on-scroll-mode`,
  `:pan-on-scroll-speed`, `zoom-activation-key`, `:easing`, `:node-origin`, `:node-extent`,
  `elevate-nodes-on-select`, `elevate-edges-on-select`), sent as React's (`null` is not
  `undefined`, a function by identity: `easing` is watched beside the options' JSON key).
  `panOnDrag` is typed `[Boolean, Array]` and `autoPan` `[Boolean, Object]` (a bare attribute
  `true`, a list or an options object kept; before #25 `panOnDrag` was `Boolean` alone, which
  warned on a list); `elevate-nodes-on-select` / `elevate-edges-on-select` take a bare
  attribute. `ZoomIn`, `ZoomOut`, `FitView` take `duration`, and the root `pan-on-scroll-speed`,
  as `[Number, String]` props whose numeric text is its number (`numberProp`, Angular's
  `optionalNumber`: `duration="300"` works; a text that is no number reaches the engine, which
  refuses it). `plain` is a shallow `toRaw`: a reactive `nodeOrigin`, `nodeExtent` or `autoPan`
  mutated in place (`origin.x = 1`) is not seen, as `pathOptions` / `translateExtent`; give a
  new object.
  The node's `z-index`, the node origin and `drawn-edges` are React's (#25 there).
- **`EdgeToolbar` inside `Flow.Edges` renders from the edges' HTML layer** (#28): written in the
  edge's SVG slot, a `Teleport` would keep the SVG namespace (`button` and `div` created as SVG
  elements), so it registers a render function in the label layer (`EdgeLabelLayerKey`, its
  entry keyed `toolbar-<n>`: the entries' `key` became `number | string`), and that render is a
  `Teleport` to the root from the HTML layer. Outside `Flow.Edges` (with an `edgeId`) it is a
  `Teleport` where it is written. `nodeIds` and `offset` are spread / passed plain (a reactive
  array reaches the engine as a copy).
- **Known limits:** jsdom lays nothing out, so the tests stub the layout (`tests/flow.ts`,
  React's); the gestures' real feel is the Vue examples' shared Playwright specs (#10), which
  needed no adapter fix.

Decisions of #36 in Vue (React's props, part and hooks, mirrored):

- **`MiniMap`'s tap is the `click` emit, `(event, point)`** (`MiniMapEmits`), from the engine's
  `minimap-click`: declared, it is no fallthrough listener on the SVG (the root captures the
  pointer, a DOM click never reaches it); the contract test gives it `onDblclick` instead.
  `inverse-pan` is a bare boolean, `zoom-step` a `[Number, String]` prop (`numberProp`), both into
  `setPartOptions("minimap", "", …)` from a `watchEffect` (cleared with `null`); the subscription
  is a `watchEffect` on the engine too.
- **`FitView`'s framing goes through `givenPayload`** (`use-control-button.ts`, React's helper):
  the button's 4th argument is now a getter of its payload's fields, an absent one left out
  (`ZoomIn` / `ZoomOut` give `{ duration }`); `min-zoom` and `max-zoom` take their text as a number,
  `include-hidden` is a bare boolean, `nodeIds` is spread (a reactive array reaches the engine as a
  copy). `NodeResizer`'s `direction` and `EdgeToolbar`'s `point`, `alignX`, `alignY` are passed as
  React's.
- **`Flow.NodesSelection`** (`components/nodes-selection.ts`) renders nothing while
  `selection-rect` is null; its attributes are a lazy computed, read only while it shows.
- **The composables return refs**: `useFlowStore`, `useNodeId`, `useNodesData`,
  `useNodeConnections`, `useInternalNode` are `ComputedRef`s over `useFlowValue` (with
  `sameFlowValue` where React uses it; the root's `revision` recomputes them on a view change
  too, and an equal value keeps the last object, so nothing renders); `useKeyPress` is a read-only
  `Ref<boolean>`. Their ids and options take a value, a ref or a getter (`MaybeRefOrGetter`);
  `useNodeConnections` throws in `setup` outside a node without an `id`. `useKeyPress` and
  `useOnViewportChange` listen from a `watchEffect` (the root's element and engine exist only
  once it is mounted); `useOnViewportChange` takes a value, a ref or a getter
  (`MaybeRefOrGetter`) and reads its callbacks at each event.
- **The internal `useNodeId(part, getter)` of `context.ts` is `usePartNodeId`** (React's
  rename), leaving the name to the public composable. Tested in `tests/part-options.test.ts` and
  `tests/composables.test.ts` (render counts); no core change was needed.

Decisions of #39 in Vue (React's, see the React section and the engine's SSR rule):

- **The root shares the static geometry** (`components/root.ts`, a computed over the model's
  revision and the static options while there is no engine, kept while the lists and the options'
  key are the same, provided through `context.ts`): before the engine, on the server too, nodes stand at
  its rects and z-indexes and edges draw its paths; `zIndexMode` is a root prop (`z-index-mode` in
  a template). `tests/ssr.test.ts` (`renderToString` holds the paths), `tests/hydration.test.ts`
  (`createSSRApp` over the server's HTML: the same paths and places, no mismatch warning).
- **Levels** (`components/edges.ts`): one level today's DOM; several, an `edges-layer` per level
  with its `svg` and its own HTML layer, where its edges' labels render; `Flow.Nodes` without `isolation` then. An edge that changes level is a new slot
  component (remounted); `Flow.Edge` calls `refocus` on mount. `tests/layers.test.ts`.
- **`ResizeHandle`** takes `direction` and `variant` (in its slot state), as React's.

Decisions of large flows in Vue (#51, Epic #52; React's of Epic #61, see the React section):

- **One store per root** (`utils/flow-store.ts`, on `context.store`): `shallowRef` counters the
  root bumps, read by each `useFlowValue` computed of its scope. `view` (still `revision`):
  every model commit and every engine notification. `entity` (`useNode`, `useEdge`,
  `useEdgePath`, `EdgePath`, `EdgeLabel`, `ReconnectAnchor`, `useHandle`, `MiniMapNode`,
  `NodeResizer`, `ResizeHandle`, React's list): a commit that changed `all-nodes` or `all-edges`,
  a gesture, any notification while there are (or were) several render levels, a measurement
  with a viewport change. A measured-only notification bumps `measure` (an entity reader with no
  node or edge) and only the records whose token (`node-rect-by` + `node-measured`, or
  `edge-path-by`) changed identity; a record is kept while it has readers (acquired by a `watch`
  of the entity's key, released on scope dispose). A commit that keeps both lists bumps `view`
  only (React tells nothing; kept so the existing tests stay as they were). The static geometry
  follows `entity`.
- **A culled flow renders nothing before the engine** (`onlyRenderVisible` on the context):
  `Flow.Nodes` no node and the edges no edge (their levels kept, empty), on the server too; a flow
  that is not culled keeps its first render (`tests/ssr.test.ts`, `hydration.test.ts`).
- **Node registrations wait for the end of the patch** (`useNode`, a `nextTick` batch; an unmount
  cancels a pending one): Vue calls an element's function ref as soon as it is inserted, and the
  engine measures a node when it is registered, so each node mounted in a patch forced a layout
  of its own (~4.2 s of a 10 000-node gestures profile, ~0.2 s after). Handles still register at
  once.
- **The root's box is read once while the nodes layer patches** (`utils/root-box.ts`): the core
  reads the root's `getBoundingClientRect` on each read that needs the view, and Vue renders a
  new node after inserting the one before (React reads before committing), so each read forced a
  layout (~3.8 s of the same profile, ~0.08 s after). The root element gets an own
  `getBoundingClientRect` (removed when it detaches) that, while `Flow.Nodes` patches
  (`onBeforeUpdate` → `holdRootBox`, until the microtask checkpoint), answers the box it read
  first; else it reads. Follow-up: the core should cache the root's box (per task, or behind a
  resize signal), which would drop this shadowing and help the other adapters.
- **Tested** in `tests/render-counts.test.ts` (React's cases: a pan and zoom steps re-render and
  read no node or edge; nodes brought into view render alone and their measurement reads only the
  others' boxes and paths; a step that changes the render levels places the nodes again; a drag
  step re-renders the node and its edge; a culled flow renders none on the server and before the
  engine), `flow-store.test.ts` and `root-box.test.ts`.

## The Svelte adapter (Issue #12)

`@fragiola/flow-svelte` is the React adapter in Svelte 5 (runes mode), the first Svelte adapter of
the ecosystem: the same 25 primitives (the 20 of `Flow`, `MiniMap`, `MiniMapNode`, `MiniMapMask` on
`/minimap`, `NodeResizer`, `ResizeHandle` on `/resize`), in files of React's names
(`components/<name>.svelte`, `minimap/`, `resize/`: `tests/index.test.ts` compares them), the same
elements, part names, state attributes, structural styles, props and state fields, over the same
core keys. `export *` of the core, the `Flow` namespace (`parts.ts`: `export { default as Root }
from "./components/root.svelte"`, re-exported as `export * as Flow`), the runes, `createFlowRef` /
`useFlowRef`, `typedFlow`, and the eight feature entries mirrored. Built by `svelte-package`
(`dist/` mirrors `src/`: `.svelte` files as they are, `.svelte.ts` and `.ts` as `.js`, a `.d.ts`
beside each), checked by `svelte-check` (its `typecheck`), tested with Vitest, jsdom and
`@testing-library/svelte`.

| folder | holds |
| --- | --- |
| `src/components/` | one primitive per file (`.svelte`): its props and state types in `<script module>`, the component's doc in `<!-- @component -->` |
| `src/runes/` | the public runes (`use-*.svelte.ts`), `create-flow-ref.svelte.ts`, `internal.svelte.ts` (`flowValue`, `sameValue`, `MaybeGetter`), `use-control-button.svelte.ts` |
| `src/utils/` | `render.ts` (`elementProps`, `refProps`, the primitive and render-snippet types, styles), `merge-props.ts`, `plain.svelte.ts` (`$state.snapshot` of what the app gives), `portal.svelte` + `portal-content.svelte`, `shallow-equal.ts`, `engine-facade.ts` (React's) |
| `src/<feature>/` | a feature's entry, and its primitives (`minimap/`, `resize/`) |
| `src/` root | `index.ts`, `parts.ts`, `context.ts` (`setContext` / `getContext` with symbol keys, values of getters), `typed.ts` |

**How React's API maps to Svelte:**

| React | Svelte |
| --- | --- |
| `render={<section />}`, `render={(props, state) => …}` | the `render` snippet: `{#snippet render({ props, state, children })}<section {...props}>{@render children()}</section>{/snippet}` (no element form, no `as`) |
| children functions (`Nodes`, `Edges`, `ConnectionLine`, `MiniMap`) | the `children` snippet with the entity: `{#snippet children(node)}`, `(edge)`, `(connection)`, `(view)` |
| `children` of a part | its `children` snippet, given `{ state }` (plain content works too) |
| `className` / `style` functions of the state | `class` (any of Svelte's forms: string, array, object) / `style` (a CSS string or a record) as a value **or** a function of the state, as in React |
| `ref` | `bind:ref` (the element, `undefined` until mounted, `null` after), and the consumer's `{@attach …}` on the primitive, which reach its element (the render snippet's one too) |
| `onClick` … | `onclick` …: composed after the primitive's own |
| `nodes` + `onNodesChange`, `edges` + `onEdgesChange` | `bind:nodes`, `bind:edges` (or `nodes` + `onnodeschange`, `edges` + `onedgeschange`) |
| `viewport` + `onViewportChange(viewport, gesture)` | `bind:viewport` (or `viewport` + `onviewportchange(viewport, gesture)`) |
| `flowRef={ref}`, `ref.current` | `flowRef={flow}`, `flow.current` (a `$state.raw`: a template reading it follows the mount) |
| `useNode(node)` → `{ state, props }` | `useNode(node or () => node)` → `{ state, props }` (getters; spread `{...props}`, it carries the attachment that registers the element; `useEdge`, `useHandle` too) |
| `useViewport()`, `useConnection()`, `useSelection()`, `useNodes()`, `useEdges()` | the same names, `{ current }` (`FlowValue`) |
| `<Flow.Nodes<Types>>`, `<Flow.Root<Types, typeof features>>` | `const Flow = typedFlow<Types, typeof features>()`; `Root`, `Nodes`, `Node`, `Edges`, `Edge` are generic components (`generics="T …"`), inferred from their props |

The Epic's decisions, as settled (S1 to S5):

- **S1, source layout:** `src/` (no `src/lib/`) with `components/` (`.svelte`, React's kebab-case
  file names), `runes/` (`.svelte.ts`: a rune or a `$state` needs the `.svelte` suffix) and
  `utils/` (a `.svelte` helper component may live there: `portal.svelte`); entries `index.ts`,
  `parts.ts`, `context.ts`, `typed.ts`. `check:layout` takes `.svelte` and `.svelte.ts` (the name
  before the first dot is kebab-case; `site/tests/check-layout.test.ts`). Relative imports carry
  their extension (`./context.js`, `./root.svelte`): `svelte-package` does not rewrite them.
- **S2, composition:** collection parts take a snippet called per entity, named `children`
  (`{#snippet children(node)}` inside `<Flow.Nodes>`, React's children function), rendered in a
  keyed `{#each}`; `render` is a snippet prop receiving `{ props, state, children }`: the app
  spreads `props` on its own element and renders `children` inside it.
- **S3, refs and handlers:** `bind:ref` and attachments. Every primitive does its DOM work
  (`registerNode`, `attachRoot`, `attachViewport`, `registerHandle`, the ref) through attachments
  (`createAttachmentKey`) inside its props, so the element its `render` snippet renders gets them
  too; consumer handlers compose after the internal ones (`merge-props.ts`); `class` / `style`
  take a value or a function of the state (Svelte never normalizes a component's props).
- **S4, state:** the model's frozen state is never a deep proxy: the root holds `engine`,
  `rootElement` in `$state.raw` and a `revision` counter bumped on every model commit and every
  `adapter.subscribe` notification; each part reads the model and the engine in a `$derived`
  (`flowValue`) that keeps its last object while equal (React's comparison), so only what changed
  updates. What the app gives (lists, features, engine options) goes through `plain` / `plainList`:
  a frozen value as it is, anything else `$state.snapshot`ted (entries one by one, the frozen ones
  shared).
- **S5, smoke app:** `check:package`'s Svelte entry: a scratch Vite + Svelte 5 app outside the
  workspace that installs the tarball only, runs `svelte-check --fail-on-warnings` (strict, no
  `skipLibCheck`), builds and loads its dev server (its component: `typedFlow`, `bind:nodes`, a
  flow ref, snippets per node and edge, a `class` function, a `render` snippet, the minimap and
  resizer entries).

Decisions of the Svelte adapter (#12):

- **TypeScript 6.0.3 for the Svelte package and its smoke app.** `svelte-check` 4.7.8 and
  `@sveltejs/package` 3.0.2 peer on TypeScript `^5 || ^6` / `^6`: the package's `typecheck` and
  `build` run on 6 (Vue's `vue-tsc` precedent); the core and the other packages stay on 7.
  Pins (published at least 7 days before 2026-11-21): `svelte` 5.57.3 (2026-10-26),
  `@sveltejs/package` 3.0.2 (2026-10-29; 3.0.3 is too recent), `svelte-check` 4.7.8 (2026-11-01),
  `@sveltejs/vite-plugin-svelte` 7.3.1 (2026-09-23), `@testing-library/svelte` 5.4.2 (2026-06-23),
  `typescript` 6.0.3 (2026-04-16). Peer `svelte` `^5.29.0`: attachments came in 5.29.
- **`exports` with the `svelte` condition:** `types`, `svelte`, `default` (Svelte's packaging
  docs), the source condition first in the repo, `publishConfig.exports` dist-only, and the legacy
  `svelte` field; `check:package` takes `svelte` among the published conditions.
- **attw's one exception:** the declarations import components as `./x.svelte` (typed by
  `x.svelte.d.ts`), which `moduleResolution: bundler` resolves and `node16` does not. For a Svelte
  package `check:package` reads attw's JSON (`esm-only`) and accepts only an
  `InternalResolutionError` of a `.svelte` import under `node16` (`svelteAttwProblems`, tested);
  everything else fails it, as for the other packages (xyflow's Svelte package ignores the rule
  whole).
- **`check-dts` exception:** svelte2tsx writes `z_$$bindings?: ReturnType<__sveltets_Render<any>
  ['bindings']>` on a generic component's declaration (tooling only, no consumer types with it);
  that one member is skipped, as Angular's compiler metadata is.
- **The bundle guard follows an unbundled build:** without source maps (a package with a
  `svelte` field), each built file is its own source (`dist/minimap/x.svelte` is
  `src/minimap/x.svelte`), and its relative imports (`../utils/x.js`, `./x.svelte`) are followed
  (`site/tests/check-features.test.ts` plants an import in the real Svelte build).
- **Portals mount:** Svelte has no portal; `EdgeLabel` (into the edges' HTML layer) and
  `NodeToolbar` (into the root) render through `utils/portal.svelte`, which `mount`s its content
  in the target with every context of its place (`getAllContexts`) and unmounts it with the
  primitive. Alternative: moving the element with `appendChild`; refused, Svelte removes a block's
  nodes by walking siblings.
- **The engine writes, Svelte does not undo:** a spread `style` string replaces the element's
  whole style when it changes, so the root's structural style carries `touch-action: none` once
  the engine exists, and the viewport's carries the transform the engine wrote last (read
  untracked: a pan derives nothing). Tested: a new consumer style keeps both.
- **The engine is created in the root's `$effect`**, one per model (another `model` destroys it and
  creates one at the last viewport, React's in-place swap; the facade and the flow ref follow);
  the parts' attachments read `context.engine` and register again. The controlled sync and the
  model subscription are `$effect.pre`s (client only, before the parts render): a model the app
  gives starts at the props. A server render has no engine (`svelte/server`, `tests/server.test.ts`).
- **Controlled lists reuse `commands-to`**, exactly React's algorithm, diffed only on an identity
  change. The model's lists are written back to `bind:nodes` / `bind:edges`; a parent whose list
  is a deep `$state` proxies what it gets, and a proxy of a frozen array breaks on its next write,
  so the root reads the prop back and gives such a parent a copy (its entries stay the model's
  frozen ones); the viewport written back is always a copy. Prefer `$state.raw` for the lists: a
  deep list mutated in place (`push`) is not seen (no new identity), as React's.
- **Each node renders again only when its node changes**: the keyed `{#each}` keeps the item
  source of a node the model did not change, and a node's id (not its object) drives its
  registration, so a drag step registers nothing again (#12's review: the attachment read the
  whole node and re-observed the element on every step). A new `children` snippet renders every
  entity again (`{@render}` follows the snippet's identity): Vue's #11 bug cannot happen.
- **Callback props are lowercase** (`onnodeschange`, `onedgeschange`, `onviewportchange`), as
  Svelte's DOM event props and xyflow's Svelte package.
- **The viewport and gesture options (#25)** are React's root props under React's names
  (`autoPan`, `panOnDrag={[1, 2]}`, `panActivationKey`, `panOnScrollMode`, `panOnScrollSpeed`,
  `zoomActivationKey`, `easing`, `nodeOrigin`, `nodeExtent`, `elevateNodesOnSelect`,
  `elevateEdgesOnSelect`), sent as React's (`null` is not `undefined`, a function by identity);
  the object-valued ones (`panOnDrag`, `autoPan`, `nodeOrigin`, `nodeExtent`) go through `plain`
  (a `$state` parent's proxy never reaches the engine; `panOnDrag` did not before #25).
  `ZoomIn`, `ZoomOut`, `FitView` take `duration`. The node's `z-index` is in its structural style
  string (`useNode`'s `props.style`, `elementProps`' `structural`), so a consumer's `style`
  (`z-index` included) never replaces it (tested). The node origin and `drawn-edges` are React's.
- **`EdgeToolbar` mounts into the root through `utils/portal.svelte`** (#28), as `NodeToolbar`:
  its `div` is written in its own component (HTML), so the edge's SVG around it does not matter.
  `nodeIds` and `offset` go through `plain` (a `$state` proxy never reaches the engine).
  `NodeToolbar` calls `useNodeId`'s getter only without `nodeIds`, so several nodes' toolbar needs
  no enclosing node.
- **`ref` has no fallback** (`ref = $bindable()`): Svelte refuses `bind:ref={undefined}` on a prop
  with a fallback, and `let el = $state()` is the common app code.
- **Biome does not read `.svelte` files** (not in its `includes`); `svelte-check
  --fail-on-warnings` is their check.
- **Known limits:** jsdom lays nothing out, so the tests stub the layout (`tests/flow.ts`,
  React's); the flows under test are components (`tests/fixtures/`: snippets are written in
  templates); the peer floor (5.29) is not exercised by a check (the smoke app
  runs the pinned 5.57.3); the gestures' real feel is checked by the Svelte examples' shared specs (#13: they passed
  with no adapter fix).

Svelte's #36 (React's, see the React section): `MiniMap`'s `inversePan`, `zoomStep` and `onclick(event,
point)`, `NodeResizer`'s `direction`, `FitView`'s `padding`, `nodeIds`, `includeHidden`,
`minZoom`, `maxZoom`, `EdgeToolbar`'s `point`, `alignX`, `alignY`, `Flow.NodesSelection`
(`components/nodes-selection.svelte`, its `children` snippet given `{ state }`), and the runes
`useFlowStore(selector, equal = Object.is)`, `useNodeId()`, `useNodesData(idOrIds)`,
`useNodeConnections(options)`, `useInternalNode(id)`, `useKeyPress(keys, options)` (each a
`FlowValue` on `flowValue`, arguments a value or a getter: `MaybeGetter`) and
`useOnViewportChange(options)` (`runes/use-*.svelte.ts`). Tests: `tests/part-options.test.ts`,
`tests/hooks.test.ts` (a probe's `$effect.pre` counts the notifications), the contract's
`nodes-selection` case, the type fixture.

- **`MiniMap`'s `onclick` is the engine's `minimap-click`** (React's `onClick`): the DOM `onclick`
  is left out of its props; the contract test gives the minimap `ondblclick` instead.
- **`useOnViewportChange`'s callbacks are lowercase** (`onstart`, `onchange`, `onend`), as the
  adapter's other callbacks; they are read at each event (pass a getter to follow props).
- **`useNodeId()` returns a plain `string | null`**, not a `FlowValue`: a `Flow.Node`'s id never
  changes (keyed `{#each}`). The parts' own lookup is `usePartNodeId` in `context.ts` (React's
  rename); `findFlowContext` / `findNodeContext` read a context that may be missing.
- **`useNodeConnections` throws when called** outside a `Flow.Node` without an `id` (React throws
  at render).
- **`useKeyPress` works outside a root** (with a `target`), and listens again only when the keys'
  JSON or the target change (`$derived` of both).
- **A control's payload is `givenPayload`** (`use-control-button.svelte.ts`): the given fields,
  each through `plain` (a `$state` proxy of `nodeIds` or `padding` never reaches the engine);
  `ZoomIn` / `ZoomOut` pass `{ duration }` the same way.
- **#39 in Svelte** (React's, see the React section and the engine's SSR rule): the root takes
  `zIndexMode` and shares the static geometry through its context while there is no engine, so the
  server render (`svelte/server`) and the first client render draw the same nodes and edge paths;
  `tests/server.test.ts` (paths in `render(...).body`) and `tests/static.test.ts` (an SSR build of
  the fixture hydrated: the elements kept, no mismatch warning, then the engine). `Flow.Edges`
  renders one level as today, several as `edges-layer` wrappers each with its `svg` and its labels'
  layer; `Flow.Nodes` drops `isolation` then; an edge that changes level remounts and `Flow.Edge`
  calls `refocus` on mount. `ResizeHandle` takes `direction` and `variant` (in its snippet state).
- **Gotcha, a template's `{f(x.current)}` is no render count**: once the value had changed, Svelte
  (5.57.3) called `f` again on every later revision although `x.current` stayed equal (the DOM was
  untouched); the probes count with an `$effect.pre` instead.

## The Angular adapter (Issue #15)

`@fragiola/flow-angular` is the React adapter in Angular 22 (signals, standalone, zoneless,
OnPush by default), in the ecosystem's Angular way (Splitter's, Tree's, Data Grid's): the same 25
primitives as **attribute directives on the app's own elements** (`<div flowRoot>`,
`<div [flowNode]="node">`, `<svg:g [flowEdge]="edge">`, `<button flowZoomIn>`), in files of React's
base names with Angular's suffix (`src/lib/directives/<name>.directive.ts`, `src/minimap/`,
`src/resize/`: `tests/index.test.ts` compares them), the same part names, state attributes,
structural styles, inputs and state fields, over the same core keys. `export *` of the core, the
directives (`Flow<Name>Directive`, and `FLOW`, every main-entry directive for a component's
`imports`: React's `Flow` namespace), the injection functions, `createFlowRef` / `injectFlowRef`,
and the eight feature entries as ng-packagr secondary entry points (`/minimap` adds
`FlowMiniMapDirective`, `FlowMiniMapNodeDirective`, `FlowMiniMapMaskDirective`, `FLOW_MINIMAP`;
`/resize` adds `FlowNodeResizerDirective`, `FlowResizeHandleDirective`, `RESIZE_POSITIONS`,
`FLOW_RESIZE`). Built by ng-packagr (partial compilation, FESM and bundled types), typechecked by
`ngc`, tested with Vitest, jsdom, Analog's Vite plugin and a zoneless TestBed.

| folder | holds |
| --- | --- |
| `src/lib/directives/` | one primitive per file (`root.directive.ts` … `zoom-out.directive.ts`); `nodes.directive.ts` and `edges.directive.ts` also hold their item templates (`FlowNodesItemDirective`, `FlowEdgesItemDirective`) |
| `src/lib/inject/` | the public injection functions (`inject-*.ts`), `create-flow-ref.ts`, `inject-flow-ref.ts`, `internal.ts` (`flowValue`, `sameValue`, `valueNow`, `partOwnerId`), `control-button.ts`, `bind-edge-path.ts` |
| `src/lib/utils/` | `helpers.ts` (`injectHost`, the input transforms, `beforeInputs`, `bindStructuralStyle` (Splitter's), `bindBaseStyle`, `bindAttributes`, `bindBaseAttributes`), `views.ts` (`SlotViews`, `FlowSlot`, `SignalContext`), `presence.ts` (`bindPresence`), `default-content.ts`, `engine-facade.ts` and `shallow-equal.ts` (React's) |
| `src/lib/` | `context.ts` (the injection tokens), `flow.ts` (`FLOW`) |
| `src/<feature>/` | a feature's entry (`index.ts`) and its directives (`minimap/`, `resize/`); `<feature>/ng-package.json` at the package root points ng-packagr at it (Data Grid's layout) |
| `src/` root | `public-api.ts` |

**How React's API maps to Angular:**

| React | Angular |
| --- | --- |
| `<Flow.Root …>` and every part | the part's directive on the app's element: `flowRoot`, `flowViewport`, `flowNodes`, `flowNode`, `flowHandle`, `flowEdges`, `flowEdge`, `flowEdgePath`, `flowEdgeLabel`, `flowReconnectAnchor`, `flowConnectionLine`, `flowNodesSelection` (#36), `flowSelectionBox`, `flowBackground`, `flowControls`, `flowZoomIn`, `flowZoomOut`, `flowFitView`, `flowToggleInteractive`, `flowNodeToolbar`, `flowEdgeToolbar` (#28), `flowMiniMap`, `flowMiniMapNode`, `flowMiniMapMask`, `flowNodeResizer`, `flowResizeHandle` |
| `render={<section />}`, `render={(props, state) => …}` | not applicable: the app writes its own element and puts the directive on it |
| the children functions of `Nodes`, `Edges` | `<ng-template flowNodesItem let-node>` inside `[flowNodes]` (or `*flowNodesItem="let node"`), `<ng-template flowEdgesItem let-edge>` inside `[flowEdges]` (its elements with the `svg:` prefix); `[flowNodesItem]="model"` types the node by the registry (`ngTemplateContextGuard`) |
| the children functions of `ConnectionLine`, `MiniMap` | the app's elements inside them, reading `#line="flowConnectionLine"`'s `line.state()?.connection` or `#map="flowMiniMap"`'s `map.state().view` |
| a part's default children (`Edge`'s `EdgePath`, `NodeResizer`'s handles, `MiniMap`'s nodes and mask, `ConnectionLine`'s path) | added by the directive when the app wrote no element in it (`defaultContent`, once rendered) |
| `className` / `style` functions of the state | the app's `[class.x]` / `[style.x]` bindings over the part's state (`#n="flowNode"`, `[class.selected]="n.state()?.selected"`), and the `data-*` |
| `ref` | the element is the app's own (`viewChild`, a template reference); the directive through `exportAs` (`#flow="flowRoot"`: `model()`, `engine`, `state()`) |
| `onClick` … | `(click)` …: the directive's host listener runs first |
| `nodes` + `onNodesChange`, `edges` + `onEdgesChange` | `[(nodes)]`, `[(edges)]` (inputs with `nodesChange` / `edgesChange`) |
| `viewport` + `onViewportChange(viewport, gesture)` | `[(viewport)]` (`viewportChange`), and `(viewportMove)` with `{ viewport, gesture }` |
| `flowRef={ref}`, `ref.current` | `[flowRef]="flow"`, `flow.current` (a signal's value: a template follows it) |
| `useFlow()` | `injectFlow()` → `{ model: Signal, engine }` |
| `useNode(node)` → `{ state, props }` | `injectNode(node, a signal or a getter)` → `{ state, props }` as signals; it binds the host of its injection context (a component `article[appNode]`) |
| `useEdge`, `useHandle` | `injectEdge`, `injectHandle`, as `injectNode` (`injectHandle` takes a `nodeId` outside `[flowNode]`) |
| `useViewport()`, `useConnection()`, `useSelection()`, `useNodes()`, `useEdges()` | `injectViewport()`, `injectConnection()`, `injectSelection()`, `injectNodes()`, `injectEdges()`: signals |
| `useFlowRef()` | `injectFlowRef()` (`createFlowRef()` in a field) |
| `useFlowStore`, `useNodeId`, `useNodesData`, `useNodeConnections`, `useInternalNode`, `useKeyPress` (#36) | `injectFlowStore`, `injectNodeId`, `injectNodesData`, `injectNodeConnections`, `injectInternalNode`, `injectKeyPress`: signals (`src/lib/inject/inject-*.ts`), their arguments values, signals or getters (`ValueOrSignal`) |
| `useOnViewportChange` (#36) | `injectOnViewportChange(options)`: it returns nothing, its options read at each event |
| `MiniMap`'s `onClick(event, point)` (#36) | `flowMiniMap`'s output `(minimapClick)`: the engine's `minimap-click` event (`element`, `point`, `client`, `event`), its own taps only |
| `<Flow.Root<Types, typeof features>>` | inferred from the inputs (`[model]`); a child types `injectFlow<Types, typeof features>()` |

Decisions of the Angular adapter (#15):

- **TypeScript 6.0.3 for the Angular package and its smoke app** (D16's exception): `ngc` and
  ng-packagr take `typescript >=6.0 <6.1`. Splitter's pins, published at least 7 days before
  2026-11-21: `@angular/*` 22.2.5 (2026-11-06), `@angular/build` 22.2.6 (2026-11-04),
  `ng-packagr` 22.2.6 (2026-11-04), `@analogjs/vite-plugin-angular` and `@analogjs/vitest-angular`
  2.9.6 (2026-11-04), `typescript` 6.0.3 (2026-04-16), `rxjs` 7.8.2. `pnpm-workspace.yaml` takes
  Splitter's `allowBuilds` (`@parcel/watcher`, `lmdb`, `msgpackr-extract`: their prebuilt binaries)
  and its `packageExtensions` (Analog's plugin gets this package's TypeScript as a peer). The
  transitive `@angular-devkit/schematics` (a peer Analog's test plugin installs) resolved to
  22.3.0, as the lockfile's other transitive entries, unpinned.
- **Packaging, Data Grid's way**: ng-packagr builds into `dist` (`fesm2022/*.mjs` with their maps,
  `types/*.d.ts`); `scripts/check-dist.ts` removes the manifests and the README and licence copies
  it writes there, and fails a bundle importing anything but `@angular/core`, the core and the
  package itself. The package is packed from its folder (`files: ["dist"]`, `publishConfig.exports`,
  as every package), not from `dist` (Splitter's `publishConfig.directory`). publint and attw
  (`esm-only`) pass with no exception; check-dts's Angular metadata exception covers `ɵdir`/`ɵfac`.
  The bundle guard reads each package's main entry from its published `exports["."]`.
- **The feature entries build on the main entry's public API** (ng-packagr compiles them against
  its types): the helpers they need are exported with Angular's `ɵ` prefix (`ɵinjectFlowContext`,
  `ɵflowValue`, `ɵbindAttributes`, …), not an app's API; `tests/index.test.ts` keeps the rest of the
  surface exact and forbids a relative import out of a feature folder. No feature of Flow adds a
  root input, so Data Grid's "a directive of the feature's entry on the root" has nothing to carry:
  the entries add only their primitives.
- **The model's state is never reactive**: the root bumps one `revision` signal on every model
  commit and every `adapter.subscribe` notification; each part reads the model and the engine in a
  `computed` (`flowValue`) whose `equal` keeps its last object while equal (React's comparison).
  The directives write their attributes, structural style and defaults to their element in effects
  (`bindAttributes`; `bindStructuralStyle`: the structural keys win over the app's static style and
  style bindings, written back after every render; `bindBaseStyle` / `bindBaseAttributes`: a
  handle's place, `fill`, `d`, `r`, `type="button"`, which the app's own win over).
- **One root view per node and per edge (`SlotViews`)**: Angular checks a template's embedded
  views with their component (an embedded view has no reactive consumer of its own: a signal read
  in one marks its component), so a node's view in the app's component would be checked on every
  drag step of any node. Each entity's view is created in a `FlowSlot` (a template-less component
  made with `createComponent` on a host out of the document, attached to the application), its
  elements moved before the item template's anchor in order, so a drag step checks the moved
  node's view only. The item directive's `ngDoCheck` marks every slot whenever the app's component
  is checked, as embedded views are; another template (an `@if` around two) is another directive
  and renders every entity again (Vue's #11 bug cannot happen).
- **Edges draw in an SVG the directive adds** to the app's `[flowEdges]` element (React's `div` +
  `svg`), and the item template's anchor is moved into it; the app's element is the HTML layer
  labels go to.
- **No portals: a part moves its element** (`bindPresence`): an edge label (written
  `<xhtml:div flowEdgeLabel>` inside the SVG group: the prefix makes it HTML) goes into the edges'
  HTML layer, a toolbar into the root, and a part shown only sometimes (the connection line, the
  selection box, a minimap node, a toolbar not open) leaves the document meanwhile, a comment
  keeping its place; `SlotViews` never pulls a moved element back, and a default content counts a
  moved element as the app's (#15's review); an element moved away goes with its directive.
- **The engine is created after the first render** (`afterNextRender`, then an effect per model):
  another `model` destroys it and creates one at the last viewport, the facade and the flow ref
  following; `DestroyRef` (the effects' cleanups) releases the engine, the model's listeners, the
  flow ref and the moved elements.
- **The model is not read before the root's inputs are set** (#15's review): a read from a child's
  constructor throws Angular's NG0950 (code -950, a clear message) instead of creating a model
  without `defaultNodes`, `features` or `createId`; templates, computeds and effects read it once
  `ngOnInit` ran.
- **Controlled lists reuse `commands-to`**, exactly React's algorithm, in an effect over the
  lists' identity; the model's own list given back (`[(nodes)]` after a drag step) is recognized by
  identity and diffs nothing. The outputs always emit (React's callbacks), with the model's frozen
  lists; Angular signals never proxy them.
- **A bound output marks the app's component** (Angular's listeners do): binding
  `(viewportChange)` or `[(nodes)]` checks the app's whole template (every slot) on every pan or
  drag step. Bind them where needed; `injectViewport()` and the flow ref's `engine.subscribe` give
  the same without it.
- **Engine state in a template comes through a signal**: `injectViewport()`, a part's `state()`,
  `flow.current` follow the engine; `engine.can(…)` read alone in a template does not update (the
  Svelte gotcha).
- **The root renders a change of the flow before the next task** (#16, `renderSoon`): zoneless
  Angular renders a signal change in a later task (a timeout or a frame), so a node an arrow key
  moved, or a zoom button its click took to the limit, still showed the old view to whatever read
  the page right after the event (the shared specs: `selection-and-keyboard` failed 4 runs of 5,
  `minimap-and-controls` always). After a model commit or an engine view change the root ticks the
  application in a microtask (`ApplicationRef.tick()`), once per root and task, as Vue and Svelte
  flush theirs; Angular's own scheduled render follows and finds nothing to do. An error of that
  render goes to the app's `ErrorHandler`, as one of Angular's scheduled renders does (#17's review). Alternative: each
  part writing its DOM from its own subscription (a control button's click wrote `disabled`
  directly, #16's first fix); refused: one place, and the direct write could leave a button
  disabled when the app's `(click)` undid the limit in the same task (#16's review).
- **`flowEdgeToolbar` is written `<xhtml:div flowEdgeToolbar>` inside `[flowEdge]`** (#28), as an
  edge label, and moved into the root (`bindPresence`, in the document only while shown);
  `[offset]` takes an `XY`, `open` a bare attribute. `flowNodeToolbar`'s `[nodeIds]` makes the
  enclosing node optional: `partOwnerId` takes a `needed` getter (false while `nodeIds` is not
  empty), so no "must be used inside [flowNode]" error. Resize handles (the app's and the
  resizer's default ones) bind the engine's `resize-handle` record (`bindResizeHandle(element,
  context, nodeId, position)`), as handles already did.
- **The viewport and gesture options (#25)** are React's root props as inputs of `flowRoot`
  under React's names (`[autoPan]`, `[panOnDrag]="[1, 2]"`, `panActivationKey`,
  `panOnScrollMode`, `panOnScrollSpeed`, `zoomActivationKey`, `[easing]`, `[nodeOrigin]`,
  `[nodeExtent]`, `elevateNodesOnSelect`, `elevateEdgesOnSelect`), sent as React's (`null` is not
  `undefined`, a function by identity). Transforms: `panOnDrag` keeps a list of mouse buttons
  (a bare attribute or a boolean as before; before #25 `optionalBoolean` turned a list into
  `true`), `autoPan` keeps an options object, `panOnScrollSpeed` takes its attribute's text as a
  number, `elevateNodesOnSelect` / `elevateEdgesOnSelect` a bare attribute; the keys and
  `panOnScrollMode` are plain strings (`[panActivationKey]="null"` for none). `flowZoomIn`,
  `flowZoomOut`, `flowFitView` take `duration` (`duration="300"` or `[duration]="300"`). The
  node's `z-index` is a key of its `bindStructuralStyle` (it wins over the app's `[style]`,
  tested); the node origin and `drawn-edges` (the order `SlotViews` places the edges' elements in)
  are React's.
- **#36 in Angular** (React's decisions above hold): `flowMiniMap` takes `inversePan`, `zoomStep`
  (its part options, one set per root, set by an `effect` and `null` on destroy) and emits
  `minimapClick` with the engine's whole `minimap-click` event (an output carries one value, as
  the root's engine outputs); `flowNodeResizer` takes `direction`; `flowFitView` takes `padding`,
  `nodeIds`, `includeHidden`, `minZoom`, `maxZoom` (only the given ones in its payload:
  `givenPayload` in `control-button.ts`, which now takes the payload getter, `flowZoomIn` /
  `flowZoomOut` passing their `duration` through it); `flowEdgeToolbar` takes `point`, `alignX`,
  `alignY`. `flowNodesSelection` is `flowSelectionBox`'s way (`bindPresence`: out of the document
  while `selection-rect` is null), in flow coordinates inside `[flowViewport]`. The injection
  functions are on `flowValue` with `sameFlowValue` where they build a value; `injectNodeId()` is a
  signal of the enclosing node's id (null outside one); `injectNodeConnections` throws at once
  outside `[flowNode]` when its options are a value without an `id` (React's error), and reports
  it once rendered when they are a signal or a getter (`partOwnerId`); `injectKeyPress` listens
  in an `effect` (an equal list of keys keeps its listener), on the root's window by default
  (`null` outside a root without a `target`: never pressed); `injectOnViewportChange` subscribes
  per engine in an `effect` and marks nothing. Tested in `tests/part-options.test.ts` and
  `tests/hooks.test.ts` (each signal's updates seen by an effect, React's render counts; a
  component of typed calls checked by `ngc`).
- **#39 in Angular** (React's, see the React section and the engine's SSR rule): `flowRoot` takes
  `zIndexMode` and, until its engine exists (after the first render), shares the static geometry:
  the first browser render draws the nodes at their static place and the declared edges.
  `[flowEdges]` renders one level as today (its SVG in the app's element); with several, an
  `edges-layer` wrapper per level, each with its SVG and labels' layer, and an edge's view is
  **moved** before its level's anchor (`utils/views.ts`: views placed by anchor), not recreated, so
  it keeps its state; a moved edge that had focus gets it back (`refocus` from `[flowEdge]` too).
  `flowNodes` drops `isolation` while layered. `flowResizeHandle` takes `direction` and `variant`
  inputs (in its state); `flowNodesSelection` binds the engine's record (`tabindex` with
  `keyboard()`).
- **Known limits:** no server render nor hydration (the sibling Angular adapters do not support it
  either; `[flowEdges]` adds its SVG in its constructor; #39: the declared edges are in the
  browser's first render); jsdom lays nothing out, so the tests stub
  the layout (`tests/flow.ts`, React's); a part that leaves the document while hidden must not be
  the first root element of a repeated view (an `@for` of `[flowMiniMapNode]`s: Angular would
  insert before a detached element; wrap it); a default content is added only when the app wrote
  no element by the first render; each structural-style element writes its keys back after every
  render (cheap reads, one hook per element); `renderSoon` ticks the whole application, so with
  several roots or a large app around the flow each task with a flow change renders the app once
  more; a generic part (`[flowEdge]`) does not infer its type from an entity narrowed by an `@if`
  around it (narrow inside the part, as `edge-types` does); the gestures' real feel is
  checked by the Angular examples' shared specs (#16: they needed the fix above).

## The playground and the examples (Issue #6)

Every rule of the guidelines' Examples section (`../guidelines/docs/site.md#examples`) holds; what
Flow decided on top of it:

**`examples/shared`** (`examples-shared`, private, imports no framework: `tests/framework-free.test.ts`):

| path | holds |
| --- | --- |
| `src/meta/<id>.ts` | one file per example: title, description, `level`, order, features, docs link, layout, height |
| `src/meta-types.ts` | `LEVELS` (#44: `basics`, `nodes`, `edges`, `connections`, `interaction`, `layout`, `data`, `styling`, `apps`, titled Basics, Nodes, Edges, Connections, Interaction, Layout, Data and state, Styling, Apps: `examples.json`'s `levels`), `DEFAULT_HEIGHT` (460, 600 for `layout` and `apps`) |
| `src/framework.ts` | `FRAMEWORKS` (react, vue, svelte, angular), entry files, adapter and icon packages |
| `src/themes/` | `light`, `dark`, `ide`, `paper`, `terminal` (one CSS file of values each, `themes.ts`: name, title, description, scheme, swatch) |
| `src/embed/messages.ts` | `fragiola:example:ready` / `resize` / `theme` |
| `scripts/` | the examples finder, the manifest builder (`buildManifest`), the loader generator (`generate.ts <framework>`) |
| `e2e/` | `examplesE2eConfig(framework)` (port 4360 + framework index, base `/flow/embed/<framework>/`), the server with its host page, `smoke`, `iframe`, `themes` and `examples/<id>.spec.ts` |

`COMPLETE_FRAMEWORKS` is `["react", "vue", "svelte", "angular"]` (#16): every framework ships every
example, so a missing one fails its spec; a framework of a later adapter Epic is skipped there
while its app is written (the test uses a fake one). **`PENDING`** (`e2e/available.ts`, #44) is
the per-framework skip of what a later Epic ports: whole examples (`<slug>`) and cases of a spec
(`<slug>#<case>`, `pendingCase`); a spec that needs one is skipped in that framework with a
"(PENDING)" reason instead of failing (`requireCase(slug, case)` as a test's first line for a
case; `openExample` for an example). React never has any; the Epic that ports an entry to a
framework deletes it there. Today Svelte and Angular wait for `edge-reconnect#delete-on-drop`,
`sub-flows#selection-grouping` and the new examples of #45 (`shapes`, `easy-connect`,
`proximity-connect`, `delete-middle-node`, `intersections`, `contextual-zoom`, `connection-line`)
and of #46 (`edge-markers`, `animating-edges`, `floating-edges`, `editable-edge`,
`gradient-styling`, `whiteboard`) and of #47 (`helper-lines`, `copy-paste`, `collaborative`,
`export-image`, `stress-test`) and of #48 (`dagre-layout`, `elk-layout`, `auto-layout`,
`force-layout`): Epic #49 writes them in React, the ports' Epics follow. Vue (Epic #52) has
every one since #51 (the extensions and the examples of #45 and #46 since #50): `PENDING.vue` is
empty. A pending whole example has nothing in the
port's app yet: its `tests/examples.test.ts` leaves it out of React's ids and `tests/vendored.test.ts`
expects no copy of its `styles.ts` and siblings.
Alternative: a capability attribute the example renders, checked by the spec; refused: it would
put test plumbing in copyable example code, and a forgotten port would skip silently instead of
being listed in one place.

**The examples** (`examples/react/src/examples/<id>/index.tsx` + `styles.ts`; the README there is
the authoring guide), 44 since Epic #49, by topic in nine levels (#44; in sidebar order, each
level's examples by `order`): Basics `basic`, `read-only`, `server-rendering`,
`minimap-and-controls`, `stress-test`; Nodes `custom-nodes`, `shapes`, `node-resizer`,
`node-toolbar`, `contextual-zoom`, `intersections`, `delete-middle-node`, `sub-flows`; Edges
`edge-types`, `edge-labels`, `edge-markers`, `animating-edges`, `floating-edges`, `editable-edge`,
`edge-reconnect`; Connections `connection-validation`, `easy-connect`, `proximity-connect`,
`connection-line`, `announcements`; Interaction `selection-and-keyboard`, `snap-to-grid`,
`helper-lines`, `add-nodes`, `context-menu` (#33), `copy-paste`; Layout `dagre-layout`,
`elk-layout`, `auto-layout`, `force-layout`; Data and state `connected-data` (#36),
`save-and-restore`, `undo-redo`, `collaborative`, `export-image`; Styling `backgrounds`,
`gradient-styling`; Apps `workflow-builder` (the landing's showcase), `whiteboard`. Every case of
React Flow's example catalogue maps to one of them (Epic #49's coverage map, the docs page
`guides/react-flow-examples.mdx`, "Coming from xyflow's examples"). `_kit/persistence.ts` and `_kit/undo.ts` are the
copyable app policy. Epic #26's options where they are natural (#25): `custom-nodes`' preview drags
only by its title bar (`data-flow-drag-handle`, `styles.dragHandle` and `styles.grip` from the
theme tokens), `minimap-and-controls`' zoom and fit-view buttons animate for 200 ms (`duration`),
the same in the four apps; the shared specs cover both. #28: `edge-types` draws `simplebezier`,
`node-toolbar` adds the selection's toolbar (`nodeIds`, below the notes), `edge-labels` an
`EdgeToolbar` on the selected edge, `selection-and-keyboard` keyboard connections (it installs
`connection()` and names its handles) and `announcements` each step of one (`connect-target`).
#36: `selection-and-keyboard` adds `Flow.NodesSelection` (drag the box's rectangle);
`node-resizer` a `banner` node (`direction="horizontal"`, left and right handles; 3 resizers);
`edge-types` gives `smoothstep` `animated` + `pathOptions.borderRadius` and `step`
`pathOptions.stepPosition: 0.25`; `connected-data` (new) sums its inputs with
`useNodeConnections` + `useNodesData` (test ids `sum-total`, `sum-sources`, `value-<id>`).
#44 (React only so far, `PENDING` in the other apps): `edge-reconnect` has a "Delete on drop"
switch (a native `role="switch"` checkbox, off by default: `onReconnectCancel` with `dropped`, no
`to`, not `refused` runs `edge.remove`), and `sub-flows` a "Grouping" toolbar, "Group selection"
(two or more selected top-level nodes into a new `group-<n>` sized to their `nodes-bounds` plus a
margin and a title band: one `batch` of `node.add`, `node.set-parent` per node and `selection.set`)
and "Ungroup" (the selected groups' children back on the flow, then the groups removed: one
`batch`), with a loose `logs` node beside `cache`. The ports already copy both `styles.ts`.
#45 (React only, whole examples `PENDING` in the other apps): `shapes` (seven SVG shapes from
`shape-path.ts`, a `role="slider"` rotation knob storing `data.angle`, applied to an inner wrapper,
handles remounted per angle as the engine has no public re-measure), `easy-connect` (loose mode,
`clickToConnect`, a radius of half the node, node-sized handles, its own floating edge path),
`proximity-connect` (a temporary `aria-hidden` line from `node-rect-by`, never in the document),
`delete-middle-node` (`keyboard({ beforeDelete })` runs one `batch` from `reconnect.ts` and answers
`false`: a middleware's commands would commit as a second step), `intersections`
(`intersecting-nodes`, `crossing.ts`, `collisions.ts` behind a "Resolve collisions" switch),
`contextual-zoom` (`data-detail` low/medium/high at zoom 0.75 / 1.35, edge labels from 1) and
`connection-line` (`Flow.ConnectionLine` children, the selection's extra lines and a second `batch`
on `connect`). Their pure helpers are unit-tested in `examples/react/tests/<id>.test.ts`.
#46 (React only, likewise `PENDING`): `edge-markers` (no marker is built in: its own `<marker>`s from
`markers.ts` in an `aria-hidden` svg, one per shape and tone, as a marker is coloured where it is
defined, and one per shape for the selected state, swapped by `data-selected:[marker-*:var(…)]`;
ids from `useId`; `limitations.mdx` links it), `animating-edges` (a dot on `<animateMotion>` over
`useEdge(edge).state.path.path`, a SMIL `stroke-dashoffset` dash flow, a one-run `data-pulsing`
cleared on `animationend`; under `prefers-reduced-motion`, followed live, the dot and dashes go and
the edges carry `data-reduced-motion`), `floating-edges` (no handles: `useInternalNode(id).rect`
per end, the border point of a box or an ellipse from `border-intersection.ts`, its own copy of
easy-connect's idea; an "Edge path" radio group: straight, bezier, simple = nearest sides' middles;
`data-variant`), `editable-edge` (`data.points` through `edge.set-data`; points are named SVG
`role="button"` circles with `data-flow-no-gesture`, dragged with `screen-to-flow`, arrows move,
Delete removes, a double click inserts; "Route" stores `routing.ts`'s A* way around the inflated
node boxes, a plain step and a status when none exists), `gradient-styling` (palette accents caught
in custom properties, a gradient frame as the node's border, a selected glow, one `userSpaceOnUse`
`<linearGradient>` per edge between its ends; blue, green, orange and purple only, as the five
themes do not declare rose) and `whiteboard` (a "Whiteboard tools" toolbar, `data-tool`; a drawing
tool lays a `data-flow-no-gesture` overlay and `panOnDrag={tool === "select"}`; rectangle,
Chaikin-smoothed freehand strokes as nodes (`stroke.ts`), an eraser removing in one `batch`, edges
first (`eraser.ts`), a lasso selecting whole boxes (`lasso.ts`, `selection.set`)).
Follow-ups (no package change here): the core's `roundedPath`, `halfwayAlong` and `sidePoint` are
not exported (the examples keep their own copies), and an app edge with its own path has no way to
give its label / `EdgeToolbar` a point (they sit at the default midpoint).
#47 (React only, likewise `PENDING`): `helper-lines` (a node dragged alone shows guides,
`data-testid="guide"` with `data-axis` (x is a vertical line) and `data-at`, where its edges or
centre line up with another node's, drawn in flow coordinates inside `Flow.Viewport` from a store
over `dragging-node-ids`, `alignment.ts`; the snap is a middleware, `snapping.ts` on `model.use`,
rewriting the drag's transient `node.move` steps and the drop within 8 flow units, leaving key and
code moves, the cancel's restore and batches alone), `copy-paste` (Ctrl/⌘ + C, X, V through
`useKeyPress`, one action per press, skipped while typing, and a "Clipboard" toolbar; a copy is the
selected nodes and only the edges between them; a paste is one `batch` with new ids, the stem plus
the lowest free number, under the pointer (`screen-to-flow`) or one 24-unit step on, one more per
paste at the same place; a marked JSON payload, `clipboard.ts`, on `navigator.clipboard` when allowed,
else in memory, checked with `validateFlow`; the e2e runs on the in-memory copy), `collaborative`
(Alice and Bob, a model each, joined by `transport.ts`: an in-memory hub and a `BroadcastChannel`
bridge to other tabs, hello/snapshot, no echo; `sync.ts` sends the entities each local command put
or removed, from `model.subscribe`'s before/after, selection left out, and the other side applies
them as one `batch` of `commands-to` marked `meta.remote`, never sent back, last write wins, drags
streamed as transient batches; cursors in flow coordinates, `data-testid="cursor"` and `data-peer`,
and remote selections, `data-remote-selected` and a dashed frame; Alice orange, Bob blue),
`export-image` (`flow-svg.ts` builds a standalone SVG string from the document with
`staticGeometry`, no DOM, so a server makes the same file, as its node unit test does: a path per
edge, a rect and label per sized node, a viewBox fitted to the nodes and the edges' points, every
text escaped; `download.ts` reads the theme's look off the drawn parts at click time, a server keeps
`DEFAULT_LOOK`; the PNG is that SVG on a canvas, `canvas.toBlob`; downloads through an anchor and an
object URL) and `stress-test` (`generate.ts`: a seeded grid joined into one tree, `count - 1` edges,
1 000 nodes by default, 5 000, 10 000 or 20 000 on a "Size" select; the nodes declare size and
handles so `onlyRenderVisible` culls never-drawn nodes; `Flow.Root` keyed by size; the layers waited
for `engine.is("ready")`, as `visible-nodes` was every node before the root is sized (2.5 s instead of
0.3 s to open 10 000; #60: no gate any more, a culled React flow renders nothing before the
engine knows the view); "Shuffle" is one `batch` of `node.move`; the readout, `data-testid="readout"`
with `data-dom-nodes`, `data-frame-ms` and the like, a rAF median from `frames.ts`).
Follow-ups (no package change here; Epic #61 took up the frame times, see the large-flow decisions): at 10 000 nodes a pan frame takes ~34 ms and a node drag ~67 ms
(20 000: ~66 and ~117 ms; zoom's median ~17 ms, p95 ~100 ms), against a 16 ms target. The engine's
layering (`create-flow-engine.ts`: `visibleEdges` → `edgePath` for every edge, its SVG string
included, on every change, as the layering cache is keyed on `revision`, which each `notify`
bumps; a drag notifies twice per step) took ~72 % of the busy time in a profile; `node-by` through
the query bus (`readerOf` allocating per call), `visibleNodes` and `flushMeasured` are O(N) per
change; and `visibleNodes` returns every node while the root size is unknown. Also: a `Middleware`
written for any registry needs a cast on the `node.move` payload, `FlowModel<T>` whose `T` has no
`edges` is not assignable to `FlowModel`, nothing tells whether a batch may run transient,
`useKeyPress` reports held keys only (no one-shot shortcut, no `preventDefault`), and the core has
no bounds of an edge path or of the content (`export-image` parses its paths' points).
#48 (React only, likewise `PENDING`): the Layout level, each engine behind a framework-free
`layout.ts` / `forces.ts` the ports copy unchanged, unit-tested with the real engine in node, the
nodes declaring their sizes (an engine needs them before any measurement). `dagre-layout`
(`@dagrejs/dagre`: the document into a dagre graph, `rankdir` TB / LR, nodesep 40, ranksep 70,
dagre's centres back as top-left corners, `HANDLE_SIDES` per direction; computed before the first
render, so it opens laid out and fitted with no animation; a "Direction" radio group, Vertical /
Horizontal, lays it out again from the nodes' current places: the handles move to the new sides (a
context and a `key` per direction, the engine has no public re-measure), the nodes glide for
350 ms as one transient `batch` of `node.move` per frame (`tween.ts`, ease in-out), then one final
batch that is not transient, then `fit-view` with `duration`; the root carries `data-direction` and,
while the nodes move, `data-animating`), `elk-layout` (`elkjs/lib/elk.bundled.js`, async: a 9-node
pipeline whose nodes have several named inputs (left) and outputs (right), each handle an ELK port
on its side, `FIXED_SIDE`, ids `<node>:in|out:<handle>`; ELK's port order, read back from the
ports' y, goes into the node's `data` with `node.set-data` and its places with `node.move` in ONE
batch, no animation (the edges would cross while the nodes move), then `fit-view`; the handles are
keyed by their side's order so they remount; an "Algorithm" radio group, Layered = `layered`, Tree =
`mrtree`; a request id drops a stale result; the spec waits on the root's `data-layout="running" |
"done"` and reads `data-algorithm`; `mrtree` ignores the port order, so crossings can remain
there), `auto-layout` (a mind map laid out again by dagre after every change, animated as
`dagre-layout`; `layout.ts` lays out the shown nodes only and leaves out an edge to a hidden node,
or dagre would invent it; each topic has a "+" placeholder node, `add-<id>` with a dashed edge,
whose press adds the child, its edge, its placeholder and that edge in one `batch` (`tree.ts`); the
collapse toggle, `aria-expanded`, writes `collapsed` with `node.set-data` and the `hidden` flags
that change (`node.set-flags`, `edge.set-flags`) in one batch, a subtree under a still-collapsed
topic staying hidden on expand; the root counts finished layouts in `data-layouts`, which the spec
waits on) and `force-layout` (`d3-force`: a 14-node service network; `forces.ts` turns top-left
boxes into bodies at their centres, radius half the box's diagonal, and links from the edges, and
creates the simulation stopped so the tests `tick(n)`; `alphaDecay` 0.04, settling in ~3 s; every
tick is one transient `batch` of `node.move` that skips dragged and pinned nodes, `end` one final
batch, the first also an instant `fit-view`; a drag pins the node (`onNodeDragStart`: `fx`/`fy`
follow `node-by` of `dragging-node-ids` on each tick, `alphaTarget(0.3)`), the drop keeps it
pinned (`onNodesMove`, `data-pinned`), a cancel unpins; "Restart" releases every pin and runs
`alpha(1)`; edges centre to centre, `useInternalNode` and `straightPath`, no handles; the root's
`data-simulation="running" | "settled"` and a `role="status"`). Follow-ups (no package change
here): `node.move` refuses a node that is not draggable even from code, failing the whole batch, so
a layout cannot move a node the user may not drag (`auto-layout`'s placeholders stay draggable),
and `edge.add` refuses a node that is not connectable even from code (they stay connectable).

**The examples apps' dependencies.** Each app depends on its adapter (`workspace:*`), its framework,
its icons (`lucide-react`, `@lucide/vue`, `@lucide/svelte`, `@lucide/angular`) and what its
vendored Fragiola UI needs; nothing else but, since Epic #49 in `examples/react` and since #51 in
`examples/vue` (the same pins),
the layout engines `@dagrejs/dagre` 3.1.3, `elkjs` 0.12.1 and `d3-force` 3.0.1 (`@types/d3-force`
3.0.10), approved by the maintainer and pinned exactly (each published at least 7 days before).
Each app's `tests/examples.test.ts` allows exactly `@dagrejs/dagre`, `elkjs/lib/elk.bundled.js` (ELK's
browser build, no worker to serve) and `d3-force`, and `EXAMPLE_PACKAGES` (`examples/shared/src/framework.ts`)
lists them in an example's manifest `packages` by package name, so the code panel names what to
install. A port's Epic adds the same pins to its app. Declined: `yjs`, `html-to-image`,
`perfect-freehand`, `libavoid`, puppeteer or a server (`collaborative` syncs over
`BroadcastChannel`, `export-image` draws its own SVG, `whiteboard` smooths its own strokes).

The Vue, Svelte and Angular apps have every example from before Epic #49 (their own sections
below), with no parity filter left; Epic #49's new examples and extensions wait in `PENDING`
in Svelte and Angular. Vue has every one since #51 (Epic #52).

**Theme tokens** (`--fl-*`; `tests/themes.test.ts` holds the list, `e2e/themes.spec.ts` checks the
shapes differ on computed styles): shape `font`, `font-size`, `title-weight`, `node-padding`,
`node-radius`, `node-border`, `node-shadow`, `handle-size`, `handle-radius`, `handle-border`,
`edge-width`, `edge-selected-width`, `edge-dash`, `grid-dots`, `grid-lines`, `grid-cross`,
`control-radius`, `focus-width`, `motion`; colour, per palette: `canvas-bg`, `grid-color`,
`node-bg`, `node-line`, `edge-color`, `edge-selected`, `handle-bg`, `handle-line`, `valid`,
`invalid`, `selection-bg`, `selection-line`, `minimap-mask`, `focus-line`. Light: rounded nodes,
round handles, dots. Dark: Light's shapes. IDE: near-square nodes, small square handles, hairline
edges, lines. Paper: serif, round nodes, big ringed handles, thick edges. Terminal: monospace,
square everything, dashed edges, crosses.

**The playground** (`apps/playground`, `pnpm dev`, port 5197): the examples in place (themes,
source panel), scenarios (`src/scenarios/<area>/<id>.tsx`, default export only: `gestures/every-
feature`, `gestures/viewport-options`, `gestures/click-to-connect-and-drag-handles`,
`gestures/origin-extent-and-z-order` (#25: every option of Epic #26 behind a control),
`gestures/keyboard-and-toolbars` and `api/graph-and-geometry-helpers` (#28: keyboard connections
and resizing with a live region, the edge and selection toolbars; neighbours, overlaps, framing
and `simplebezier` edges), `api/selecting-hooks` (#36: every selecting hook on screen),
`performance/five-hundred-nodes`, `api/commands`), the inspector
(`src/inspector/flow-inspector.tsx`: viewport, gestures under way, selection, engine events, the
document) and `fixtures/basic`, the unstyled flow its specs drive (`src/fixture/flow-fixture.tsx`:
every feature, an 800 × 500 root at the page's corner, the viewport at `{ x: 100, y: 100, zoom:
1 }`, its document, viewport and events printed beside it; its query turns options on:
`boxOnDrag=1`, `snap=20`, and since #25 `clickToConnect=1`, `dragHandle=1` (a `grip` drag handle in a and b),
`origin=0.5` (`nodeOrigin`), `panOnDrag=0,1`, `duration=300` (the controls), and since #28
`edgeToolbar=1` (an `EdgeToolbar` on ab), `nodeToolbar=1` (a `NodeToolbar` for a and b),
`edgeType=simplebezier` (ab's type), `field=1` (a text field beside the root), and since #36
`inversePan=1`, `direction=horizontal` (c's resizer), `animated=1` (ab), `nodesSelection=1`;
`minimap-clicks` logs `MiniMap`'s `onClick`). Its suite runs on
Chromium and Firefox: pan, wheel, double-click and pinch zoom, drag (selection, cancel, extent,
snap), connect, reconnect, box select, resize, keyboard and minimap, and (`e2e/gestures.spec.ts`,
#25) auto-pan, animated controls, the middle-button and Space pans, click-to-connect, drag handles,
`nodeOrigin`, a selected node's z-order and the connection line above a selected node, and
(#28) keyboard connections and resizing (`e2e/keyboard.spec.ts`), the edge toolbar, the
several-nodes toolbar and `simplebezier` (`e2e/toolbars.spec.ts`), each with the mouse and with fingers
(`e2e/helpers.ts` `touch`: Chromium's real touch input through the DevTools protocol, touch
pointer events in Firefox), and the 500-node scenario's re-render count; #36's
`e2e/part-options.spec.ts` (inverse minimap pan and its click, a horizontal resizer, the
selection rectangle's drag, `data-animated`) and the selecting hooks scenario (`scenarios.spec.ts`).

Decisions of #6:

- **One background layer per pattern.** `Flow.Background`'s `variant` is a prop, so a theme cannot
  switch it: every example renders `dots`, `lines` and `cross`, and the theme's `--fl-grid-dots`,
  `--fl-grid-lines`, `--fl-grid-cross` (`block` | `none`) show one. Alternative: reading a token in
  JavaScript; refused: not copyable, and a theme change would need a listener.
- **Levels are the gallery's groups** (`level` in the metadata, not Dockable's `category`): the
  Epic named them, and the contract calls them levels.
- **No `_themes/`.** The repository template lists it, but no Fragiola project has one: the
  themes live once in `examples/shared/src/themes`, and the theme contract test is
  `examples/shared/tests/themes.test.ts` (Splitter's place), not a per-app test.
- **No modal example**, so no overlay promotion; the workflow builder's Select is a non-modal
  popup in the frame.
- **Panels beside a root read its model**: the workflow builder makes its model with
  `createFlowModel`, hands it to `Flow.Root`, and the palette, header and inspector outside the
  root read it with `useSyncExternalStore` over `model.subscribe` (`use-workflow.ts`). A panel over
  the canvas, inside the root, marks itself `data-flow-no-gesture` (and `data-flow-no-wheel`).
- **Connection rules are middleware in every example** (`connection-validation`,
  `workflow-builder`): a vetoed handle shows `data-invalid` while dragging.
- **Ports**: the playground takes 5197 (the other Fragiola playgrounds take 5173, and a local run
  reuses a server on its port); the examples' e2e server 4360+.
- **Fixed in the packages, found by the E2E:** a resize corner is above the full-length sides it
  joins (`zIndex: 1`, structural), or a press on a corner resized one dimension; a node whose
  element goes while it stays in the flow (culled by `onlyRenderVisible`, hidden) keeps its last
  size and handle bounds (`measurements.ts`: before, a culled node became unmeasured, was rendered
  again, measured, culled, forever); its kept handles position its edges but are never a
  connection's target, a node rendered again drops the handles it no longer renders, and a node
  removed while not rendered is forgotten on the model's next commit.
- **Known limits:** a reconnect anchor is drawn under its node's handle (edges come before nodes),
  so the mouse grabs it beside the handle; a finger beside a handle lands on the handle
  (Chromium's touch adjustment), so on touch an edge's end is grabbed on its stroke near the end:
  give touch apps a wider `reconnection({ radius })` (the fixture uses 30).

## The Vue examples and the Vue docs (Issue #10)

`examples/vue` (`examples-vue`, private) is `examples/react` in Vue: the 44 examples (35 before #51, 20 before #50, 19 before #33) with the same
ids, metadata, text, names, roles and test ids, and the same scripts (`generate`, `dev` (port
5186), `build`, `typecheck` (`vue-tsc`, TypeScript 6.0.3 pinned in this app, Splitter's), `e2e`,
`test`); `src/examples/README.md` says how an example is written in Vue. Its
`playwright.config.ts` is `examplesE2eConfig("vue")` (port 4361, `/flow/embed/vue/`), so the
Changes job's `examples` output and the E2E matrix include it, and `site:export` builds and
validates `embed/vue/` with its manifest (`project.json` `frameworks`). Vue is in
`COMPLETE_FRAMEWORKS`: every shared spec passes there unchanged, in the five themes.

| path | holds |
| --- | --- |
| `src/examples/<id>/index.vue` | a plain `<script lang="ts">` (header comment, registry, features, data), `<script setup>` (`const Flow = typedFlow<Types, typeof features>()`), the template |
| `src/examples/<id>/*.vue` | the components React writes in the same `.tsx` (an SFC holds one); they import `Types` / `features` from `./index.vue`'s plain script |
| `src/examples/<id>/styles.ts`, plain `*.ts`, `_kit/` | copied from `examples/react` (the adapter's name swapped); `tests/vendored.test.ts` compares them, `workflow-builder/catalog.ts` (Vue icon components) and `use-workflow.ts` (a composable over `model.subscribe`) differ on purpose |
| `src/styles`, `src/lib/cn.ts`, `src/components/families` | the vendored Fragiola UI theme, `cn` and the style families, copied with a "Copied from" first line (`tests/vendored.test.ts`) |
| `src/components/atoms/{badge,fields}.ts`, `src/components/ui/{field,select}.ts` | Vue ports of the React pieces (`defineComponent` + `h`, the same classes; the Select over Reka UI 2.11, Splitter's choice; `Field.Root` gives its label's `for` to the Input's or the Select trigger's `id`), `tests/kit.test.ts` |
| `src/embed/main.ts` | Splitter's Vue embed (the same protocol: `ready` two frames after the example mounts, `resize` for a `flow` layout) |

`tests/examples.test.ts`: every React id, the manifest, copyable imports (`vue`,
`@fragiola/flow-vue` and its eight feature entries, `@lucide/vue`, `#/components/{ui,atoms}/*`,
`#/lib/cn`, since #51 the layout engines `@dagrejs/dagre`, `elkjs/lib/elk.bundled.js` and
`d3-force`, relative), the entry first in the code panel, `<Flow.Root>` in `index.vue`, no class
string, string inside `:class` or `cn()` in a template, no `engine.adapter`; the kit imports no
primitive.

**The docs.** Every snippet that uses the React API sits in `<Framework name="react">`, followed by
its `<Framework name="vue">` twin (a `vue` SFC, or the same `ts` with `@fragiola/flow-vue`) and a
note where Vue differs; framework-free core snippets stay outside the blocks. Installation adds
`pnpm add @fragiola/flow-vue`. `api/primitives/vue` (sidebar: last of "API: primitives") maps
React's API onto Vue's props, events and slots and names every Vue export.

Decisions of #10:

- **The Vue UI pieces are ports, not a registry.** Fragiola UI is React only (shadcn registry);
  the Vue examples wear its classes through copies of the theme and the families, and four small
  Vue ports (Badge, Input, Field, Select) — Splitter's way (its `Switch` over Reka UI). The Vue
  manifest's `registry` is therefore empty (`registryItemOf` reads the vendoring header, which a
  port has not): a Vue reader copies the port from the repository. Alternative: listing the React
  item; refused, it installs React code.
- **Components of one React file become `.vue` siblings** that import the types and the features
  from `./index.vue` (a circular import that resolves at render time), rather than a new plain
  `.ts` React does not have; the copied `.ts` siblings stay byte-for-byte React's.
- **Panels outside the root** read the model through `model.subscribe` into `shallowRef`s
  (`use-workflow.ts`, `onScopeDispose`); panels inside it use the flow ref (`:flow-ref`,
  `flow.value`) or the composables; listeners stop in `onUnmounted`.
- **`snap-to-grid` remounts its root** (`:key` on the grid) with the features of the new size, as
  React's keyed `SnappingFlow`, keeping `<Flow.Root>` in `index.vue`.
- **`SMOKE_PINS` is gone**: `check:package`'s Vue smoke app takes `examples/vue`'s pins
  (`@vitejs/plugin-vue`, `typescript` 6, `vue-tsc`), as React's takes `examples/react`'s.
- **The landing's title drops "for React"** ("Flow — headless node-based editors and diagrams"):
  "for React and Vue" passes the contract's 60 characters, and the next adapters need no edit; the
  Hero's eyebrow lists the frameworks.
- **No adapter or core fix was needed**: every shared spec passed on the first Vue run.
- **#36**: `selection-and-keyboard` adds `Flow.NodesSelection`, `node-resizer` the `banner` node
  (`direction="horizontal"`, a `v-else-if` resizer with its two side handles), `edge-types` the
  `EDGE_OPTIONS` of React; `connected-data` splits React's file into `index.vue`, `number-body.vue`
  and `sum-body.vue` (`useNodesData` given a getter of the connections' sources). Every shared
  spec passed (215) with no adapter fix.
- **#50 (Epic #52)**: `edge-reconnect`'s "Delete on drop" (`@reconnect-cancel`, a native
  `role="switch"` checkbox), `sub-flows`' "Grouping" toolbar (`grouping.vue`), and `shapes`,
  `easy-connect`, `proximity-connect`, `delete-middle-node`, `intersections`, `contextual-zoom`,
  `connection-line`, `edge-markers`, `animating-edges`, `floating-edges`, `editable-edge`,
  `gradient-styling`, `whiteboard`. React's in-file components and contexts became `.vue`
  siblings with props and emits (a constant or helper they share is exported from `index.vue`'s
  plain script); the framework-free siblings and their unit tests (`tests/<id>.test.ts`) are
  React's, unchanged. `delete-middle-node` builds its features per instance in `<script setup>`
  (its `beforeDelete` reads the flow ref), typed by their `ReturnType`. Every shared spec of these
  passed with no adapter fix. #50 found that Vue's `Flow.EdgePath` dropped its default slot
  (React's renders its children), so `animating-edges` drew its dashed path through the `render`
  slot; #51 fixed the adapter (its default slot renders inside the `<path>`, given `{ state }`,
  `packages/vue/tests/render.test.ts`) and the example puts its `<animate>` in that slot, as
  React's.
- **#51 (Epic #52)**: `helper-lines`, `copy-paste`, `collaborative`, `export-image`,
  `stress-test`, `dagre-layout`, `elk-layout`, `auto-layout` and `force-layout`, with the layout
  engines at `examples/react`'s pins; `PENDING.vue` is empty and every shared spec runs in Vue
  (462, none skipped). React's contexts became `provide` / `inject` (`dagre-layout`'s direction,
  `auto-layout`'s actions, `force-layout`'s pinned set), its refs plain variables in `setup`,
  `useKeyPress` + `useEffect` a `watch` of the key's ref (`copy-paste`), and `collaborative`'s
  `Side` a `useSide` composable rendered by a `v-for` (`<Flow.Root>` stays in `index.vue`; a
  remote selection is a node prop, not a provide, which cannot differ per item). Animation
  frames, simulations, the `BroadcastChannel` bridge and pending ELK requests stop in
  `onUnmounted`. `export-image`'s `flow-svg.ts` keeps React's node test (no DOM, as a server
  makes the file). The framework-free siblings and their tests are React's, unchanged. No example
  needed an adapter fix; the stress test led to the large-flow work of
  [the Vue adapter](#the-vue-adapter-issue-9).

## The Svelte examples and the Svelte docs (Issue #13)

`examples/svelte` (`examples-svelte`, private) is `examples/react` in Svelte 5 (runes): the 20
examples with the same ids, metadata, text, names, roles and test ids, and the same scripts
(`generate`, `dev` (port 5187), `build`, `typecheck` (`svelte-check --fail-on-warnings`, TypeScript
6.0.3 pinned in this app, as `packages/svelte`), `e2e`, `test`); `src/examples/README.md` says how an
example is written in Svelte. Its `playwright.config.ts` is `examplesE2eConfig("svelte")` (port
4362, `/flow/embed/svelte/`), so the Changes job's `examples` output and the E2E matrix include it,
and `site:export` builds and validates `embed/svelte/` with its manifest (files `lang: "svelte"`).
Svelte is in `COMPLETE_FRAMEWORKS`: every shared spec passes there unchanged, in the five themes.

| path | holds |
| --- | --- |
| `src/examples/<id>/index.svelte` | `<script module lang="ts">` (header comment, registry, features, data: Vue's plain script as it is), `<script lang="ts">` (`const Flow = typedFlow<Types, typeof features>()`), the markup |
| `src/examples/<id>/*.svelte` | the components React writes in the same `.tsx`, named as Vue's files; they import `Types` / `features` (as types) from `./index.svelte`'s module script |
| `src/examples/<id>/styles.ts`, plain `*.ts`, `_kit/` | copied from `examples/react` (the adapter's name swapped); `tests/vendored.test.ts` compares them; `workflow-builder/catalog.ts` (Svelte icon components) and `use-workflow.svelte.ts` (runes, in place of React's `use-workflow.ts`) differ on purpose |
| `src/styles`, `src/lib/cn.ts`, `src/components/families/{field,foundation}.ts` | the vendored Fragiola UI theme, `cn` and the families the ports use, copied with a "Copied from" first line |
| `src/components/atoms/{badge,fields}/`, `src/components/ui/{field,select}/` | Svelte ports of the React pieces, one folder each (`index.ts`, React's specifier `#/components/atoms/badge`, and its `.svelte` files), the same classes; `Field.Root` gives its label's `for` to the Input's or the select's `id` (`$props.id()`, a context); `tests/kit.test.ts` renders them on the server (`tests/fixtures/`) |
| `src/embed/` | `main.ts` mounts `embed.svelte` (the same protocol: `ready` once, two frames after the example mounts or a 500 ms timeout, `resize` for a `flow` layout, an error through `<svelte:boundary>`) or `embed-index.svelte` |

`tests/examples.test.ts`: Vue's, for Svelte (copyable imports: `svelte`, `@fragiola/flow-svelte` and
its eight feature entries, `@lucide/svelte`, `#/components/{ui,atoms}/*`, `#/lib/cn`, relative; the
markup, the file without its `<script>` / `<style>` blocks, has `<Flow.Root>` in `index.svelte` and
no `class="…"`, string inside `class={…}`, `class:` directive or `cn()`).

**The docs.** Every `<Framework name="vue">` block is followed by its `<Framework name="svelte">`
twin (136 each since #25, as React's): a `svelte` component, or the same `ts` with
`@fragiola/flow-svelte`, and an "In Svelte, …" note where it differs. Installation adds `pnpm add @fragiola/flow-svelte`;
the Hero's eyebrow is `@fragiola/flow · React · Vue · Svelte`; `api/primitives/svelte` (sidebar:
after `vue`) maps React's API onto Svelte's and names every Svelte export.

Decisions of #13:

- **The Select is a native `<select>`** in the field's box (React's trigger classes, `field.row` and
  the chevron; `field-control`, so the row draws the focus ring), its options `Select.Item`s:
  `Select.Root` + `Select.Item` instead of React's five parts. Alternative: a port over Bits UI (the
  Reka UI of Svelte, Vue's way); refused for one inspector field: it adds a dependency with a
  required peer (`@internationalized/date`) and the popup and menu families. The cost: the option
  list is the platform's (readable through `color-scheme`, not themed by the palettes).
- **Ports are folders with an `index.ts`** (a `.svelte` file holds one component), so the examples
  import them by React's and Vue's specifiers; the manifest lists no registry item for them, as
  Vue's.
- **A panel outside the root** reads the model through `useWorkflow(() => model)`
  (`use-workflow.svelte.ts`: `model.subscribe` into `$state.raw`, in an `$effect` that returns the
  unsubscribe; a getter, so another model is followed). **Inside the root**, a component reads
  `useFlow()` as `flow.model` / `flow.engine` (never destructured, as the docs say) and listens
  with `$effect(() => flow.engine.subscribe(…))`; the flow ref's events, `$effect` over
  `flow.current`; window shortcuts are `<svelte:window onkeydown>`.
- **`snap-to-grid` remounts its root** with `{#key grid}`, the nodes kept for the next mount in a
  plain holder (a `$state` would update on every drag step for a value read once).
- **A `.svelte.ts` sibling is imported without its extension** (`./use-workflow.svelte`), which a
  default Vite or SvelteKit tsconfig resolves; `examples-lib` finds it as `<base>.ts`.
- **`smokeVersion` keeps its package fallback**: Svelte's smoke app now takes `examples/svelte`'s
  pins, and the fallback serves the next adapter whose package comes before its examples app
  (Angular).
- **No adapter or core fix was needed**: every shared spec passed on the first Svelte run. The
  review fixed the select's missing focus ring, a duplicate `{#each}` key waiting in
  `connection-validation` (Svelte throws where React warns: keys are the handle ids), the clamped
  minutes not shown back, and the `render` snippet that `minimap-and-controls` shows (React's
  `render`).
- **The docs fixed one broken page**: `concepts/typed-data`'s last Vue block was left open by #10
  (a fence and `</Framework>` missing); a test now fails on an open block.
- **Gotcha, in the docs:** the engine holds no state Svelte tracks, so a template reading
  `engine.can(…)` alone never updates; derive it with a reactive read
  (`$derived(viewport.current && flow.engine.can(…))`).
- **Known limits:** the docs' `svelte` fences are compiled, not type-checked; the kit tests render
  on the server only (no client event test); the native select's option list is unthemed.

#36 in the Svelte examples (React's): `selection-and-keyboard` renders `Flow.NodesSelection`
after the connection line; `node-resizer` the `banner` (`direction="horizontal"`, left and right
`ResizeHandle`s); `edge-types` the step's `stepPosition` and the animated smooth step;
`connected-data` (new: `index.svelte`, `number-body.svelte`, `sum-body.svelte`) sums its inputs
with `useNodeConnections` + `useNodesData(() => connections.current.map(…))`. `tests/examples.test.ts`
compares every React example again; the shared specs pass unchanged (215).

## The Angular examples and the Angular docs (Issue #16)

`examples/angular` (`examples-angular`, private) is `examples/react` in Angular 22 (standalone
components, signals, zoneless, OnPush): the 21 examples (`connected-data` since #36) with the same ids, metadata, text, names,
roles and test ids, and the same scripts as Splitter's Angular app (`generate`, `dev` (port 5188),
`build` (Vite + `@analogjs/vite-plugin-angular`, `tsconfig.app.json`), `typecheck` (`ngc -p
tsconfig.json --noEmit`, strict templates, TypeScript 6.0.3 pinned in this app, as
`packages/angular`), `e2e`, `test` (Vitest with Analog's plugin, a zoneless TestBed for the kit's
render tests)); `src/examples/README.md` says how an example is written in Angular. Its
`playwright.config.ts` is `examplesE2eConfig("angular")` (port 4363, `/flow/embed/angular/`), so
the Changes job's `examples` output and the E2E matrix include it, and `site:export` builds and
validates `embed/angular/` with its manifest (files `lang: "ts"`). Angular is in
`COMPLETE_FRAMEWORKS`: every shared spec passes there unchanged, in the five themes.

| path | holds |
| --- | --- |
| `src/examples/<id>/index.ts` | the header comment, registry, features and data, then the example's standalone component (default export, template inline); the model is a field (`createFlowModel<Types, typeof features>`) given as `[model]`, so `[flowNodesItem]="model"` / `[flowEdgesItem]="model"` type the templates |
| `src/examples/<id>/*.ts` | the components React writes in the same `.tsx` (a node's content, a panel inside the root, the minimap's content), named as Vue's and Svelte's files; they import `Types` / `features` as types from `./index` |
| `src/examples/<id>/styles.ts`, plain `*.ts`, `_kit/` | copied from `examples/react` (the adapter's name swapped); `tests/vendored.test.ts` compares them; `workflow-builder/catalog.ts` (Lucide Angular icon components, rendered with `[lucideIcon]`) and `inject-workflow.ts` (an injection function over signals, in place of React's `use-workflow.ts`) differ on purpose |
| `src/styles`, `src/lib/cn.ts`, `src/components/families/{field,foundation}.ts` | the vendored Fragiola UI theme, `cn` and the families the ports use, copied with a "Copied from" first line |
| `src/components/atoms/{badge,fields}.ts`, `src/components/ui/{field,select}.ts` | Angular ports of the React pieces as directives on the app's elements (`span[kitBadge]`, `input[kitInput]`, `kitFieldRoot`, `label[kitFieldLabel]`, `kitFieldRow`, `kitFieldBody`, `kitFieldInset`), the same classes; `<kit-select>` with `option[kitSelectItem]`s (`[(value)]`), a native `<select>` as Svelte's; `kitFieldRoot` gives its label's `for` to the Input's or the select's `id` (`injectFieldControlId`); `tests/kit.test.ts` renders them in jsdom |
| `src/embed/main.ts` | Splitter's Angular embed (`bootstrapApplication`, zoneless, an `ErrorHandler` showing the error): `ready` once, two frames after the example's first render or a 500 ms timeout, `resize` for a `flow` layout |

`tests/examples.test.ts`: Svelte's, for Angular (copyable imports: `@angular/core`,
`@angular/common`, `@fragiola/flow-angular` and its eight feature entries, `@lucide/angular`,
`#/components/{ui,atoms}/*`, `#/lib/cn`, relative; `index.ts` default-exports its component and its
template has `flowRoot`; no `class="…"` / `class='…'`, string inside `[class]="…"`, `[class.x]`,
`[attr.class]`, `[className]`, `[ngClass]` or `cn()` in a template, and no host class but
`contents`).

**The docs.** Every `<Framework name="svelte">` block is followed by its `<Framework
name="angular">` twin (136 each since #25, as React's): a standalone component in a `ts` fence, a
template excerpt in an `html` fence, or the same `ts` with `@fragiola/flow-angular`, and an "In Angular, …"
note where it differs. Installation adds `pnpm add @fragiola/flow-angular`; the Hero's eyebrow is
`@fragiola/flow · React · Vue · Svelte · Angular` (the title unchanged); `api/primitives/angular`
("Angular directives", sidebar: after `svelte`) maps React's API onto Angular's and names every
Angular export; the primitives' sidebar label lists the four packages.

Decisions of #16:

- **Every example makes its model in a field** and gives it to the root, where React passes
  `defaultNodes` / `defaultEdges`: an Angular template takes no type argument, and the model is
  what types `[flowNodesItem]` / `[flowEdgesItem]` (the smoke app's way).
- **The Select is a native `<select>`**, Svelte's choice (Splitter's Angular app has no Select):
  `<kit-select>` holds it in the field's box with React's trigger classes and the chevron. The same
  cost: the option list is the platform's.
- **Ports are one `.ts` file per React specifier** (`#/components/ui/field` is `field.ts`, its
  parts several directives and a `FIELD` array), Splitter's Angular kit; the manifest lists no
  registry item for them, as Vue's and Svelte's.
- **Panels outside the root** read the model through `injectWorkflow(() => model)`
  (`inject-workflow.ts`: `model.subscribe` in an effect bumping a revision signal, `steps` and
  `edges` computeds over it, the listener stopped by the effect's cleanup; a getter, so an input
  signal works). **Inside the root**, a component calls `injectFlow<Types, typeof features>()`,
  `injectSelection()`, `injectEdges()`…, and listens with `engine.subscribe` stopped by
  `DestroyRef` (or an effect over `flow.current` with `onCleanup`). Page-wide shortcuts are a plain
  `addEventListener` on `DOCUMENT`'s window, not a `(window:keydown)` host binding.
- **What changes on every pan or drag step is read in a component of its own**: the minimap's
  content (`map.state()`, its view box and nodes) is a component on the minimap's element
  (`svg[exampleRouteMinimap]` injecting `FlowMiniMapDirective`), so only it is checked; in the
  example's template it would check every node's view again (#16's review). The docs say so.
- **`snap-to-grid` remounts its root** with a model per grid size, made from the last model's
  nodes, in a one-item `@for` tracked by the model (React's keyed `SnappingFlow`).
- **`edge-types` draws every edge in one `[flowEdge]` group** and branches inside it: a generic
  part does not infer its type from an entity narrowed around it (the adapter's known limit).
- **Fixed in the adapter, found by the specs:** the root's `renderSoon` (see the Angular adapter's
  decisions); no core fix was needed.
- **#36:** `selection-and-keyboard` puts `flowNodesSelection` after the connection line;
  `node-resizer`'s banner has a `direction="horizontal"` resizer with its two side handles;
  `edge-types` gives `step` and `smoothstep` their `pathOptions` (and `smoothstep` `animated`);
  `connected-data`'s number and sum bodies are components of their own (`number-body.ts`,
  `sum-body.ts`, inside `[flowNode]`: the sum's `injectNodeConnections` and `injectNodesData` need
  the node), the sum's ids given to `injectNodesData` as a getter over its connections.
- **Known limits:** the docs' Angular fences are parsed (TypeScript, `parseTemplate`), not type
  checked (39 component snippets were checked once with ngc by hand); a `(dragover)` on the root
  (`add-nodes`, `workflow-builder`) checks the example's template while an outside drag hovers it;
  locally, the smoke apps' and the playground's Vite servers need `CHOKIDAR_USEPOLLING=1` when the
  machine's inotify watchers are used up (an environment limit, not the repository's).

## The site export (Issue #7)

fragiola.com/flow is built by `www` from `pnpm site:export --base /flow --out <dir>`
(`../www/CONTRACT.md` v1.7, the source of truth; guidelines `docs/site.md`). The scripts are
Splitter's (`site/export.ts`, `contract.ts` with `CONTRACT_VERSION = "1.7"`, `dev.ts`,
`dev-proxy.ts`, `sources.ts`), unchanged but for the names:

| output | from |
| --- | --- |
| `project.json` | `site/project.json`: `contract: 1`, slug `flow`, title "Flow", `frameworks: ["react", "vue", "svelte", "angular"]`, `defaultFramework: "react"`, `repository`, keywords |
| `docs/` | `site/docs`, copied as written: `config.json` (the sidebar), `index.mdx` (the landing), every page |
| `examples.json` | built by `sources.ts`: `levels` from `LEVELS` / `LEVEL_TITLES`, `themes` from `THEMES` with each theme's CSS (`examples/shared`) |
| `embed/<framework>/` | `pnpm --filter examples-<framework> build` with `EMBED_BASE=<base>/embed/<framework>/` and `EMBED_OUT_DIR`, against the packages' `dist`, plus `manifest.json` (`buildManifest(examplesApp(framework))`) |

`site:dev` starts each framework's embed dev server (`EMBED_BASE`, a free `PORT`) behind a Node
proxy on `--port` (5185, Flow's dev port, `www`'s `devUrl`); each serves `<base>manifest.json`.

**The pages.** The sidebar is Dockable's IA: Getting started; Concepts; Guides; API: primitives
(`@fragiola/flow-react`, `-vue`, `-svelte`, `-angular`: one page per primitive under
`api/primitives/`, titled by its name alone, plus `hooks`, `flow-ref`, `vue` (the Vue components:
React's API mapped onto props, events and slots, every Vue export), `svelte` (the Svelte
components: React's API mapped onto props, bindings, snippets and attachments, every Svelte
export) and `angular` (the Angular directives: React's API mapped onto directives, inputs,
outputs, templates and injection functions, every Angular export); the
common props on
`api/primitives/root#common-props`); API:
core (`model`, `command-bus`, `commands` (generated), `json-document`, `engine`, `features`,
`path-helpers`); More (`limitations`, "Found a problem?" to the issues). Every `.mdx` but
`index.mdx` is in the sidebar exactly once; only the vocabulary of `docs/site.md`; a title is at
most 60 characters and never contains "Flow" (`www` appends it); a description is 50-160
characters. Snippets are typed and copied from the real API; a page embeds its examples with
`<Example id>`, and every example's `docs` link is a page. The landing: the Hero's actions go
examples, `/ai`, docs (then GitHub), then the `workflow-builder` showcase (`www` puts its agent
band after it), then Sections.

**Kept honest by tests** (`site/tests/`): `contract.test.ts` (the sources pass the contract checks,
and each check catches what it should), `docs-reference.test.ts` (every export of the React
package and of its `/minimap` and `/resize` entries is on its page, every field of every exported
props, state, options or result interface is a table row, every primitive has its page, and the
tables under a primitive's `## Props` and `## State` hold exactly its props and its state's
fields, both ways (a stale row fails too); every
core and feature-entry export is mentioned on an API page, every model and engine key and engine
event is listed, and the members, error codes, document fields, engine payloads, feature options
and path helper options have rows; every registry command has its section on the generated
page; the Vue reference: the Vue package re-exports the core and has React's `Flow` namespace,
every export of it and of its `/minimap` and `/resize` entries is on `api/primitives/vue`, every
prop of every Vue part (`as` included) is a row there or on the part's React page, the slots and
the render slot's fields are rows; the Svelte reference, the same way (the props read from each
component's `<script module>` `Props` interface and what it extends, `PrimitiveProps`' `render`,
`class`, `style`, `ref`; the lowercase callbacks, the render snippet's fields and the
`bind:` props of `typedFlow` have rows on `api/primitives/svelte`), and every Svelte block holds
`svelte`, `ts` or `bash` fences with no React or Vue code, each `svelte` fence compiling (runes)
with no warning (`svelte/compiler`); the Angular reference (#16): the Angular package re-exports
the core and `FLOW` holds every main-entry directive, every React primitive has its
`Flow<Name>Directive`, every export of it and of its `/minimap` and `/resize` entries is on
`api/primitives/angular`, every `input` / `model` / `output` of every directive (aliases read from
the source) is a row there or on the part's React page, and every Angular block holds `ts`, `html`
or `bash` fences with no React, Vue or Svelte code, each `ts` fence parsed by TypeScript 6 and each
component template and `html` fence by `@angular/compiler`'s `parseTemplate` with no error; every
page of `PAGES_IN_EVERY_FRAMEWORK` and every primitive page has as many `vue`, `svelte` and
`angular` blocks as React ones, no `<Framework>` is left open, and no
page has JSX (a `tsx` fence), a `vue` or `svelte` fence, or an import of an adapter package
outside a `<Framework>` block), `dev-proxy.test.ts`, `noindex.test.ts` (every HTML page of the repository is `noindex`),
`command-docs.test.ts` (the generated page).

Decisions of #7:

- **`examples.json` is generated, not committed** (every sibling's choice): the levels and themes
  live once in `examples/shared`, and a committed copy could drift.
- **No `adapters` in `project.json`**: absent, the landing's adapters row is the `frameworks`
  (React). Each adapter Epic adds its framework to `frameworks`; list `adapters` only when a
  package ships before its embed app.
- **No sidebar icons** (contract v1.4, optional), like Dockable and Splitter: an icon for every
  section or none, so none until they are decided for every library.
- **Known limit of the reference test:** the `## Data attributes` tables are hand-written and not
  compared with `engine.adapter.attributes` (only `data-flow-part` is required on every primitive
  page); a new state attribute needs its row by review.
- **Primitive pages live under `api/primitives/`** (the examples' metadata already linked there),
  the core's under `api/` (where `api/commands.mdx` is generated).

## Repository layout

```
packages/react/     @fragiola/flow-react src/components/, src/hooks/, src/utils/, src/<feature>/ (each core
                                         feature's entry; minimap/ and resize/ with their primitives);
                                         entries index.ts, parts.ts, context.ts; tests/ by behaviour
packages/vue/       @fragiola/flow-vue   src/components/, src/composables/, src/utils/, src/<feature>/
                                         (minimap/ and resize/ with their primitives); entries
                                         index.ts, parts.ts, context.ts, typed.ts; tests/ by behaviour
packages/angular/   @fragiola/flow-angular src/lib/directives/ (.directive.ts), src/lib/inject/,
                                         src/lib/utils/, src/lib/context.ts, src/lib/flow.ts;
                                         src/<feature>/ (minimap/ and resize/ with their directives)
                                         and <feature>/ng-package.json; entry src/public-api.ts;
                                         scripts/check-dist.ts; tests/ by behaviour,
                                         tests/fixtures.ts (the flows, as components)
packages/svelte/    @fragiola/flow-svelte src/components/ (.svelte), src/runes/ (.svelte.ts), src/utils/,
                                         src/<feature>/ (minimap/ and resize/ with their primitives);
                                         entries index.ts, parts.ts, context.ts, typed.ts; tests/ by
                                         behaviour, tests/fixtures/ (the flows, as components),
                                         tests/types/ (svelte-check fixtures); svelte.config.js
packages/core/      @fragiola/flow       src/<domain>/ (document, state, commands, model, features,
                                         one folder per feature, engine, geometry, attributes,
                                         connect-session);
                                         entry index.ts; tests/ mirroring src/, tests/types/,
                                         tests/guard.test.ts
                    scripts/             generate-command-docs.ts (site/docs/api/commands.mdx)
apps/playground/    playground           src/shell/ (catalog, view, stage, sidebar, toolbar, source panel),
                                         src/scenarios/<area>/, src/inspector/, src/fixture/,
                                         fixtures/basic/, e2e/ (Chromium + Firefox), tests/
examples/shared/    examples-shared      src/meta/, src/themes/, src/embed/, scripts/, e2e/, tests/
examples/react/     examples-react       src/examples/<id>/, src/examples/_kit/, src/embed/, vendored
                                         Fragiola UI (src/components, src/lib, src/styles),
                                         scripts/vendor-fragiola.ts, tests/
examples/vue/       examples-vue         src/examples/<id>/ (index.vue), src/examples/_kit/, src/embed/,
                                         the copied theme (src/styles, src/lib/cn.ts,
                                         src/components/families), the Vue UI ports
                                         (src/components/{atoms,ui}), tests/
examples/angular/   examples-angular     src/examples/<id>/ (index.ts), src/examples/_kit/,
                                         src/embed/main.ts (the bootstrapped embed component), the
                                         copied theme, the Angular UI ports
                                         (src/components/{atoms,ui}/<name>.ts: directives), tests/
examples/svelte/    examples-svelte      src/examples/<id>/ (index.svelte), src/examples/_kit/,
                                         src/embed/ (main.ts, embed.svelte, embed-index.svelte),
                                         the copied theme, the Svelte UI ports
                                         (src/components/{atoms,ui}/<name>/: index.ts + .svelte),
                                         tests/ (tests/fixtures/: the ports in context)
site/               package.json         export.ts, contract.ts, dev.ts, dev-proxy.ts, sources.ts,
                                         project.json; docs/ (config.json, index.mdx, the pages,
                                         api/commands.mdx generated); tests/: the site checks
                                         (contract, docs reference, dev proxy, noindex) and the
                                         repository's guard tests (layout, .d.ts, package, E2E
                                         selection, CI workflow, bundle guard, command docs)
scripts/                                 check-layout.ts, check-dts.ts, source-condition.ts,
                                         check-package.ts, e2e-suites.ts, check-features.ts
docs/                                    docs-examples-gaps.md: what the docs and examples work
                                         around (F1, …), each with a proposed API;
                                         guidelines-proposal-svelte.md: the Svelte rules proposed
                                         to ../guidelines
.github/workflows/  ci.yml               Checks, Package, Changes, E2E (playground), E2E (examples),
                                         Site export, Trigger www build
```

`pnpm-workspace.yaml` lists `apps/*`, `packages/*`, `examples/*` and `site`.

## Provenance: xyflow

`../references/xyflow` (the xyflow monorepo at commit `29ab9e001`, 2026-11-17: `@xyflow/system`
1.0.0, `@xyflow/react` 13.0.2, `@xyflow/svelte` 2.0.2, `@xyflow/vue` 2.0.2; MIT) is **read-only
and a behaviour reference only**. Its features, behaviour, edge cases and tests are studied;
**no code is copied or ported** (the maintainer's rule). Edge path math, hit-testing, viewport math
and gestures are written fresh, from the behaviour, and tested on our own known points. So no file
carries an upstream header and the `LICENSE` holds only the maintainer's notice; the core guard
fails on a file that names xyflow as its origin. Reviewers compare new algorithms against xyflow
for verbatim structure.

Code reused from another Fragiola repository carries the light header
`// From <Project> (fragiola/<repo>, <path>), same author and licence.`

## Conventions

- Biome: 4-space indent, double quotes, LF, trailing newline, organized imports.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`. Do not relax it;
  a blanket `!` on every index access is not a fix.
- Commits are gitmoji-conventional, in English: `✨ feat(core): …`, `🐛 fix(react): …`,
  `✅ test(core): …`, `🔧 chore: …`, `👷 ci: …`, `📝 docs: …`.
- Branches: `<type>/epic-<n>-<short-description>`; one worktree per Epic under `.worktrees/`.
- Code, docs and commit messages in English.
- **Source layout** (guidelines `repository.md#source-layout`, enforced by `pnpm check:layout`):
  every file and folder name is kebab-case (the kebab-case of its main export); a `src/` is never
  flat: its root holds only the entries (`index.ts`, `parts.ts`, `typed.ts`, `context.ts`,
  `public-api.ts`), everything else lives in a folder named after its domain; an opt-in feature
  gets its own folder. One public function per file, with its types beside it. No barrel files
  inside the folders. A reorganization is its own change.
- Unit tests live in each package's `tests/`, mirroring `src/`; type fixtures in `tests/types/`.
- Every rule a reviewer would otherwise have to remember is a test.
- Every exported member has a one-line `/** … */`; a file opens with a `//` header when its
  purpose or a design choice is not obvious from its name.

## Type safety

- **No `any` in public types.** The core guard checks the exported declarations, and `pnpm build`
  checks every package's emitted `.d.ts` (`scripts/check-dts.ts`).
- **Result objects, not throws**, for anything a caller can get wrong: a command returns a typed
  `CommandResult` (guidelines `architecture/model-api.md`).

## Decisions taken during implementation

Decisions the implementer takes where the Epic is silent (a command, key or feature name not
listed: `model-api.md` naming; xyflow and the guidelines disagree: the guidelines win), each with
its reason.

- **Selection is a document field** (`selected: true` on a node or an edge, absent when not),
  owned by `selection()`. Why: the document stays the single source of truth, `get("flow-json")`
  round-trips the selection, and an undo or a sync sees it like any change. Alternative: a state
  slice outside the document (data-grid's, tree's); refused because the flow's document is its
  whole state. A selected entity that is not selectable is refused (a command) or an issue (a
  document), and one made unselectable is deselected.
- **Unknown command name → `unknown_command`** (Dockable's code); a command of a feature that is
  not installed → `not_found`, naming the feature (the Issue). Both carry `/command` from
  `dispatch` and from a batch step.
- **Which commands are a feature's.** `selection.*` (`selection()`), `node.set-parent`
  (`subflows()`), `edge.reconnect` (`reconnection()`). `node.move`, `node.resize` and `edge.add`
  stay the core's: an app with no drag, resizer or connection gesture still lays out, sizes and
  connects nodes in code (an auto-layout, a loaded template); `drag()`, `resize()` and
  `connection()` are their gestures (engine side, #3).
- **Flags are core document fields** for every feature (`draggable`, `selectable`, `connectable`,
  `deletable`, `hidden`; an edge's `selectable`, `deletable`, `hidden`, `reconnectable`), enforced
  by the commands; only `selected`, `parentId`, `extent` and `expandParent` are a feature's fields.
  `node.move` refuses a node that is not draggable even from code (Dockable's rule: code cannot
  bypass a flag). `node.resize` has no flag (none in D3).
- **`selection.set` takes a `mode`** (`replace` | `add` | `toggle`) rather than three commands, and
  refuses an unselectable or missing id; `selection.remove` is the Delete key's command and skips
  what is not deletable (a parent holding an undeletable child stays), while `node.remove` refuses.
  Removing a node always removes its edges, whatever their `deletable` (an edge never dangles).
- **Edges.** A self loop is allowed (a middleware forbids it, D7); a second edge joining the same
  handles in the same direction is refused (in a document too). `edge.reconnect` takes the whole
  new connection (a handle left out is none). Edge `type` and `data` are optional (`type` none is
  `"bezier"`); a node's `data` is required, a JSON object.
- **Sub-flows.** `extent` is `"parent"` only (no coordinate extent in D2; #24 added a `Rect`). `expandParent` is a
  subflows field (D2's "expand parent"). The model clamps and grows with the sizes the document
  gives (`width`, `height`): without them it clamps at the parent's origin only, so the engine
  (#3) keeps the rules during a gesture with measured sizes; resizing a parent smaller does not
  move its children (the resize gesture, #3, keeps them in). `node.set-parent` keeps a node's place
  on screen. Children may come before their parent in `nodes` (no order rule).
- **The bundle guard reads source maps** (the tree's guard, not data-grid's string markers): the
  core names every feature's keys in `FEATURE_KEYS`, so string markers would always match.
- **Dry runs** never call the app's `createId` (`check`'s id is indicative, from the default
  counters), and a command a middleware issues during `can`/`check` is `refused` (a dry run causes
  nothing). The chain sees a frozen copy of the payload: a middleware rewrites by assigning a new
  object (validated again) and never by writing into it; a middleware may veto a success but never
  turn a failed command into one (a batch stays all or nothing).
- **Typing.** `FlowModel<T, F = FlowFeatures>`: the default "any features" allows every key, and a
  model with features is assignable to it (data-grid's default; the middleware context is a
  distributive conditional, not a mapped type, so the variance check passes). `createFlowModel`'s
  `F` defaults to `[]`: pass `typeof features` with an explicit `Types`. Payload types keep every
  feature's optional fields (a field of a feature not installed is refused at run time, not by the
  type); a batch entry may name any command (`not_found` at run time).
- **Feature options** (engine side, read by #3), with their defaults: `selection({ boxMode: "full",
  multiple: true })`, `drag({ snapGrid, threshold: 1 })`, `resize({ minWidth: 10, minHeight: 10,
  maxWidth, maxHeight, keepAspectRatio: false })`, `connection({ radius: 20, mode: "strict" })`,
  `reconnection({ radius: 10 })`, `keyboard({ step: 5, fastStep: 20 })`, `minimap({ pannable: true,
  zoomable: true })`. #3 extended them: `selection({ boxOnDrag: false })` (any pane drag draws the
  box instead of Shift + drag), `minimap({ padding: 0.1 })` (a share of its size). #24 extended
  them: `selection({ multiKey: ["Meta", "Control", "Shift"], boxKey: "Shift" })` (`SelectionKey`:
  a key, several, or `null` for none), `keyboard({ deleteKeys: ["Delete", "Backspace"] })` (`[]`
  for none), `connection({ clickToConnect: false })`. #32 extended them: `drag({ selectOnDrag: true
  })`, `connection({ threshold: 1, lineType: "bezier" })`, `keyboard({ panOnFocus: true,
  beforeDelete })`; the model option `defaultEdgeOptions`; the document's `focusable` flag (nodes,
  edges) and `reconnectable: boolean | "source" | "target"`. #35 extended them: `minimap({
  inversePan: false, zoomStep: 10 })` (10: the flow's wheel rate), `resize({ snap })` (`{ x, y }`,
  pointer only, independent of drag's `snapGrid`), a resizer's own `direction: "horizontal" |
  "vertical"` (`setPartOptions`; no kept ratio with it); the edge's `pathOptions` (replaced by a
  controlled sync when they change) and its `animated` flag (`edge.set-flags`, `data-animated`).

Decisions of the engine (#3):

- **The engine's surface is the verbs plus `subscribe`, `destroy` and `adapter`** (the tree's
  engine), not `use`/`dispatch`: middleware and untrusted JSON are the model's. `subscribe` hears
  the announcement events (D12); the adapters' view changes are `adapter.subscribe`, separate, so
  an app's listener never runs per measurement.
- **The engine listens to the root itself** (splitter's engine, not the tree's forwarded
  handlers) and resolves every target from the part attributes: an adapter only attaches and
  registers, and the four adapters cannot drift in how they forward events.
- **One structural style file** (`src/engine/structural-style.ts`, the guard's one exception to
  "no `.style`"): the viewport's `transform`/`transform-origin` (D4) and the root's
  `touch-action: none` (without it a browser cancels touch gestures).
- **Feature hooks** extended from #2: `pointerdown(event, target)` returns a `FeatureGesture`
  (`move`, `end`, `cancel`, `active`) instead of `true`, so the engine owns capture, Escape,
  `pointercancel`, a lost capture and a missed release for every gesture; `tap` (a press that did
  not become a gesture and moved at most 3 px: selection's click), `wheel`, `keydown(event,
  target)` (#27: it may return a gesture that goes on without a press, given the next keys first
  by its own `keydown`), `focus`, `attributes`. The host lends the viewport, measured rects, handles, edge
  paths, `keepInParent` (#24: `keepInExtent`, with `absolutePosition`, `positionFor`, `extentOf`,
  `held`), `interactive`, `partOptions`, `changed`, `emit`. A gesture with
  `autoPan: true` (drag, connection, reconnection, selection box, resize; #23) is auto-panned by
  the engine, which calls its `move` again with the last pointer event after each frame's pan, so
  its `move` reads the flow point from the client point (`host.toFlow`), never a client delta
  divided by the zoom.
- **Clicks are taps the engine detects**, not native `click`s: with the pointer captured on the
  root, a browser's `click` targets the root.
- **Sizes: the document's where it gives one, the measured one otherwise** (per dimension), so a
  resize is drawn at once and a node without a size is measured; a 0 × 0 measurement is no size.
  A node whose element goes while it stays in the flow (culled, hidden) keeps its last size and
  handle bounds, never offered to a connection; a removed node's are forgotten (#6).
- **Extent with measured sizes (closes #2's L6).** `host.keepInParent` (`keepInExtent` since #24)
  clamps a drag's and the arrows' positions with the measured sizes before each `node.move`. A
  resize keeps a child inside its parent (the bound wins over `minWidth`, the ratio kept by
  shrinking), never shrinks a parent past its `extent: "parent"` children, and moves the children
  back when the parent's top or left edge moves (one `batch`), so they stay on screen; a parent
  holding a child that is not draggable keeps its top and left edges (its child cannot be moved
  back).
- **Drags.** A press on a selected node drags the selection's draggable nodes (a node whose parent
  is dragged too is carried by it); on an unselected one, selects it (`selection.set`, refused
  silently without `selection()`) and drags it alone. Snap moves the pressed node to the grid and
  the others by the same offset. A cancel (Escape, `pointercancel`, a lost capture) runs a final
  non-transient step back to the start; a resize's cancel too (writing the start size into the
  document); a box selection's cancel restores the selection; a pan's the viewport. A press whose
  release was missed ends at its last move when the next press comes.
- **Connections.** A connection may start from a target handle (the edge is reversed). `strict`:
  only the other type; `loose`: any other handle. The radius is in screen pixels. Reconnection
  grabs an end by a `reconnect-anchor` part, or by a press on the edge within `radius` of an end;
  the line runs from the fixed end. Handle ends go to the handle's centre (D8 measures centres).
- **Edges without a handle** leave the source by its bottom and enter the target by its top.
- **Keyboard.** Delete/Backspace run `selection.remove` with `selection()`, else remove the focused
  node or edge; Enter/Space select; Escape clears the selection (after a gesture's cancel). Arrows
  move the selection, or the focused node, as one non-transient step.
- **Wheel**: `exp(-deltaY / 600)` per wheel, `/ 120` for a trackpad pinch (Ctrl); our own rates,
  not d3-zoom's. A wheel over `other` parts (controls, a field) is left to the page.
- **Known limits:** the minimap drag maps through the view box frozen at the press; a smooth step
  between ends facing each other on one line with the target behind doubles back on itself;
  node presses keep their default (focus), so an app sets `user-select: none` on nodes to avoid
  text selection while dragging. `fit-view`'s own `minZoom`/`maxZoom` narrow the engine's limits,
  never widen them.

Decisions of the animated viewport, auto-pan and pan/zoom options (#23, Epic #26):

- **Animation.** Linear interpolation of `x`, `y` and `zoom` by one eased share (a zoom around a
  point keeps that point still all the way); the first frame starts the clock (frames are the only
  clock, no `performance` read); a duration to the viewport it is already at, a root without a
  window or a window without `requestAnimationFrame` applies at once. Each frame is kept to the
  zoom limits and the extent (an extent may bend the path). `cancel-gesture` counts a running
  animation as something to cancel; Escape still cancels only a press or a pinch, so the keyboard
  feature's Escape (clear the selection) is not lost to an animation.
- **Auto-pan is a flag on the gesture** (`FeatureGesture.autoPan`), not a host method: the engine
  owns the one loop (one pending frame per engine), started by a pointer move of an active
  `autoPan` gesture within `margin` of the root's edge (or past it), run on the root window's
  frames, stopped by the gesture's end or cancel, the pointer leaving the edge, the extent (a frame
  whose pan changes nothing ends it; the next move starts it again), `autoPan: false`, a detach and
  `destroy`. Its viewport changes are `gesture: true`. Speed is per frame (pixels, linear from 0 at
  `margin` to `speed` at the edge and past it), our own defaults (10, 30). Drag and resize now
  compute their delta from flow points (`host.toFlow`), so what is dragged stays under a still
  pointer while the view moves; selection and connections already did. The minimap's drag and a
  pan do not auto-pan.
- **`panOnDrag` buttons.** `true` is `[0]` (a touch and a pen press as button 0), `false` none. A
  non-primary button pans only from the pane (the Issue's "buttons that pan the pane"), and starts
  no feature gesture and no tap (a right click never clears the selection). The context menu is
  prevented while a middle or right pan press is under way, moved or not (macOS and Linux open it
  on press, before any move: otherwise it would open and the right-drag pan never happen), and,
  for the right button only, once after a release that moved (Windows opens it on release). The
  trade-off: with `2` in `panOnDrag`, a right click on the pane opens no menu on macOS and Linux
  (on Windows a right click that did not move still opens it); a middle pan never blocks a later
  keyboard context menu.
- **Activation keys.** Held keys are tracked by `key` and `code` from the root's document
  (`keydown` ignored when its target is in a field: `input`, `textarea`, `select`,
  contenteditable), released on `keyup` anywhere, on the window's `blur` and on a detach. `Meta`,
  `Control`, `Alt` and `Shift` are read from the pointer or wheel event's modifier flags instead.
  The pan key pans even with `panOnDrag: false`, from every target but `other` (fields, controls,
  panels); a key pan never taps (a click with the key held selects nothing). xyflow's "the pan key also
  turns scroll panning on" is left out (not in #23). The zoom key zooms whatever `zoomOnScroll`
  says (it is the explicit request), at the wheel's rate (the pinch's with Ctrl); Apple platforms
  are told by `navigator.platform` / `userAgent` (`Mac`, `iPhone`, `iPad`, `iPod`).
- **`panOnScrollMode`.** Shift turns a vertical-only wheel sideways except in `"vertical"` mode
  (there Shift + wheel still pans vertically); `"horizontal"` ignores a plain wheel's vertical
  delta (symmetric with `"vertical"` ignoring horizontal ones). `panOnScrollSpeed` defaults to 1, today's behaviour.

Decisions of the configurable keys, click-to-connect, drag handles, node origin and extent, and
z-order (#24, Epic #26):

- **Keys.** `selection({ multiKey, boxKey })` take a key, several (any held) or `null`, matched by
  `host.held` (the engine's activation-key tracking: `Meta`, `Control`, `Alt`, `Shift` from the
  pointer event's flags, any other `key`/`code` from the root's document). `multiKey` defaults to
  `["Meta", "Control", "Shift"]`, not the Epic's "Meta/Control": a Shift click toggled before #24
  and its tests stay green; an app that wants Shift for the box only passes `multiKey:
  ["Meta", "Control"]`. `multiple: false` still turns toggling off. `boxKey: null` leaves the box
  to `boxOnDrag`. `keyboard({ deleteKeys })` matches `KeyboardEvent.key` or `.code`; Enter/Space's
  toggle modifiers stay the keyboard's own (features talk only through keys, and the keyboard does
  not read the selection's options).
- **Click-to-connect is a gesture that outlives its press** (see the tap tolerance below). `FeatureEngine.tap` may return a
  `FeatureGesture`: the engine keeps it as the gesture under way without a press, moves it on every
  primary pointer move (the hover), and gives it the next primary press (no other gesture starts,
  no pan; a press on `other` parts, the controls, leaves it waiting; the pan key still pans); that
  press's release is its `end`, a drop at that point: within `radius` of an eligible handle it
  connects through `model.can("edge.add")` (`connect`), a vetoed one `connect-cancel { refused:
  true }`, anywhere else `connect-cancel { refused: false }`. Escape, `cancel-gesture`,
  `set-interactive false`, a detach and `destroy` cancel it (Escape from anywhere in the page). So a tap on the pane that cancels it
  does not also clear the selection (the press is the connection's). The session is the drag's
  (`connect-session`), started at once (`connect-start`, `connection` non-null, `data-connecting`).
  Why the engine and not a feature flag: the engine owns Escape, capture and the press routing for
  every gesture (#3's decision), and the walk order of the features' `tap` hooks would otherwise
  let `selection()` take the cancelling tap.
- **Drag handles** are resolved in the press target (`dom.ts`): a press on a node that holds a
  `data-flow-drag-handle` element (one whose nearest node part is that node) outside it is a
  `node` target with `outsideDragHandle: true`; `drag()` skips it, so it neither drags nor pans,
  and its tap still selects. `DRAG_HANDLE_ATTRIBUTE` is the exported name.
- **`nodeOrigin` applies to the nodes on the flow; a child's position stays its box's top-left
  corner in its parent's box.** Why: the model's sub-flow rules (`extent: "parent"` clamping with
  the document's sizes, the resize's children rules) work in the parent's top-left box and know no
  origin; a child placed from its parent's corner keeps them exact, whatever the origin. xyflow
  applies the origin to children too; a per-node origin was not needed (the Epic: an engine option
  only; Epic #40 adds the node's `origin` under the same child rule). One helper, `nodeBox(position, size, origin)` (`geometry/rect.ts`), turns a position and
  a size into a box; the engine's node box (`boxOf`: the parent's corner plus the position, then
  `nodeBox`) feeds `node-rect-by`, the handles' centres, edge ends, `nodes-bounds`, `fit-view`,
  `visible-nodes`, `visible-edges`, the minimap, `node-toolbar-by`, `focus-node`'s reveal, the
  selection box's hit test, drag, the arrows and resize (which works on the absolute box and turns
  it back into a position once, `host.positionFor`). The model's `absolute-position-by` stays the
  sum of positions (an adapter without an engine, the server render, uses it). Known limits with an
  origin other than `{ 0, 0 }`: `node.set-parent` keeps the place on screen as if it were 0, 0, and
  `expandParent` grows a parent on the flow around its origin (its children shift by the origin's
  share of the growth).
- **Extent.** A `Rect` extent stays a `subflows()` field (D3 names `extent` with `parentId`; a
  rectangle on a node with no parent therefore needs `subflows()` installed); it is in the
  coordinates of the node's position (relative to its parent's top-left corner for a child). The
  engine keeps a node's box inside the intersection of its parent's box (`"parent"`, measured),
  its `Rect` and the engine's `nodeExtent` (`host.extentOf`, `host.keepInExtent`) during drags,
  the arrows and resizes (a box larger than its bounds keeps to their top-left corner); the model's
  own clamp stays `"parent"` only, with the document's sizes (a rectangle is kept by the gestures,
  not by `node.move` from code). `node.set-parent` takes a `Rect` and keeps it without a parent
  (`"parent"` is dropped there, as before); controlled props compare extents by value.
- **z-order within each layer** (the Epic's decision: edges never over nodes). A node's
  structural `z-index` (`node-z-index-by`) is its `zIndex` (0 without), plus 10 000 when it is
  selected and `elevateNodesOnSelect` is on (our own raise), and always at least its parent's + 1,
  so a selected node's descendants are raised with it and a child is above its parent. An edge's
  order (`drawn-edges`) is its `zIndex`, plus 10 000 when selected with `elevateEdgesOnSelect`,
  stable among equals (the document's order). Why a read and not an attribute: `z-index` is style,
  not state, and an SVG has no `z-index`; the adapters (#25) apply the number to the node's
  structural style and render `drawn-edges` instead of their own filter. `node.set-z-index` and
  `edge.set-z-index` (core commands: an app with no feature raises a node in code too; `null` puts
  the default back) set it in place, and controlled props (`commands-to`) emit them, so a raise
  keeps the node's edges and measurements (replacing it, the first choice, removed and re-added
  them). D6's catalogue grows by these two.
- **A drag step is computed from the start, never accumulated.** Each step (and the drop, from the
  release's point) puts every dragged node's start box at the pointer's travel and turns it into a
  position against its parent's corner as it is then (`host.positionFor`), so a child whose parent
  grows (`expandParent`) past its left or top edge stays under the pointer.
- **Click-to-connect and the tap tolerance.** With `clickToConnect`, a handle's drag starts only
  past the engine's tap tolerance (`TAP_TOLERANCE`, 3 pixels, `engine/tap.ts`), so a tap that
  jitters still starts a connection; without it, a drag starts after 1 pixel, as before. Escape
  cancels a waiting connection from anywhere in the root's document (its `keydown` listener, #23's),
  since the handle's press may have kept the focus outside the root.
- **Resizing a node already past its bounds** gives it its least size (`minWidth`/`minHeight`) on
  that side instead of a negative one.

Decisions of the docs, examples and E2E of the new options (#25, part 2, Epic #26):

- **The playground's fixture takes query options** (`clickToConnect`, `dragHandle`, `origin`,
  `panOnDrag`, `duration`) rather than a second fixture page: the specs keep one known layout
  (800 × 500, viewport at `{ x: 100, y: 100 }`) and `openFixture`'s checks. The three new
  `gestures/` scenarios are for a human (controls over every option, the inspector beside); a
  scenarios spec only proves they render without an error.
- **An animation is proven by its frames**: the specs sample the viewport element's computed
  `transform` on every `requestAnimationFrame` after the press and expect zooms strictly between
  the start and the end (and none without `duration`). Specs that read a zoom after a button wait
  for it to settle (two equal polls), so they pass with or without an animation.
- **The examples use what a reader would copy**: a title-bar drag handle (the common node UI) and
  a 200 ms animation on the controls; auto-pan, the pan key and elevate-on-select are defaults, so
  every example already has them. `nodeOrigin`, `nodeExtent` and click-to-connect stay in the
  docs and the playground: no example needs them, and a gallery example built only to show an
  option would not be one an app copies.
- **The drag handle is the literal attribute** (`data-flow-drag-handle`) in the examples and the
  docs, identical in the four frameworks; `DRAG_HANDLE_ATTRIBUTE` is named for code that builds
  it.
- **Edges over nodes and a per-node origin are "Not yet"** in `limitations.mdx` (a cost decision,
  not a principle; Epic #40 closed both, and the first-render note); the first render's top-left placement and missing `z-index`, the overridden
  `z-index` and the gesture-only extent rectangle are known limits there.
- **What the specs and the review changed in the packages**: the docs, examples and specs of this
  part passed on their first run, but the Epic's review then fixed the adapters and the core
  (3736fd0: the nodes' layer is its own stacking context, `isolation: isolate` in the four
  adapters, so a raised node never covers the connection line, with a playground spec; 08de796: a
  node without a parent gets its z-index without walking a chain; 4d6b834: Vue's `duration` and
  `pan-on-scroll-speed` take a number's text). The `node.move` / `node.resize` descriptions now
  say the model keeps `extent: "parent"` only (a rectangle is the gestures').

Decisions of the graph and geometry helpers, the toolbars and the keyboard flows (#27, Epic #29):

- **Neighbours are graph facts** (`incomers-by`, `outgoers-by` on the model): the nodes at the
  other end of the edges that end at (start from) a node, in the document's **node** order (not
  the edges'), each once however many edges join them. A self loop makes a node its own incomer
  and outgoer (the edge does come in and go out); hidden nodes and edges count (hidden is a view
  flag); a missing node has none. A parent is a neighbour of its child only through an edge.
- **`intersecting-nodes` compares engine boxes** (`boxOf`: measured or given sizes, `nodeOrigin`,
  a child at its parent's corner). Any shared area by default (`partial` true; touching sides do
  not count, a zero-size `rect` strictly inside a node does: a point query); `partial: false`
  keeps the nodes wholly inside. Hidden nodes, nodes of unknown size and the queried node are left
  out; `nodeId` wins over `rect`; a bad payload answers `[]`. A parent and its children intersect
  (nothing filters the hierarchy: an app that wants otherwise filters by `parentId`).
- **`viewportForBounds(bounds, width, height, { padding, minZoom, maxZoom })`** (defaults 0.1,
  0.5, 2) is `fit-view`'s framing moved into its own pure file, the old `fitBounds` gone with
  identical numbers (a `maxZoom` below `minZoom` still wins, as before, so `fit-view`'s results
  are unchanged; its tests kept their expected values). The engine read defaults the limits to the
  engine's and returns the viewport `fit-view` would set (`kept`: zoom limits and translate extent
  applied), so `engine.run("set-viewport", read)` lands exactly there; a padding or limit that is
  not a number is the default; undefined without a root size or a valid rectangle.
- **`simpleBezierPath`**: each control point on its end's side axis, halfway (signed) to the other
  end's projection on that axis; no least reach and no `curvature` (unlike `bezierPath`), so a
  target behind turns back at once and a side and its opposite draw the same curve. The label is
  the curve's `t = 0.5`. `"simplebezier"` joined `BuiltInEdgeType` (the schema's `type` is a
  string: only its description changed, and `commands.mdx` was regenerated).
- **`edge-toolbar-by`** stands at the edge's drawn label point (default) or one of its ends, on the
  screen (root-relative, outside the zoom), moved by a screen `offset` (`XY`, pixels), with the
  toolbar's centre there (`anchorX`/`anchorY` 0.5: no `align`, an app moves it by `offset`);
  undefined until `edge-path-by` is. `EdgeToolbarPosition` is `NodeToolbarPosition`'s shape.
  **`node-toolbar-by` takes `nodeIds`**: beside the bounds of those of known size (`nodes-bounds`'
  boxes), winning over `nodeId` when not empty; the one-node payload is unchanged (`nodeId` became
  optional in the type). The `toolbar` part takes `{ edgeId }` too.
- **The keyboard reaches connection and resize through keyboard links**
  (`src/features/keyboard-links.ts`, core code: `host.shared("keyboard-links")`), never by
  importing them: `connection()`'s engine side fills `links.connect` (the session's `keyboard`),
  `resize()`'s fills `links.resize` (one step with the pointer resize's own `resizedRect`, `kept`
  and `stepOf`: limits, a resizer's own, the aspect ratio, extents, children moved back, a fixed
  child's parent keeping its top and left), and `keyboard()` reads them lazily (at a key or an
  attributes call), so the install order does not matter and an empty link means "not installed".
  The keys' meaning stays the keyboard's; the session work stays the connection's (no
  connect-session code in a keyboard-only bundle). Alternative: `keyboard()` importing the
  connect-session folder (the guidelines' shared folder); refused, it ships the session to apps
  without `connection()`.
- **Focusability is a part attribute**: with both features, a connectable handle's record (and
  its node connectable) holds `tabindex: "0"`, every resize handle's too with `resize()`; without
  both, no record changes, so the tab order of every other app is the same (tested both ways and
  in either install order). Not an engine `is` key (`node-focusable`'s way): the Epic asked for the
  attributes, and every adapter already spreads them (#28: React must pass it as `tabIndex`).
- **A keyboard connection is a gesture without a press**, the click-to-connect one's mechanism:
  `FeatureEngine.keydown` may return a `FeatureGesture` (the engine keeps it as `following`), and
  `FeatureGesture.keydown` takes the next keys before the features (the gesture is over once its
  `active()` answers false). So Escape (in the root or anywhere in the page), `cancel-gesture`,
  `set-interactive false`, a detach and `destroy` cancel it with no new code, and Escape never
  also clears the selection. A pointer press while it waits cancels it (its `end`); pointer moves do
  nothing. **It keeps to its source handle** (#27's review): only keys whose target is inside that
  handle are its own (a field's Space, a toolbar button's Enter reach them untouched), it cancels
  when focus leaves the handle (`focusout`: a field clicked, a button focused, the window left) and
  when its source node goes away (a model commit without it: a delete key, code); the engine
  forgets a waiting gesture whose `active()` turned false before every press, move, key and
  `cancel-gesture` (`dropEnded`). Delete keys are not swallowed while it waits: they remove as
  usual, and removing the source node cancels the connection first. A held Enter's or Space's
  repeats (`event.repeat`) neither start nor connect (a repeat while it waits is taken, so the page
  does not get it either).
- **Keys of a keyboard connection**: Enter or Space (no Ctrl, Alt, Meta) on a focused handle
  starts; Tab / ArrowRight / ArrowDown point at the next target, Shift + Tab / ArrowLeft / ArrowUp
  the previous, round the list; Enter or Space connect (`edge.add`, one non-transient commit);
  Escape cancels. Focus stays on the source handle (Tab is prevented while it waits): the target
  is the connection's `to`, `data-valid` on its handle, the line drawn to it, and a
  `connect-target` event. The targets are the handles a drag could reach (`eligible`: measured,
  connectable, the mode's types, connectable nodes, not the handle itself) that
  `model.can("edge.add")` accepts at the start (a vetoed one is skipped, not marked), nearest to
  the source handle's centre first. None accepted: it still starts (`connect-target` with `index`
  -1, `count` 0) and Enter cancels (`refused: false`); a veto arriving after the start makes Enter
  `connect-cancel { refused: true }`.
- **`input` on the connection events, `source` on `resize`**: `connect.source` already names the
  source node (D5's edge end), so the connection events (`connect-start`, `connect`,
  `connect-cancel`) carry `input: "pointer" | "keyboard"`; `resize` carries `source` like
  `nodes-move`; both typed `MoveSource`. The reconnection events are unchanged (pointer only).
  `connect-target` has no text (D12): `index` (0-based) and `count` are for the app's live region.
- **Keyboard resize keys**: an arrow on a focused resize handle moves the sides that handle moves
  by `step` (`fastStep` with Shift) flow units, one final `node.resize` (a `batch` with the
  children's moves) and a `resize { source: "keyboard" }` event; an arrow across the handle's sides
  (ArrowUp on `right`) and any arrow with Ctrl, Alt or Meta is not the resizer's (left to the
  keyboard's other uses and the page); at a limit the key is still taken (no scroll) and nothing
  runs. Without `resize()`, the arrows on a resize handle move the selection as before.
- **Known limits:** a keyboard connection's targets are fixed at its start (a handle registered
  meanwhile is not offered); it does not scroll the target into view; reconnection has no keyboard
  path; a pointer press while it waits only cancels it (the press does nothing else).

Decisions of the toolbars and keyboard handles in the adapters (#28, Epic #29):

- **`EdgeToolbar` is `NodeToolbar`'s mechanism** (part `toolbar`, file `edge-toolbar.*` in every
  adapter, Angular `FlowEdgeToolbarDirective` / `flowEdgeToolbar` in `FLOW`), placed outside the
  zoom at `edge-toolbar-by` with `translate(x, y) translate(-50%, -50%)` (the anchor's 0.5), so it
  follows pan, zoom and node moves from the engine's notifications. Props / inputs: `edgeId`
  (default the enclosing edge's), `position` (`"label"` default, `"source"`, `"target"`), `offset`
  (`XY`, screen pixels), `open` (default: while its edge is selected, `edge-selected`; an explicit
  value wins). No hook / rune / injection function: `NodeToolbar` has none either.
- **Its state names the prop's point `position` and the anchor `anchor`**: `{ edgeId, position,
  anchor: EdgeToolbarPosition }`. `NodeToolbarState.position` is its anchor, but on the edge
  toolbar `position` is a prop (the core payload's name), and one name with two meanings on one
  part was refused.
- **`NodeToolbar`'s `nodeIds`**: when not empty it wins over `nodeId` (the core's rule), needs no
  enclosing node, carries no `data-flow-id` (`attributes("toolbar", {})`), and is shown by default
  while **every** listed node is selected (an app passing the selection's ids shows it for the
  selection; a list partly selected hides it); its state gained `nodeIds` (the nodes it stands
  beside, `[nodeId]` for one) and `nodeId` became `string | undefined`. Alternative: shown while
  any is selected; refused, a toolbar acting on several nodes would show for a selection it does
  not match.
- **Handles and resize handles spread the engine's record** (`attributes("handle", …)`,
  `attributes("resize-handle", { nodeId, position })`), so `tabindex="0"` reaches them only with
  `keyboard()` and their feature (each adapter's `tests/toolbars.test.*`, both ways); before #28
  the resize handles spread a static record. Their state attributes follow the engine's
  notifications, so a keyboard connection's `data-connecting` / `data-valid` move with Tab (tested
  end to end in each adapter: Enter, Tab, Enter adds the edge; an arrow on a focused resize handle
  resizes). No adapter handles or stops a key: the engine listens on the root.
- **A hidden toolbar reads nothing of the view** (#28's review): each toolbar's reader decides
  `open ?? selected` first (the edge's, or every listed node's) and, hidden, returns `undefined`
  without calling `edge-toolbar-by` / `node-toolbar-by` or `attributes`, so a pan or a zoom gives
  the same value and nothing renders again (before, every toolbar of every edge re-rendered on
  every frame: a fresh anchor each read, 171 renders for 19 hidden edge toolbars over 10 frames).
  Shown, the value is compared by its fields (`sameValue`: the anchor's `x`, `y`, `anchorX`,
  `anchorY`), so an unchanged view renders nothing either. Tested by render counts over pan frames
  (React's `Profiler`, Vue's `onVnodeUpdated`). While hidden, Angular's element carries no
  attributes (it is out of the document anyway). Also tested: a toolbar given an `edgeId` renders
  nothing once its edge is removed (and comes back with it), `nodeIds` of none falls back to the
  node, Vue's direct `Teleport` outside `Flow.Edges`, the missing-edge error in Vue (an
  `errorHandler`), Svelte (the mount rejects) and Angular (the `ErrorHandler`), and Svelte's
  portal content leaving the root with the toolbar or the root.
- **`simplebezier` needs no adapter code**: the default `EdgePath` takes `d` from `edge-path-by`;
  each adapter's test draws one. No adapter enumerates the built-in types.
- **Parity tests**: each adapter's `index.test` lists `EdgeToolbar` among the primitives (Angular
  `FlowEdgeToolbarDirective`), its contract test has an edge-toolbar case on part `toolbar`
  (`slot: "edge-toolbar"`, `open`), and `site/tests/docs-reference.test.ts` maps the new module to
  `api/primitives/edge-toolbar.mdx`.

Decisions of the docs, examples and E2E of the helpers, toolbars and keyboard flows (#28, part 2,
Epic #29):

- **The edge toolbar lives in `edge-labels`**, not a new example: the toolbar and the labels share
  the label point, so one example shows the difference (a label zooms, a toolbar keeps its size).
  `build-lint` starts selected (as `node-toolbar`'s first note), the edges get a wide transparent
  hit path, and the toolbar flips a status (`edge.set-data`) and removes the edge. The gallery
  stays at 19 examples; `edge-toolbar.mdx` and `custom-edges.mdx` embed `edge-labels`.
- **The selection's toolbar stands below the notes and each note keeps its own** in
  `node-toolbar`: rendered while two notes or more are selected (`useSelection` /
  `injectSelection`), it recolours them (one `batch` of `node.set-data`) or deletes them
  (`selection.remove`). Hiding the per-node toolbars meanwhile needed the selection in every
  node's toolbar (and, in Angular, outside the root's injection context); refused for an example a
  reader copies.
- **`selection-and-keyboard` installs `connection()`** (its handles were already drawn) and names
  each handle (`<label> input` / `output`); the shared spec's Tab walk now expects a node's two
  handles after it, as the playground's does. `announcements` names its handles too and says
  `connect-start` (keyboard only), each `connect-target` (`Target 1 of 2: Hall.`), `connect`
  with "with the keyboard" and a keyboard cancel.
- **The fixture takes query options** again (`edgeToolbar`, `nodeToolbar`, `edgeType`, `field`):
  one known layout for every spec. The keyboard specs read the pointed-at handle from
  `data-valid` and the `connect-target` events rather than a target order, so a font or a size a
  pixel off does not change them; an edge is selected for its toolbar with the keyboard (a press
  on b would select b), and positions after a zoom or a move are polled (`toPass`) or settled
  (two equal viewport polls), never waited for.
- **Docs**: the API references (`model.mdx`, `engine.mdx`, `path-helpers.mdx`, the primitives)
  came with #27 and part 1; part 2 wrote the task sections: `guides/keyboard.mdx` (draw an edge,
  resize, announce, known limits), `guides/resizing.mdx#from-the-keyboard` (named handles: an
  `aria-hidden` handle that takes focus hides it), `guides/custom-edges.mdx` (`simplebezier`, a
  toolbar on an edge), `guides/selection.mdx` (a toolbar for the selection),
  `concepts/viewport.mdx#frame-an-area` (`viewport-for-bounds`, and `viewportForBounds` for an
  export, imported from `@fragiola/flow`: a React import outside a React block fails the docs
  test), `guides/custom-nodes.mdx` (neighbours, overlaps), `concepts/handles-and-connections.mdx`
  and `getting-started/accessible-names.mdx`. Model and engine reads stay plain `ts` blocks (the
  same in every framework).
- **`limitations.mdx`** drops the several-nodes toolbar and keyboard connections and resizing from
  "Not yet"; keyboard reconnection is not a "Not yet" row (xyflow has none either) but a known
  limit, beside the targets fixed at the start, no scroll into view, a press only cancelling, and
  handles needing a name once they take focus. The `Panel` / `ViewportPortal` /
  `EdgeLabelRenderer` row is unchanged.
- **No package change**: every spec of this part passed against the adapters and core as part 1
  left them.
- **The Epic review's follow-ups.** Every focusable handle of an example has a name:
  `workflow-builder` (`<title> input`, `<title> output`, `<title> output: yes`), `undo-redo` and
  `node-resizer` (`Resize <id>: <position>`, which now installs `keyboard()`, so keyboard resize
  runs end to end in the four apps, and names its now focusable nodes); the smoke spec's "whatever
  takes focus is named" covers shown handles and resize handles too, and `expectNamedHandles` (`e2e/examples/helpers.ts`) checks every
  shown handle that takes focus. `connect-start` and the first `connect-target` come in one tick, so
  a separate start message was replaced in the live region at once: `describe` takes the node a
  keyboard connection started from and says the start, the first target and the keys in one
  message (the listener keeps `startedFrom` until that target), in `announcements` and
  `guides/keyboard.mdx` (four frameworks). A default `NodeResizer`'s eight handles cannot be named,
  so `resizing.mdx` and `limitations.mdx` say to pass your own `ResizeHandle`s with `keyboard()`;
  the playground's scenario names its own. The playground spec asserts an arrow across a resize
  handle's sides reaches the page with its default kept (`defaultPrevented` false on the window).

Decisions of the interaction options and gesture events (#32, Epic #34; React Flow's props studied,
none of xyflow's code):

- **Taps are the engine's.** The pointer is captured on the root at every press, so a browser's
  `click`, `dblclick` and (during a press) `contextmenu` target the root. A tap is a primary press
  released within the tap distance (`paneClickDistance` on the pane, `nodeClickDistance` on
  anything else, both 3 px by default: React Flow's 0 would make a jittery click a pan) that
  started no gesture, was no key pan, no click-to-connect follow press and opened no context menu.
  The tap events (`node-click`, `edge-click`, `pane-click`) are told after the features' `tap`
  (the selection is already changed), and also while the flow is not interactive (they change
  nothing). A pan that stayed within the pane's tap distance is still a tap (its few pixels stay),
  as React Flow's `paneClickDistance` reads. A double click counts when the last press was a tap
  (`released`, cleared by every new press), on that press's target; a `dblclick` on a control
  (`other`) is the control's; the pane's still zooms (`zoomOnDoubleClick`), a node's no longer
  does. A context menu during a press is the press's (its release is then no tap); several
  selected nodes take a menu on one of them as `selection-context-menu` (no selection rectangle
  part exists: React Flow's `NodesSelection`). The events carry the DOM `event`: the app prevents
  the browser's menu itself.
- **A viewport move** starts at its first change (`viewport-change-start`, the viewport before it)
  and ends once nothing holds it: no press, pinch, animation or resting wheel, and no press or
  wheel being handled (the minimap's press centres before the press exists). The wheel ends after
  150 ms at rest (`WHEEL_REST`, on the root window's `setTimeout`; without one at once). An action
  without `duration` starts and ends at once; a stopped animation ends its move at once (even inside
  a press). `gesture` is the first change's.
- **Per-kind interactivity is engine state** (`Interactivity`, `host.allows(kind)` read when a
  feature acts; nothing is installed again). `drag`: node drags and the arrows; `connect`: drags,
  taps, Enter on a handle (whose `tabindex` goes); `select`: taps, the box, Enter/Space and a
  drag's select-on-drag; `reconnect` (and `connect`: moving an end connects it anew, so the lock,
  which turns `connect` off, stops reconnection too, as React Flow's does: one under way is
  cancelled). A resize and the delete keys follow `interactive` only.
  Turning a kind off cancels only a gesture of that kind (`FeatureGesture.kind`); `interactive:
  false` cancels everything, as before. No engine option per kind (React Flow's
  `nodesDraggable`, … props): the switches are `set-interactive`'s, the Controls' lock in #33.
- **`preventScrolling`** prevents the wheel's default over every flow part but `other` and
  `data-flow-no-wheel`, whatever the wheel does; `false` gives the page a wheel the flow does not
  use (before #32 that was the only behaviour).
- **Auto-pan per gesture**: `FeatureGesture.autoPan` names its kind (`"node"`, `"connect"`,
  `"selection"`, `"resize"`), `autoPans(option, kind)` reads `AutoPanOptions`' switches (absent:
  on); `true` stays "any".
- **Focusability**: `focusable` is a core document flag on nodes and edges (default true, set by
  the flag commands, synced by `commands-to`); `node-focusable` / `edge-focusable` (keyboard) also
  read `host.focusable(kind)`, the `nodesFocusable` / `edgesFocusable` options.
- **`reconnectable: "source" | "target"`** moves that end only: `edge.reconnect` refuses a payload
  moving the other end (`/source` or `/target`, code can't bypass it), `edge-reconnectable` takes an
  optional `end`, a press near (or the anchor of) the fixed end grabs nothing, and `commands-to`
  replaces an edge whose wanted ends move an end that may not. `edgeFlag(edge, "reconnectable")`
  is true unless false; `reconnectableEnd(edge, end)` the per-end answer.
- **`connectableStart` / `connectableEnd`** are a handle's registration fields (`FlowHandle` has
  them, `connectable` included): a start-only-not handle starts no drag, tap or keyboard
  connection and gets no `tabindex`; an end-only-not handle is never `eligible` (drags, keyboard
  targets, reconnection drops).
- **`connection({ threshold, lineType })`**: `threshold` is the 1 px a drag needed before (with
  click-to-connect the start waits past the larger of it and `nodeClickDistance`); `lineType` draws
  the line through `host.path(type, ends)`, the engine's path helpers with its `pathOptions`.
- **`drag({ selectOnDrag: false })`** drags an unselected node alone and keeps the selection.
- **`keyboard({ panOnFocus, beforeDelete })`**: `beforeDelete(nodes, edges)` gets what the delete
  key would remove (`selection.remove`'s dry run, or the focused node's or edge's), answers
  `true`, `false`, a `{ nodes, edges }` subset (only what it was asked about; a node still takes
  its edges and children) or a promise of one. A promise takes the key at once and blocks the next
  delete keys until it settles; then only what is still there and deletable goes, in one step (a
  `batch` of `edge.remove` / `node.remove`, not `selection.remove`: a middleware keyed on
  `selection.remove` does not see a delete made through `beforeDelete`), unless the engine was
  destroyed or the flow locked meanwhile; a rejection removes nothing. The model's middleware
  stays synchronous.
- **`defaultEdgeOptions`** is a model option (`DefaultEdgeOptions<T>`: type, data, `zIndex`,
  flags; never an id or an end), validated once against the edge schema (a `TypeError`), merged
  under every `edge.add` payload in the bus before the middleware (runs, dry runs, batch steps).
  `commands-to` merges it under the wanted edges too, so a controlled edge the defaults filled is
  synced once, not on every render: under a new edge every default, under an edge the model holds
  only the defaults it holds the same value for (a document edge, loaded without them, is not
  rewritten by them when the controlled list changes). The document's edges load as they are (React Flow also applies
  them when rendering; ours are data in the document).
- **Resize steps are the transient `node.resize` commands** (`model.subscribe`, `onNodesChange`):
  no `resize-step` event; `resize-start` (at the size it starts from) and `resize-cancel` frame
  them, `resize` stays the end.
- **The cancel events tell where they ended** (`ConnectionDrop`: `dropped`, `from`, `to`, `client`,
  `point`): a release's point, a cancel's last pointer point (Escape), a keyboard connection's
  target centre (or its start's) with `client` from `host.toClient`. `reconnect-cancel` names the
  moved `end`. `dropped` is `true` for a release (or a keyboard confirm) and `false` for a cancel
  (Escape, `cancel-gesture`, the lock, a `pointercancel`), so "drop on the canvas adds a node"
  adds nothing on a cancel (React Flow's `onConnectEnd` fires on release only).
- **`ready`** is told once per engine, at the first measurement flush with a sized root, every
  shown node measured and a pending `fitView` done (`is("ready")`). Known limit: an empty flow whose
  root measured 0 × 0 when attached is not ready until something is measured again (the root is
  not observed).

Decisions of the interaction options and events in the adapters, the docs, examples and E2E (#33,
Epic #34):

- **One table names every callback** (`ENGINE_EVENT_CALLBACKS`, core, `engine/event-callbacks.ts`):
  each engine event but `viewport-change` to a name after `on` (`NodeClick`), React Flow's where it
  has one (`MoveStart`, `Init` for `ready`, `SelectionStart` / `SelectionEnd` for the box,
  `ConnectCancel` for React Flow's `onConnectEnd` with its connection state, `ResizeEnd` for
  `resize`, `Delete` for `remove`). React: `onNodeClick`; Vue: the emit `nodeClick`
  (`RootEventEmits`, in `ROOT_EMITS`, declared camelCase so an `h()` call or TSX types `onNodeClick`;
  a template writes `@node-click`); Svelte:
  `onnodeclick`, lowercase as the adapter's other callbacks (`onnodeschange`), not the Epic's
  `onNodeClick`; Angular: the output `nodeClick`, declared one by one (a type-level map and a test
  of `ɵdir.outputs` keep them equal to the table; `moveStart` / `moveEnd` have their types written
  out, ng-packagr could not name the core's `ViewportMove`). Every callback gets the event object
  (`FlowEngineEventOf<K>`), never positional arguments. Each adapter's `tests/interaction.test.*`.
- **The lock is React Flow's**: `ToggleInteractive` switches `drag`, `connect` and `select`;
  `interactive` (the root prop, `data-interactive` on the root) stays the whole flow's switch, and
  a locked flow by `interactive={false}` unlocks whole from the button. A resize and the delete
  keys stay unlocked by the button (React Flow's do too).
- **A reconnect anchor at a fixed end is not rendered** (Angular: out of the document), rather
  than rendered and inert.
- **The playground fixture logs the gesture callbacks** in its `gestures` list (through the root's
  callbacks, so the adapter is under test), apart from `events`, so the specs written before
  keep their exact event lists; its new queries: `selectOnDrag=0`, `roles=1`,
  `reconnectable=target`, `dropToAdd=1`, `confirmDelete=1`, `preventScrolling=0`,
  `zoomOnScroll=0`, `threshold=10`, `tall=1` (`e2e/interaction.spec.ts`). The scenario
  `gestures/interaction-and-events` puts the options behind controls and logs every callback.
- **Examples**: a new `context-menu` (Building blocks, order 8: the menus of a node, the selection
  and the canvas at the press, a double click marking a task done), `add-nodes` adds a task where
  a connection is dropped on the canvas (`onConnectCancel`'s `point`), and `minimap-and-controls`'
  lock keeps the flow `interactive` (its spec checks a click selects nothing). The gallery has 20
  examples. The rest of the options (`selectOnDrag`, the tap distances, `preventScrolling`, the
  threshold, roles, per-end reconnection, `beforeDelete`) stay in the docs and the playground: no
  gallery example needs them, as #25 decided for its options.
- **Docs**: the root's props table lists every callback (the docs test reads the core's table),
  the four primitives pages name each framework's spelling (Angular one row per output),
  `concepts/handles-and-connections.mdx` (a handle's role, a drop on the canvas, the threshold and
  the line, default edge fields, per-end reconnection), `guides/selection.mdx` (clicks, double
  clicks and context menus, drag without selecting), `guides/keyboard.mdx` (confirm before
  deleting, focus and the view), `guides/minimap-and-controls.mdx` and `toggle-interactive.mdx`
  (the lock's switches), `limitations.mdx` (`onConnect` is no longer "on purpose" missing;
  `nodesDraggable`-like props are `set-interactive`'s switches; `onConnectEnd` is
  `onConnect` + `onConnectCancel`; the known limits of #32).

Decisions of the components, helpers and hooks (#35 core, #36 adapters and docs, Epic #37; React
Flow's API studied, none of xyflow's code):

- **Hook names per adapter**: React's names for Vue's composables (computed refs; value, ref or
  getter arguments) and Svelte's runes (`FlowValue`, `useNodeId` the id itself, lowercase
  `onstart` / `onchange` / `onend`); Angular's are `injectFlowStore`, `injectNodeId`,
  `injectNodesData`, `injectNodeConnections`, `injectInternalNode`, `injectKeyPress`,
  `injectOnViewportChange`, returning signals. All read core keys (`nodes-data-by`,
  `node-connections-by`, `internal-node-by`) and share `watchKeyPress` / `sameFlowValue`;
  `useKeyPress` reads the root's window, never the global one, and does not skip typing in fields.
- **The selection rectangle is a box's by default**: `selection-rect` exists after a box selected
  two or more nodes, until the selection changes otherwise; `selection({ rect: "always" })` for any
  selection of two or more. Its drag replaces `drag-start` with `selection-drag-start` / `-drag` /
  `-drag-end`; a cancel is `drag-cancel`, as a node drag's. No focus or keys on it (Epic #40: it
  takes focus with `keyboard()`).
- **A resize snaps with `resize({ snap })` only**, independent of `drag({ snapGrid })`; a resizer's
  `direction` is the whole `NodeResizer`'s (no `ResizeLine`, no per-handle direction; Epic #40: a
  `ResizeHandle`'s own `direction` and `variant="line"`).
- **`animated` is an `EdgeFlags` flag** (default false, `edge.set-flags`), shown as `data-animated`
  on `edge`, `edge-path`, `edge-label`; the motion is the app's CSS.
- **An edge's `pathOptions` is one flat object** (the engine's keys, each type reading its own),
  merged over the engine's key by key; a change in a controlled sync replaces the edge.
- **`minimap-click` is an engine event**, since the root captures the pointer and a DOM `click`
  never reaches the minimap; no root callback (outside `ENGINE_EVENT_CALLBACKS`), each `MiniMap`
  tells it (React `onClick(event, point)`, Vue `click`, Svelte `onclick`, Angular `minimapClick`
  with the whole event). A minimap's `inversePan` / `zoomStep` are one part option set per root.
- **Geometry**: bezier's `labelOffset` is the label point's distance from the source, both
  positive, as React Flow's; the step turn's `stepPosition` is counted between the points that
  stand `offset` out from the ends, a non-finite `stepPosition`, `centerX` or `centerY` ignored.
- **Docs**: `api/primitives/hooks.mdx` (a section per selecting hook, four frameworks),
  `path-helpers.mdx`, `concepts/viewport.mdx` (what fit-view frames), `guides/custom-edges.mdx`
  (an edge's own shape, animated edges), `guides/selection.mdx` (the selection rectangle), the
  primitives' pages and `limitations.mdx` (`ResizeLine`, keys on the rectangle, the per-root
  minimap options, `useKeyPress` and typing).

Decisions of Epic #40 (#38 core, #39 adapters and docs; React Flow v12's SSR, `zIndexMode`, node
`origin` and `NodeResizeControl` studied as behaviour, none of xyflow's code):

- **`zIndexMode` defaults to `"auto"`**, a deliberate choice, not React Flow's default: xyflow
  defaults to `"basic"`, and its `"basic"` already lifts an edge to the z of an end that is a
  child or selected (`packages/react/src/store/initialState.ts`, `getElevatedEdgeZIndex`). Here
  `"basic"` is this library's order before the Epic (every edge below every node, a selected one
  raised among the edges only, `elevateEdgesOnSelect` off), and `"auto"` adds the sub-flow lift
  and raises a selected edge above the nodes (`elevateEdgesOnSelect` defaults to true in
  `"auto"`). A visible change: a selected edge may now cover the nodes it crosses, and an edge
  between a group's children stands above the group. `limitations.mdx` ("On purpose") says how to
  get the old order back (`zIndexMode="basic"`, or `elevateEdgesOnSelect={false}`); the adapters'
  `options` tests cover both modes.
- **One render level unless needed**: a level per distinct edge value above the lowest shown node
  value, otherwise a single level, which is exactly the DOM before the Epic, so the parts, the
  examples' CSS and the five themes keep working; the `edges-layer` wrappers (with `data-level`)
  appear only while an edge stands above some node.
- **Layering by stacking order, not per-level node wrappers** (a deviation from the Epic's "an
  edges SVG and a nodes layer per level"): nodes stay in their one `nodes` layer, which drops its
  isolation while there are several levels, and their z-indexes become negative ranks interleaved
  with the edge layers. A node moving to another wrapper would remount in every framework (state,
  focus, measurement, a gesture under way). An edge that changes level is remounted in React, Vue
  and Svelte (moved in Angular) and gets its focus back through `adapter.refocus`.
- **Declared handles until measured**: a `DeclaredHandle` is used only until a handle of that
  node, type and id is measured; measured handles always win. Its point is the centre of its box
  (`x + width / 2`, `y + height / 2`), the point the engine measures for a rendered handle, so the
  static and the measured geometry are equal (React Flow uses the box's side instead).
- **One pure function for the server and the first client render**: `src/geometry/` (no DOM, no
  engine, a guard test) is what the engine falls back to before measurement and what the adapters
  draw before the engine, with the same inputs, so there is no hydration mismatch and no jump.
  `fitView` on init counts initial sizes and is not redone after measurement; edge labels are not
  in the server HTML (they portal once mounted); Angular has no server render (its first browser
  render draws the declared edges). All in `limitations.mdx`.
- **The child origin rule**: a node's `origin` overrides `nodeOrigin` exactly where `nodeOrigin`
  applies; a child keeps its top-left corner in its parent, a parent's origin moves its box and its
  children. The model's own sub-flow rules (`absolute-position-by`, `expandParent`, the model's
  `extent: "parent"` clamp, `node.set-parent`) ignore a per-node origin as they ignore
  `nodeOrigin`: a known limit in `limitations.mdx`.
- **Two more gaps closed, so no "Not yet" row is left**: a `ResizeHandle`'s own `direction` (over
  its resizer's, read from `data-direction` at the press or the key) and `variant` (`data-variant`,
  `line` a styling marker on side handles only, a corner always `handle`); and the selection
  rectangle focusable with `keyboard()` (`tabindex`, the arrows moving the selection, a delete key
  removing it, Escape clearing it, Enter and Space nothing; the app names it). `limitations.mdx`
  loses its "Not yet" section.
- **The server HTML checked without the site export**: the Issue's "site export check of a docs
  page's server HTML" became server-render tests of the `server-rendering` example
  (`examples/{react,vue,svelte}/tests/server-rendering.test.ts`: React's, Vue's and Svelte's
  server renderers in node, every edge's path and every node's place in the HTML) and a
  playground check of the server HTML in a real browser with JavaScript disabled, because
  `site:export` prerenders no flow (each embed is a client-only build).
- **The server draws the identity viewport**: only the engine writes the viewport's transform
  (D4), so `defaultViewport` and `fitView` apply once it is attached after mount, and move the
  whole flow then. The `server-rendering` example has neither: its nodes are placed to fit the
  frame at zoom 1. The viewport part is its own stacking context (`isolation: isolate`) in every
  adapter, from the server on, so a layered flow stacks the same before the engine.
- **Docs**: `guides/server-rendering.mdx` (new), `concepts/nodes-and-edges.mdx` (sizes and handles
  before measuring, a node's own origin, z-order and how it is drawn), `api/engine.mdx`
  (`zIndexMode`, `render-layers`, `refocus`, the `edges-layer` part, static geometry),
  `api/json-document.mdx` (the node fields, `DeclaredHandle`), the primitives' pages (`root`,
  `edges`, `nodes`, `node`, `resize-handle`, `node-resizer`, `nodes-selection`), the resizing,
  selection and keyboard guides, and `limitations.mdx`.

Decisions of the React Flow examples (Epic #49: #44 to #48):

- **Every case of React Flow's catalogue, no example twice**: 27 cases were already shown by an
  existing example (two of them extended: `edge-reconnect`'s Delete on drop, `sub-flows`' grouping),
  39 collapse into 22 new examples, and Base Style, Dark Mode and Tailwind are the five themes.
  The map is `site/docs/guides/react-flow-examples.mdx` (its title avoids "Flow", which `www`
  appends). React Flow was a behaviour reference only: the code, the data and the look are ours.
- **The gallery by topic in nine levels** (`basics` … `apps`), the ids and URLs unchanged; the
  orders follow the Epic's table.
- **React first, the ports in their own Epics**: the new examples and extensions are `PENDING` in
  Vue, Svelte and Angular (one place that lists what each port owes), so their suites skip them
  instead of failing.
- **Library gaps are follow-ups, never a package change here**: each Issue's paragraph above lists
  them (the large-flow hot spots of #47, the flags `node.move` and `edge.add` enforce from code,
  the unexported path helpers of #46, …); the examples build what is missing from the public API.
- **Three dependencies, layout only** (approved): dagre, ELK and d3-force, in `examples/react`;
  everything else is built in the example (the stress test's numbers, the collaborative transport,
  the SVG export, the stroke smoothing, the edge routing).
- **The stress test opens at 1 000 nodes** and offers 5 000, 10 000 and 20 000, with
  `onlyRenderVisible`; the smoke runs the default size.
- **Animations, async layouts and simulations are awaited through attributes** the example
  renders (`data-animating`, `data-layouts`, `data-layout`, `data-simulation`), never timeouts;
  a layout's final move is one non-transient batch, so an undo history sees one step.

Decisions of large flows (Epic #61: #59, the core; #60, the harness and the numbers, React's own under the React adapter; the recommended options of its Stop Conditions):

- **The spatial index is a uniform grid** (`SpatialGrid`, cells of 256 flow units) rather than an
  R-tree: nodes and edges are mostly small and spread out, a grid is a few dozen lines, and a
  query costs the cells of the view. A rectangle over 64 cells (a large group, a long edge) or out
  of the keys' reach goes to a list every query checks; a query wider than the grid (a far zoom
  out) scans the rectangles.
- **Edges are culled by their ends' box** (`visible-edges`' rule, unchanged), filed in their own
  grid; their path strings are built only when read (`edge-path-by`), so a culled edge never
  builds one.
- **The caches sync on read**, by identity, rather than listening to the model: a read during a
  command's middleware or right after a commit sees the committed document, as before, and an
  engine nobody reads does nothing. What a commit replaced in place is recorded internally
  (`replaced-items.ts`), not in `CommandEvent`: the public events are unchanged.
- **Same content, same array** for `visible-nodes`, `visible-edges` and `drawn-edges` (frozen), and
  the same frozen object for a node's rect and an edge's path until they change (the Epic's
  decision: identity may change, values never do). `render-layers` is the same object while the
  nodes' stack values and the drawn edges are.
- **With `onlyRenderVisible`, nothing is visible before the root has a size**: `visible-nodes`
  and `visible-edges` (so `drawn-edges`) are empty until then, where every node and edge counted
  as visible and mounted. Edges follow the nodes' rule so that no edge mounts dangling before its
  nodes. Without culling, and for the server render (`staticGeometry`), the first render is as
  before; #60: a culled React flow renders no node or edge before the engine either, and Vue's
  since #51 (Svelte and Angular still draw the static geometry then).
- **A drag step stays O(N) in the model only**: its commit copies the node list (the document is
  immutable and frozen, D3); the engine reads the replaced ids instead of comparing the list.
- **`pnpm perf` measures the React embed's production build** (`scripts/perf.ts`): Playwright's
  Chromium in its new headless mode, 1280 × 800, 120 pointer steps at 60 Hz, a frame the
  interval between two `requestAnimationFrame` callbacks (one under 6 ms joins the one before:
  Chromium runs a late frame's callbacks back to back), each size opened fresh, three runs, their
  median reported; the open time is the example's (`onInit` to the next frame), and the inserted
  node elements are counted (`appendChild` / `insertBefore` patched in the page) to show only the
  visible ones mount. Not in CI: the numbers are the machine's.
- **The numbers** (`stress-test`, Chromium 153, i7-10700F; median / p95 ms; open without any
  `ready` gate):

  | nodes | gesture | Epic baseline | after #59 | after #60 |
  | --- | --- | --- | --- | --- |
  | 1 000 | pan / zoom / drag | 16.7/22–33, 16.8/43–47, 16.7/22–31 | 16.7/18–20, 16.8/34, 16.7/18–19 | 16.7/19, 16.9/33, 16.7/18 |
  | 10 000 | pan | 34–36 / 67 | 16.6 / 20 | 16.7 / 19 |
  | 10 000 | zoom | 17 / 102–106 | 16.8 / 40–48 | 16.7 / 33–36 |
  | 10 000 | drag | 66.5 / 69–83 | 16.7 / 19–22 | 16.7 / 18–22 |
  | 10 000 | open | 2.5–2.8 s (10 000 mounted) | ~700 ms (10 000 mounted) | 172–203 ms (51 mounted) |
  | 20 000 | pan / zoom / drag (median) | 66 / 17 / 117 | 16.7 / 16.7 / 16.7 | 16.7 / 16.7 / 16.7 |
  | 20 000 | open | | ~1.3 s | 340–353 ms (50 mounted) |

- **What is left: the far zoom out** (the Epic's stop condition, recorded rather than widened to
  canvas rendering). At 10 000 nodes the zoom's p95 is 33–36 ms against a 33 ms target: the
  frames past it are the last steps out, each mounting a few hundred nodes (2 655 in view at
  `minZoom` 0.1). In #60's profile (`--profile`, unminified) such a frame (40–75 ms) is about a
  third the first `offsetWidth` read of `Measurements.sizeOf` in the commit (the forced style and
  layout of the new nodes, which the frame would do anyway), a quarter the browser's own style,
  layout and paint, a fifth React's render of the new nodes, and under a tenth the reads (the
  store and the measured wave, 15–20 ms a frame before the per-entity routing). CSS containment
  on the example's nodes (`contain: layout style`, `strict`) changed nothing measurable. What
  would remain: mounting fewer nodes per frame (spread over frames, which changes when a node
  appears) or drawing far zooms otherwise (canvas, out of scope).
- **The root's box is still read per read** (`getBoundingClientRect`, for the view): caching it
  needs a resize signal the engine does not have; it was ~4 % of the busy time of the 10 000-node
  gestures in the profile of #59 (99 ms of 2.4 s).
- **Vue's numbers** (#51, `pnpm perf --framework vue`, the same machine and method; median / p95 /
  max ms, open with the nodes mounted meanwhile; React's on that day: 10 000 open 178 ms (51),
  zoom 16.7/34/71; 20 000 open 362 ms (50)):

  | nodes | gesture | before #51 | after #51 |
  | --- | --- | --- | --- |
  | 1 000 | open | 122 ms (1 052 mounted) | 38 ms (52) |
  | 1 000 | pan / zoom / drag | 16.6/18/22, 16.8/64/117, 16.7/18/50 | 16.6/19/24, 16.8/33/46, 16.7/18/33 |
  | 10 000 | open | 1 058 ms (10 051 mounted) | 208 ms (51) |
  | 10 000 | pan / zoom / drag | 16.6/20/24, 16.8/110/1 194, 16.7/20/51 | 16.7/18/23, 16.7/40/89, 16.7/19/43 |
  | 20 000 | open | 2 035 ms (20 050 mounted) | 362 ms (50) |
  | 20 000 | pan / zoom / drag | 16.7/21/38, 16.8/122/1 241, 16.7/24/57 | 16.7/19/41, 16.7/41/83, 16.7/18/58 |

  The store and the culled first render alone left the 10 000 zoom at 16.8/104/1 017: the rest
  was the two forced layouts above. What is left (zoom p95 40 against React's 34) is Vue's render
  and patch of the nodes a far zoom out mounts; the profile showed no other adapter hot spot.
