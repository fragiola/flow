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
| `packages/core` | `@fragiola/flow` | the document and its JSON Schemas, the typed model and its commands, the feature registry and the features, the engine that binds a flow to the DOM | DOM only, zero runtime deps | Epic #4: the model (#2); the engine with #3 |
| `packages/react` | `@fragiola/flow-react` | the `Flow.*` primitives and hooks over the core | peer `react`, `react-dom` | planned (React Epic) |
| `packages/vue` | `@fragiola/flow-vue` | the same primitives as Vue components, the hooks as composables | peer `vue` | planned |
| `packages/svelte` | `@fragiola/flow-svelte` | the same primitives as Svelte components | peer `svelte` | planned |
| `packages/angular` | `@fragiola/flow-angular` | the same primitives as Angular directives, the hooks as injection functions | peer `@angular/core` | planned |
| `site` | private | for now only the repository's guard tests (`site/tests/`); the docs and the site export arrive with the React Epic | | |

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
| `pnpm test` | Vitest: `core` (node; a test that needs a DOM opts into jsdom) and `site` (the repository's guard tests) |
| `pnpm build` | `pnpm -r build` (tsdown for the packages: the core's main entry and one entry per feature), then the `.d.ts` check (`scripts/check-dts.ts`: no `any`) and the features' bundle guard (`scripts/check-features.ts`: no main entry, nor a chunk it imports, built from a feature's folder, read from the source maps; tested with a planted import by `site/tests/check-features.test.ts`) |
| `pnpm check:package` | builds the packages, packs them with pnpm, checks the packed `exports` are the repo's without the source condition (only `types`/`import`/`default`, targets in `dist`), runs `publint --strict` and `attw --profile esm-only` on the tarballs; for each adapter of `ADAPTERS` (none yet) checks its exact core pin and runs its smoke app (`scripts/check-package.ts`) |

`pnpm e2e`, `pnpm dev`, `pnpm site:export` and `pnpm site:dev` arrive with the apps in the React
Epic. There is no `changeset` or `release:version` script (D15).

## CI

`.github/workflows/ci.yml` (its comment header describes every job) runs on pull requests and on a
manual run (`workflow_dispatch`); **a push to `main` runs no tests**: main is what its pull request
tested (guidelines `repository.md#ci`). Its jobs today:

- **Checks**: `pnpm check`, `typecheck`, `test`, `build`.
- **Package**: `pnpm check:package`.
- **Changes**: picks the E2E suites a pull request can affect (`scripts/e2e-suites.ts`, a
  `git diff` against the merge commit's first parent, tested by `site/tests/e2e-suites.test.ts`):
  none for docs only (`site/docs/**`, `*.md`, `AGENTS.md`); `packages/react/**` or
  `examples/react/**`: the playground and examples react; `packages/<framework>/**` or
  `examples/<framework>/**` (vue, svelte, angular): examples `<framework>`; any other path, and a
  manual run: every suite. **It is an allow-list of what may skip**: a new rule names what it
  skips, never what it runs; an unknown path runs everything. No job reads its outputs yet.

No Changesets job and no release workflow (D15); `site/tests/ci-workflow.test.ts` checks the
triggers and that neither exists.

With the apps (React Epic) come the E2E jobs, the Site export job and the Trigger www build job
(the only job a push to `main` will run). Every job that runs Playwright runs in
`mcr.microsoft.com/playwright:v<version>-noble` (`container.options: --user 1001`), its tag the
exact `@playwright/test` version the apps pin, and **never runs `playwright install`**;
`site/tests/ci-workflow.test.ts` ties the tag to the version (it passes today with no Playwright
job and no pin), so upgrading Playwright changes both in one PR. Shard a suite only when its test
step alone passes about 3 minutes. `main` has no required checks: a skipped job blocks nothing.

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
and have only options and their reserved engine names in `FEATURE_KEYS` until #3. A command, key
or document field of a feature that is not installed is a type error and a runtime refusal
(`not_found`, `invalid_payload`, a validation issue), naming the feature.

**For the engine (#3).** `featuresOf(model)` gives the composed features; `featureEngine(composed,
host)` composes their `engine(host)` sides once per engine (keys merged, a key two features add
throws; `pointerdown`/`keydown` hooks walked in install order, the first `true` taking the event;
`attached`/`detached`/`destroy`). `FeatureEngineHost` (`model`, `shared(key, create)`) and
`FeatureEngine` are the contract to extend, and the `engineRun`/`engineGet`/`engineIs` lists of
`FEATURE_KEYS` are where each feature's engine names go. `FlowReader`, `AllowedKeys` type the
engine's own key maps by the installed features like the model's.

## Repository layout

```
packages/core/      @fragiola/flow       src/<domain>/ (document, state, commands, model, features,
                                         one folder per feature, engine, geometry, attributes);
                                         entry index.ts; tests/ mirroring src/, tests/types/,
                                         tests/guard.test.ts
                    scripts/             generate-command-docs.ts (site/docs/api/commands.mdx)
site/               package.json         the repository's guard tests (tests/): the layout, .d.ts,
                                         package, E2E selection, CI workflow, features' bundle guard
                                         and command docs checks; docs/api/commands.mdx (generated)
scripts/                                 check-layout.ts, check-dts.ts, source-condition.ts,
                                         check-package.ts, e2e-suites.ts, check-features.ts
.github/workflows/  ci.yml               Checks, Package, Changes
```

Later Epics add `packages/{react,vue,svelte,angular}`, `apps/playground`, `examples/*` and the
site's docs and export (`pnpm-workspace.yaml` already lists `apps/*`, `packages/*`, `examples/*`
and `site`).

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
  zoomable: true })`. #3 may extend them.
