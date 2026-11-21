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
| `packages/svelte` | `@fragiola/flow-svelte` | the same primitives as Svelte components | peer `svelte` | planned |
| `packages/angular` | `@fragiola/flow-angular` | the same primitives as Angular directives, the hooks as injection functions | peer `@angular/core` | planned |
| `apps/playground` | private | the dev app: the examples in place, scenarios, the unstyled fixture Playwright drives, the inspector | the React package | Epic #8 (#6) |
| `examples/shared` | `examples-shared`, private | what every framework's examples share: metadata, the five themes, the embed protocol, the manifest, every Playwright spec | no framework | Epic #8 (#6) |
| `examples/react` | `examples-react`, private | the React examples (the site's gallery and its embed app), vendored Fragiola UI | the React package | Epic #8 (#6) |
| `examples/vue` | `examples-vue`, private | the same examples in Vue (its embed app), the theme copied from `examples/react`, Fragiola UI's pieces ported to Vue | the Vue package | Epic #11 (#10) |
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
     `width`/`height`, flags (`draggable`, `selectable`, `connectable`, `deletable`, `hidden`),
     `parentId`/`extent` only with `subflows()`.
   - An edge: `id`, `source`, `target`, `sourceHandle?`, `targetHandle?`, `type` (`bezier` |
     `smoothstep` | `step` | `straight` | an app type), `data`, flags.
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
   `selection.clear`, `selection.remove`, `batch`. Removing a node removes its edges (and, with
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
    to exact versions published at least 7 days ago (`npm view <pkg> time`). The workspace packages
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
| `pnpm typecheck` | `pnpm -r typecheck` (TypeScript 7, no emit) |
| `pnpm test` | Vitest: `core` (node; a test that needs a DOM opts into jsdom), `react` and `vue` (jsdom; a server render opts into node) and `site` (the repository's guard tests) |
| `pnpm build` | `pnpm -r build` (tsdown for the packages: each one's main entry and one entry per feature), then the `.d.ts` check (`scripts/check-dts.ts`: no `any`) and the features' bundle guard (`scripts/check-features.ts`: no main entry, nor a chunk it imports, built from a feature's folder, read from the source maps; tested with a planted import by `site/tests/check-features.test.ts`) |
| `pnpm check:package` | builds the packages, packs them with pnpm, checks the packed `exports` are the repo's without the source condition (only `types`/`import`/`default`, targets in `dist`), runs `publint --strict` and `attw --profile esm-only` on the tarballs; for each adapter of `ADAPTERS` (React, Vue) checks its exact core pin and runs its smoke app: a scratch app outside the workspace that installs the adapter's tarball only, typechecks (strict, no `skipLibCheck`), builds and loads its dev server: Vite + React at the pins of `examples/react`; Vite + a Vue single-file component checked by `vue-tsc` on TypeScript 6, at the pins of `examples/vue` (`smokeVersion`: the examples app's pin, else the package's) (`scripts/check-package.ts`) |
| `pnpm dev` | the playground (`apps/playground`, port 5197; `PLAYGROUND_PORT` moves it) |
| `pnpm e2e` | Playwright: the playground's suite (Chromium and Firefox, its dev server, the sources), then each examples app's (`examples/*/playwright.config.ts`: the shared specs against a production build of its embed, built against the packages' `dist`: run `pnpm build` first) |
| `pnpm --filter examples-react dev` | the React embed alone, port 5185 (`PORT` moves it; `?id=<id>&theme=<name>`) |
| `pnpm --filter examples-vue dev` | the Vue embed alone, port 5186 (`PORT` moves it; `?id=<id>&theme=<name>`) |
| `pnpm --filter examples-react vendor` | vendors Fragiola UI (`scripts/vendor-fragiola.ts`; `FRAGIOLA_REGISTRY` points it elsewhere) |
| `pnpm site:export --base /flow --out <dir>` | the site export (contract v1.7): builds the packages and each framework's embed, writes the pages, `examples.json`, `project.json` and the manifests, then validates the output and exits non-zero on any violation ([The site export](#the-site-export-issue-7)) |
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
- **E2E (examples \<framework\>)**: a matrix over `Changes`' `examples` output (every
  `examples/<framework>` with a `playwright.config.ts`: React and Vue today): builds the packages, then
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

**Shards: none.** Shard a suite only when its test step alone passes about 3 minutes. Measured
locally (4 workers; CI runs 2): the playground's 90 tests (45 per browser) in ~23 s, the React
examples' 175 tests (95 smoke runs: 19 examples × 5 themes) in ~45 s, the embed build included;
the Vue examples' 175 tests in ~16 s (~17 s with its embed build).

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
| `src/features/` | `FEATURE_KEYS` (what each feature owns, by name), the registry (`composeFeatures`, `featuresOf`, `featureEngine`), the feature contract |
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
`absolute-position-by { nodeId }`, `flow-json`, `commands`; `selected-nodes`, `selected-edges`
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
| `src/geometry/` | the path helpers (`bezierPath`, `smoothStepPath`, `stepPath`, `straightPath`, each with its label point, written from the geometry), rectangles, the viewport's math |
| `src/attributes/` | the part attribute names and `partAttributes` (D11) |
| `src/engine/` | `createFlowEngine`, the key registry (`verbs.ts`), the adapter contract (`adapter.ts`), events (`events.ts`), measurement, the press target (`dom.ts`), edge geometry, the background pattern, the toolbar position, node moves shared by drag and keyboard, the one structural style writer |
| `src/connect-session/` | the connection under way, shared by `connection()` and `reconnection()` through `host.shared` (no entry; the bundle guard counts it as both features' code) |
| `src/<feature>/<feature>-engine.ts` | each feature's engine side |

**Options** (`FlowEngineOptions`): `root`, `defaultViewport` (`{ x: 0, y: 0, zoom: 1 }`),
`minZoom` 0.5, `maxZoom` 2, `translateExtent` (a flow `Rect`), `panOnDrag` true, `panOnScroll`
false, `zoomOnScroll` true, `zoomOnPinch` true, `zoomOnDoubleClick` true, `zoomStep` 1.2, `fitView`
(true or `fit-view`'s payload: once every visible node is measured), `interactive` true,
`onlyRenderVisible` false, `pathOptions` (`curvature` 0.5, `borderRadius` 5, `offset` 20).

**Actions** (`engine.run`; `can`/`check` are their dry runs): `set-viewport { x?, y?, zoom? }`,
`pan-by { x, y }` (pixels), `zoom-in` / `zoom-out { step?, around? }` (refused at the limit: a
Controls button's disabled state is `!engine.can("zoom-in")`), `zoom-to { zoom, around? }`,
`fit-view { padding? 0.1, nodeIds?, minZoom?, maxZoom? }` (refused before a size is known),
`center-on { x, y, zoom? }`, `focus-node { nodeId }`, `set-interactive { interactive }` (the
Controls' toggle: gestures and keys stop changing the flow, pan and zoom stay), `cancel-gesture`.
`around` and the selection box are **root-relative** pixels; `screen-to-flow` / `flow-to-screen`
take and give **client** points (a pointer's `clientX`/`clientY`, a drop's).

**Reads** (`engine.get`): `viewport`, `root-size`, `edge-path-by { edgeId }` (`{ path, label,
source, sourceSide, target, targetSide }`, undefined until both nodes have a size; an app type gets
the bezier), `node-rect-by { nodeId }` (absolute, size 0 until known), `nodes-bounds { nodeIds? }`,
`screen-to-flow`, `flow-to-screen`, `visible-nodes` (in view, plus the unmeasured),
`visible-edges`, `handles-by { nodeId }`, `background-pattern { variant?, gap?, size?, offset? }`
(one SVG pattern tile on the screen: dots, lines, cross), `node-toolbar-by { nodeId, side?, align?,
offset? }` (a root-relative anchor outside the zoom); features: `selection-box` (selection),
`dragging-node-ids` (drag), `connection` (connection: `from`, `fromPoint`, `toPoint`, `toSide`,
`to`, `status` valid/invalid/null, `path`, `reconnecting`), `minimap-view { width, height }`
(minimap: `viewBox`, `viewBoxAttribute`, `scale`, `nodes`, `view`, `maskPath` for
`fill-rule="evenodd"`). **Questions** (`engine.is`): `interactive`, `panning`, `node-measured`;
`box-selecting`; `dragging`, `node-dragging`; `resizing`, `node-resizing`; `connecting`;
`edge-reconnecting`; `node-focusable`, `edge-focusable` (keyboard: the adapter sets `tabindex="0"`).

**Events** (`engine.subscribe`, D12, for the app's live region or a controlled viewport):
`viewport-change { viewport, gesture }`, `drag-start`, `nodes-move { nodeIds, source: "pointer" |
"keyboard" }`, `drag-cancel`, `connect-start`, `connect { edgeId, source, target }`,
`connect-cancel { refused }`, `reconnect-start`, `reconnect`, `reconnect-cancel { refused }`,
`resize { nodeId, width, height }`, `box-select`, `remove { nodeIds, edgeIds }`.

**The adapter contract** (`engine.adapter`, what `Flow.*` primitives call; an app never does):

- `attachRoot(element)` / `detachRoot()`: the engine listens to the root itself (`pointerdown`,
  `pointermove`, `pointerup`, `pointercancel`, `lostpointercapture`, `wheel` non-passive,
  `dblclick`, `keydown`, `focusin`), captures the pointer on the root, and writes its
  `touch-action: none`. The adapter forwards no event.
- `attachViewport(element | null)`: the engine writes `transform` and `transform-origin` on it; the
  framework never renders a transform there (D4). Nodes render inside it at their absolute
  position: `node-rect-by`'s `x`, `y` as a structural `transform: translate(x, y)`, flat (a
  child is not nested in its parent's element), and the document's `width`/`height` when given
  (a resize writes them).
- `registerNode(nodeId, element | null)` (observed: its `offsetWidth`/`offsetHeight`),
  `registerHandle({ nodeId, handleId?, type, side, connectable? }, element | null)` (D8: its centre
  relative to its node, from the client rects divided by the zoom).
- `attributes(part, payload)`: the record to spread on each part (`data-flow-part`, `data-flow-id`,
  the state booleans as `""`/absent). Every press, key and wheel is resolved from these attributes
  (`dom.ts`), so every part must carry them: `root`, `viewport`, `nodes`, `edges`, `background` are
  the pane; `node`; `handle`; `edge`/`edge-path`/`edge-label`; `reconnect-anchor { edgeId, end }`
  (`data-end`: an edge end's grab area, drawn above the handles); `resize-handle { nodeId,
  position }` (`data-position`: `top-left` … `left`, inside the node's element); `minimap`,
  `minimap-node`, `minimap-mask`; anything else (`controls`, `toolbar`, `panel`) is left alone.
  Inside a node, fields, buttons, links and `data-flow-no-gesture` start no gesture;
  `data-flow-no-wheel` keeps its wheel.
- `setPartOptions("resizer", nodeId, { minWidth, … } | null)`: a resizer's own limits.
- `setOptions(partial)`: root props that change (`minZoom`, `panOnDrag`, `pathOptions`,
  `interactive`, …).
- `subscribe(listener)` / `getSnapshot()`: the view changed (`{ viewport, measured, gesture }`):
  edges, the connection line, the selection box, the minimap, toolbars and state attributes
  re-render from it; node and edge data from `model.subscribe`. Measurements are told once per
  task (the root window's microtask), so a mount re-renders once.
- `settings.onlyRenderVisible`: render `visible-nodes` / `visible-edges` instead of every one.

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
| `src/utils/` | `merge-props.ts`, `use-render.ts` (`render`, refs, `className` / `style` functions, structural style), `shallow-equal.ts`, `engine-facade.ts` |
| `src/<feature>/` | a feature's entry, and its primitives (`minimap/`, `resize/`) |

**Primitives** (`Flow.*`; every element carries `data-flow-part`, entities `data-flow-id`, the
engine's state attributes from `engine.adapter.attributes(part, payload)`):

| primitive | element | does |
| --- | --- | --- |
| `Root` | `div` `root` | owns the model (or takes `model`) and the engine, attaches the root; `position: relative; overflow: hidden` |
| `Viewport` | `div` `viewport` | `attachViewport`: the engine writes its transform, React never does |
| `Nodes` | `div` `nodes` | children function per node not hidden (`visible-nodes` with `onlyRenderVisible`), keyed by id |
| `Node` | `div` `node` | `registerNode`; `transform: translate(x, y)` from `node-rect-by`, the document's `width`/`height`; `tabIndex` from `node-focusable` |
| `Handle` | `div` `handle` | `registerHandle({ nodeId, handleId, type, side, connectable })`; centred on its side by default (a style may move it) |
| `Edges` | `div` + `svg` `edges` | children function per edge whose `edge-path-by` is defined; the `div` is the HTML layer labels portal into |
| `Edge` | `g` `edge` | default child `EdgePath`; `pointer-events: visibleStroke`; `tabIndex` from `edge-focusable` |
| `EdgePath` | `path` `edge-path` | `d` from `edge-path-by` (a `d` of your own draws an app type), `fill="none"` |
| `EdgeLabel` | `div` `edge-label` | portal into the edges' HTML layer, centred on the label point |
| `ReconnectAnchor` | `circle` `reconnect-anchor` | an end's grab area (`end`), transparent, `r` 10 |
| `ConnectionLine` | `svg` `connection-line` | while a connection is drawn; default child `path` `connection-path`, or a children function |
| `SelectionBox` | `div` `selection-box` | while a box is drawn, root-relative |
| `Background` | `svg` `background` | `background-pattern`: `pattern` `background-pattern`, `circle`/`path` `background-mark` in `currentColor`, `rect` `background-fill` |
| `Controls` | `div` `controls` | a group for the buttons |
| `ZoomIn`, `ZoomOut`, `FitView` | `button` `zoom-in`, `zoom-out`, `fit-view` | run their action; `disabled` / `data-disabled` while `!engine.can(...)` |
| `ToggleInteractive` | `button` `toggle-interactive` | `set-interactive`; `aria-pressed` while locked, `data-interactive` |
| `NodeToolbar` | `div` `toolbar` | portal into the root at `node-toolbar-by` (outside the zoom); `open`, default while its node is selected |
| `MiniMap` (`/minimap`) | `svg` `minimap` | `width` × `height` (200 × 150), `minimap-view`; children default: a `MiniMapNode` per node and the `MiniMapMask` |
| `MiniMapNode`, `MiniMapMask` | `rect` `minimap-node`, `path` `minimap-mask` | a node's box; the mask (`fill-rule="evenodd"`) |
| `NodeResizer` (`/resize`) | `div` `resizer` | `setPartOptions("resizer", nodeId, { minWidth, … })`; default children: a `ResizeHandle` at each corner and side |
| `ResizeHandle` | `div` `resize-handle` | `data-position`; placed on its corner or along its side |

**Root props:** `model`, or `defaultNodes` / `defaultEdges` (read once) and the controlled `nodes` /
`edges` with `onNodesChange` / `onEdgesChange`; `features` and `createId` (read once: a changed
`features` warns); `viewport` (controlled: `set-viewport`) / `defaultViewport` and
`onViewportChange(viewport, gesture)` (the `viewport-change` event); `fitView` (read once); the
engine options `minZoom`, `maxZoom`, `translateExtent`, `panOnDrag`, `panOnScroll`, `zoomOnScroll`,
`zoomOnPinch`, `zoomOnDoubleClick`, `zoomStep`, `interactive`, `onlyRenderVisible`, `pathOptions`
(a change sends only the keys that changed, `adapter.setOptions`); `flowRef`.

**Hooks:** `useFlow<T, F>()` → `{ model, engine }` (the engine a facade: there from the first
render, an action refused before the mount); part hooks `useNode(node)`, `useEdge(edge)`,
`useHandle({ type, side, handleId?, connectable?, nodeId? })` → `{ state, props }`; values
`useViewport()`, `useConnection()`, `useSelection()` (`{ nodes, edges }`), `useNodes()`,
`useEdges()`. `createFlowRef<T, F>()` / `useFlowRef<T, F>()`: `ref.current` is `{ model, engine }`
while the root is mounted.

Decisions of the adapter (#5):

- **The engine is created in the root's layout effect** (the tree's), destroyed in its cleanup: a
  StrictMode double mount creates two and keeps the second (starting at the first one's viewport);
  the first render and a server render have no engine (nodes at their model position with their
  static attributes, no edge).
- **Re-rendering:** `useFlowValue` reads a value again on every model commit and every
  `adapter.subscribe` notification, and keeps the last object while equal (records by their
  entries, edge paths by value), so a pan re-renders only what shows the viewport (the
  background, the minimap, toolbars, the zoom buttons). `Nodes` and `Edges` memo each entity's
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

For the playground and examples (#6, see [The playground and the examples](#the-playground-and-the-examples-issue-6)): wrap the flow in a sized element (the root fills it); put
`Edges` before `Nodes` inside `Viewport`, and `Background`, `SelectionBox`, `Controls`, `MiniMap`
outside it; give nodes `user-select: none`; style through `[data-flow-part]` and the state
attributes (`data-selected`, `data-dragging`, `data-connecting`, `data-valid` / `data-invalid`,
`data-handle-type`, `data-side`, `data-position`, `data-end`, `data-disabled`).

## The Vue adapter (Issue #9)

`@fragiola/flow-vue` is the React adapter in Vue 3.5: the same 24 primitives (the 19 of `Flow`,
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
| `ref` | a template ref: the component, its `$el` the element (`EdgeLabel`, `NodeToolbar`: their element renders elsewhere, reach it through the `render` slot) |
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
- **Known limits:** jsdom lays nothing out, so the tests stub the layout (`tests/flow.ts`,
  React's); the gestures' real feel is the Vue examples' shared Playwright specs (#10), which
  needed no adapter fix.

## The playground and the examples (Issue #6)

Every rule of the guidelines' Examples section (`../guidelines/docs/site.md#examples`) holds; what
Flow decided on top of it:

**`examples/shared`** (`examples-shared`, private, imports no framework: `tests/framework-free.test.ts`):

| path | holds |
| --- | --- |
| `src/meta/<id>.ts` | one file per example: title, description, `level`, order, features, docs link, layout, height |
| `src/meta-types.ts` | `LEVELS` (`basics`, `interaction`, `building-blocks`, `apps`, titled Basics, Interaction, Building blocks, Apps: `examples.json`'s `levels`), `DEFAULT_HEIGHT` |
| `src/framework.ts` | `FRAMEWORKS` (react, vue, svelte, angular), entry files, adapter and icon packages |
| `src/themes/` | `light`, `dark`, `ide`, `paper`, `terminal` (one CSS file of values each, `themes.ts`: name, title, description, scheme, swatch) |
| `src/embed/messages.ts` | `fragiola:example:ready` / `resize` / `theme` |
| `scripts/` | the examples finder, the manifest builder (`buildManifest`), the loader generator (`generate.ts <framework>`) |
| `e2e/` | `examplesE2eConfig(framework)` (port 4360 + framework index, base `/flow/embed/<framework>/`), the server with its host page, `smoke`, `iframe`, `themes` and `examples/<id>.spec.ts` |

`COMPLETE_FRAMEWORKS` is `["react", "vue"]`: a spec for an example another framework lacks is
skipped there, failed in React and Vue.

**The examples** (`examples/react/src/examples/<id>/index.tsx` + `styles.ts`; the README there is
the authoring guide): Basics `basic`, `custom-nodes`, `edge-types`, `edge-labels`, `backgrounds`,
`read-only`; Interaction `selection-and-keyboard`, `connection-validation`, `edge-reconnect`,
`snap-to-grid`, `minimap-and-controls`; Building blocks `sub-flows`, `node-resizer`,
`node-toolbar`, `add-nodes`, `save-and-restore`, `undo-redo`, `announcements`; Apps
`workflow-builder` (the landing's showcase). `_kit/persistence.ts` and `_kit/undo.ts` are the
copyable app policy.

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
feature`, `performance/five-hundred-nodes`, `api/commands`), the inspector
(`src/inspector/flow-inspector.tsx`: viewport, gestures under way, selection, engine events, the
document) and `fixtures/basic`, the unstyled flow its specs drive (`src/fixture/flow-fixture.tsx`:
every feature, an 800 × 500 root at the page's corner, the viewport at `{ x: 100, y: 100, zoom:
1 }`, its document, viewport and events printed beside it). Its suite runs on Chromium and Firefox:
pan, wheel, double-click and pinch zoom, drag (selection, cancel, extent, snap), connect,
reconnect, box select, resize, keyboard and minimap, each with the mouse and with fingers
(`e2e/helpers.ts` `touch`: Chromium's real touch input through the DevTools protocol, touch
pointer events in Firefox), and the 500-node scenario's re-render count.

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

`examples/vue` (`examples-vue`, private) is `examples/react` in Vue: the 19 examples with the same
ids, metadata, text, names, roles and test ids, and the same scripts (`generate`, `dev` (port
5186), `build`, `typecheck` (`vue-tsc`, TypeScript 6.0.3 pinned in this app, Splitter's), `e2e`,
`test`); `src/examples/README.md` says how an example is written in Vue. Its
`playwright.config.ts` is `examplesE2eConfig("vue")` (port 4361, `/flow/embed/vue/`), so the
Changes job's `examples` output and the E2E matrix include it, and `site:export` builds and
validates `embed/vue/` with its manifest (`project.json` `frameworks: ["react", "vue"]`). Vue is in
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
`#/lib/cn`, relative), the entry first in the code panel, `<Flow.Root>` in `index.vue`, no class
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

## The site export (Issue #7)

fragiola.com/flow is built by `www` from `pnpm site:export --base /flow --out <dir>`
(`../www/CONTRACT.md` v1.7, the source of truth; guidelines `docs/site.md`). The scripts are
Splitter's (`site/export.ts`, `contract.ts` with `CONTRACT_VERSION = "1.7"`, `dev.ts`,
`dev-proxy.ts`, `sources.ts`), unchanged but for the names:

| output | from |
| --- | --- |
| `project.json` | `site/project.json`: `contract: 1`, slug `flow`, title "Flow", `frameworks: ["react", "vue"]`, `defaultFramework: "react"`, `repository`, keywords |
| `docs/` | `site/docs`, copied as written: `config.json` (the sidebar), `index.mdx` (the landing), every page |
| `examples.json` | built by `sources.ts`: `levels` from `LEVELS` / `LEVEL_TITLES`, `themes` from `THEMES` with each theme's CSS (`examples/shared`) |
| `embed/<framework>/` | `pnpm --filter examples-<framework> build` with `EMBED_BASE=<base>/embed/<framework>/` and `EMBED_OUT_DIR`, against the packages' `dist`, plus `manifest.json` (`buildManifest(examplesApp(framework))`) |

`site:dev` starts each framework's embed dev server (`EMBED_BASE`, a free `PORT`) behind a Node
proxy on `--port` (5185, Flow's dev port, `www`'s `devUrl`); each serves `<base>manifest.json`.

**The pages.** The sidebar is Dockable's IA: Getting started; Concepts; Guides; API: primitives
(`@fragiola/flow-react`, `@fragiola/flow-vue`: one page per primitive under `api/primitives/`,
titled by its name alone, plus `hooks`, `flow-ref` and `vue` (the Vue components: React's API
mapped onto props, events and slots, every Vue export); the common props on
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
the render slot's fields are rows; every page of `PAGES_IN_VUE` and every primitive page has as
many `<Framework name="vue">` blocks as React ones, and no page has JSX (a `tsx` fence) or an
import of the React package outside a `<Framework>` block), `dev-proxy.test.ts`, `noindex.test.ts` (every HTML page of the repository is `noindex`),
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
site/               package.json         export.ts, contract.ts, dev.ts, dev-proxy.ts, sources.ts,
                                         project.json; docs/ (config.json, index.mdx, the pages,
                                         api/commands.mdx generated); tests/: the site checks
                                         (contract, docs reference, dev proxy, noindex) and the
                                         repository's guard tests (layout, .d.ts, package, E2E
                                         selection, CI workflow, bundle guard, command docs)
scripts/                                 check-layout.ts, check-dts.ts, source-condition.ts,
                                         check-package.ts, e2e-suites.ts, check-features.ts
docs/                                    docs-examples-gaps.md: what the docs and examples work
                                         around (F1, …), each with a proposed API
.github/workflows/  ci.yml               Checks, Package, Changes, E2E (playground), E2E (examples),
                                         Site export, Trigger www build
```

Later Epics add `packages/{svelte,angular}` and their examples apps (`pnpm-workspace.yaml`
already lists `apps/*`, `packages/*`, `examples/*` and `site`).

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
- **Sub-flows.** `extent` is `"parent"` only (no coordinate extent in D2). `expandParent` is a
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
  box instead of Shift + drag), `minimap({ padding: 0.1 })` (a share of its size).

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
  target)`, `focus`, `attributes`. The host lends the viewport, measured rects, handles, edge
  paths, `keepInParent`, `interactive`, `partOptions`, `changed`, `emit`.
- **Clicks are taps the engine detects**, not native `click`s: with the pointer captured on the
  root, a browser's `click` targets the root.
- **Sizes: the document's where it gives one, the measured one otherwise** (per dimension), so a
  resize is drawn at once and a node without a size is measured; a 0 × 0 measurement is no size.
  A node whose element goes while it stays in the flow (culled, hidden) keeps its last size and
  handle bounds, never offered to a connection; a removed node's are forgotten (#6).
- **Extent with measured sizes (closes #2's L6).** `host.keepInParent` clamps a drag's and the
  arrows' positions with the measured sizes before each `node.move`. A resize keeps a child inside
  its parent (the bound wins over `minWidth`, the ratio kept by shrinking), never shrinks a parent
  past its `extent: "parent"` children, and moves the children back when the parent's top or left
  edge moves (one `batch`), so they stay on screen; a parent holding a child that is not draggable
  keeps its top and left edges (its child cannot be moved back).
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
