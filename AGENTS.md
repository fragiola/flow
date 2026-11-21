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
     `smoothstep` | `step` | `straight` | an app type), `data`, `zIndex` (#24), flags.
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

**Shards: none.** Shard a suite only when its test step alone passes about 3 minutes. Measured
locally (4 workers; CI runs 2): the playground's 90 tests (45 per browser) in ~23 s, the React
examples' 175 tests (95 smoke runs: 19 examples × 5 themes) in ~45 s, the embed build included;
the Vue examples' 175 tests in ~16 s (~17 s with its embed build); the Svelte examples' 175 tests
in ~17 s (~19 s with its embed build); the Angular examples' 175 tests in ~28 s (~29 s with its
embed build).

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
| `src/engine/` | `createFlowEngine`, the key registry (`verbs.ts`), the adapter contract (`adapter.ts`), events (`events.ts`), measurement, the press target (`dom.ts`), edge geometry, the background pattern, the toolbar position, node moves shared by drag and keyboard, the one structural style writer, the viewport animation (`viewport-animation.ts`), the auto-pan step (`auto-pan.ts`) |
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
visible node is measured), `interactive` true, `onlyRenderVisible` false, `pathOptions`
(`curvature` 0.5, `borderRadius` 5, `offset` 20), `autoPan` true (`AutoPanOptions` `{ speed: 10,
margin: 30 }`: pixels a frame at the edge, pixels from the edge it starts at), `easing` (a cubic
ease in and out; `ViewportEasing`), `nodeOrigin` `{ x: 0, y: 0 }` (#24: the point of a node's box
its position stands at, as shares of its size, for the nodes on the flow), `nodeExtent` (#24: a
flow `Rect` every node's box stays inside when dragged, moved by the arrows or resized),
`elevateNodesOnSelect` true, `elevateEdgesOnSelect` false (#24). `adapter.setOptions` takes each
of them (the four adapters' roots take the new ones in #25).

**Actions** (`engine.run`; `can`/`check` are their dry runs): `set-viewport { x?, y?, zoom? }`,
`pan-by { x, y }` (pixels), `zoom-in` / `zoom-out { step?, around? }` (refused at the limit: a
Controls button's disabled state is `!engine.can("zoom-in")`), `zoom-to { zoom, around? }`,
`fit-view { padding? 0.1, nodeIds?, minZoom?, maxZoom? }` (refused before a size is known),
`center-on { x, y, zoom? }`, `focus-node { nodeId }`, `set-interactive { interactive }` (the
Controls' toggle: gestures and keys stop changing the flow, pan and zoom stay), `cancel-gesture`
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
`screen-to-flow`, `flow-to-screen`, `visible-nodes` (in view, plus the unmeasured),
`visible-edges`, `drawn-edges` (#24: the edges to draw in drawing order, shown and with measured
nodes, in view with `onlyRenderVisible`, by z-order), `node-z-index-by { nodeId }` (#24: the node's
structural `z-index`), `handles-by { nodeId }`, `background-pattern { variant?, gap?, size?, offset? }`
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
  `dblclick`, `keydown`, `focusin`, `contextmenu`), and to the root's `ownerDocument` (`keydown`,
  `keyup`: the activation keys held) and `defaultView` (`blur`: they are released), captures the
  pointer on the root, and writes its `touch-action: none`. The adapter forwards no event.
- `attachViewport(element | null)`: the engine writes `transform` and `transform-origin` on it; the
  framework never renders a transform there (D4). Nodes render inside it at their absolute
  position: `node-rect-by`'s `x`, `y` as a structural `transform: translate(x, y)` (its
  `nodeOrigin` applied: the core is the one source of a node's place), `node-z-index-by` as its
  structural `z-index` (#24), flat (a child is not nested in its parent's element), and the
  document's `width`/`height` when given (a resize writes them). Edges are drawn in `drawn-edges`'
  order (#24): an SVG's order is its drawing order.
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
  `data-flow-no-wheel` keeps its wheel; a node holding a `data-flow-drag-handle` element
  (`DRAG_HANDLE_ATTRIBUTE`, #24) drags only from it.
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
- **Known limits:** jsdom lays nothing out, so the tests stub the layout (`tests/flow.ts`,
  React's); the gestures' real feel is the Vue examples' shared Playwright specs (#10), which
  needed no adapter fix.

## The Svelte adapter (Issue #12)

`@fragiola/flow-svelte` is the React adapter in Svelte 5 (runes mode), the first Svelte adapter of
the ecosystem: the same 24 primitives (the 19 of `Flow`, `MiniMap`, `MiniMapNode`, `MiniMapMask` on
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
- **`ref` has no fallback** (`ref = $bindable()`): Svelte refuses `bind:ref={undefined}` on a prop
  with a fallback, and `let el = $state()` is the common app code.
- **Biome does not read `.svelte` files** (not in its `includes`); `svelte-check
  --fail-on-warnings` is their check.
- **Known limits:** jsdom lays nothing out, so the tests stub the layout (`tests/flow.ts`,
  React's); the flows under test are components (`tests/fixtures/`: snippets are written in
  templates); no hydration test; the peer floor (5.29) is not exercised by a check (the smoke app
  runs the pinned 5.57.3); the gestures' real feel is checked by the Svelte examples' shared specs (#13: they passed
  with no adapter fix).

## The Angular adapter (Issue #15)

`@fragiola/flow-angular` is the React adapter in Angular 22 (signals, standalone, zoneless,
OnPush by default), in the ecosystem's Angular way (Splitter's, Tree's, Data Grid's): the same 24
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
| `<Flow.Root …>` and every part | the part's directive on the app's element: `flowRoot`, `flowViewport`, `flowNodes`, `flowNode`, `flowHandle`, `flowEdges`, `flowEdge`, `flowEdgePath`, `flowEdgeLabel`, `flowReconnectAnchor`, `flowConnectionLine`, `flowSelectionBox`, `flowBackground`, `flowControls`, `flowZoomIn`, `flowZoomOut`, `flowFitView`, `flowToggleInteractive`, `flowNodeToolbar`, `flowMiniMap`, `flowMiniMapNode`, `flowMiniMapMask`, `flowNodeResizer`, `flowResizeHandle` |
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
- **Known limits:** no server render nor hydration (the sibling Angular adapters do not support it
  either; `[flowEdges]` adds its SVG in its constructor); jsdom lays nothing out, so the tests stub
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
| `src/meta-types.ts` | `LEVELS` (`basics`, `interaction`, `building-blocks`, `apps`, titled Basics, Interaction, Building blocks, Apps: `examples.json`'s `levels`), `DEFAULT_HEIGHT` |
| `src/framework.ts` | `FRAMEWORKS` (react, vue, svelte, angular), entry files, adapter and icon packages |
| `src/themes/` | `light`, `dark`, `ide`, `paper`, `terminal` (one CSS file of values each, `themes.ts`: name, title, description, scheme, swatch) |
| `src/embed/messages.ts` | `fragiola:example:ready` / `resize` / `theme` |
| `scripts/` | the examples finder, the manifest builder (`buildManifest`), the loader generator (`generate.ts <framework>`) |
| `e2e/` | `examplesE2eConfig(framework)` (port 4360 + framework index, base `/flow/embed/<framework>/`), the server with its host page, `smoke`, `iframe`, `themes` and `examples/<id>.spec.ts` |

`COMPLETE_FRAMEWORKS` is `["react", "vue", "svelte", "angular"]` (#16): every framework ships every
example, so a missing one fails its spec; a framework of a later adapter Epic is skipped there
while its app is written (the test uses a fake one).

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

## The Svelte examples and the Svelte docs (Issue #13)

`examples/svelte` (`examples-svelte`, private) is `examples/react` in Svelte 5 (runes): the 19
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
twin (129 each, as React's): a `svelte` component, or the same `ts` with `@fragiola/flow-svelte`,
and an "In Svelte, …" note where it differs. Installation adds `pnpm add @fragiola/flow-svelte`;
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

## The Angular examples and the Angular docs (Issue #16)

`examples/angular` (`examples-angular`, private) is `examples/react` in Angular 22 (standalone
components, signals, zoneless, OnPush): the 19 examples with the same ids, metadata, text, names,
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
name="angular">` twin (129 each, as React's): a standalone component in a `ts` fence, a template
excerpt in an `html` fence, or the same `ts` with `@fragiola/flow-angular`, and an "In Angular, …"
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
  for none), `connection({ clickToConnect: false })`.

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
- **Click-to-connect is a gesture that outlives its press.** `FeatureEngine.tap` may return a
  `FeatureGesture`: the engine keeps it as the gesture under way without a press, moves it on every
  primary pointer move (the hover), and gives it the next primary press (no other gesture starts,
  no pan; a press on `other` parts, the controls, leaves it waiting; the pan key still pans); that
  press's release is its `end`, a drop at that point: within `radius` of an eligible handle it
  connects through `model.can("edge.add")` (`connect`), a vetoed one `connect-cancel { refused:
  true }`, anywhere else `connect-cancel { refused: false }`. Escape, `cancel-gesture`,
  `set-interactive false`, a detach and `destroy` cancel it. So a tap on the pane that cancels it
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
  only). One helper, `nodeBox(position, size, origin)` (`geometry/rect.ts`), turns a position and
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
  structural style and render `drawn-edges` instead of their own filter. No command sets `zIndex`:
  a change through controlled props (`commands-to`) replaces the node or edge, as a type change
  does; elevation covers the usual raise.
