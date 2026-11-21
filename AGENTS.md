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
| `packages/core` | `@fragiola/flow` | the document and its JSON Schemas, the typed model and its commands, the feature registry and the features, the engine that binds a flow to the DOM | DOM only, zero runtime deps | Epic #4 (a placeholder until #2) |
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
| `pnpm check` | Biome lint + format + assist (non-mutating), then `check:layout`. Issue #2 adds `check:commands` (the command docs drift check) |
| `pnpm check:layout` | the source layout check (`scripts/check-layout.ts`, from Dockable): every tracked name kebab-case, a package's `src/` root holds only its entries |
| `pnpm check:fix` | Biome check with auto-fix |
| `pnpm format`, `pnpm lint` | Biome format (writes), Biome lint |
| `pnpm typecheck` | `pnpm -r typecheck` (TypeScript 7, no emit) |
| `pnpm test` | Vitest: `core` (node; a test that needs a DOM opts into jsdom) and `site` (the repository's guard tests) |
| `pnpm build` | `pnpm -r build` (tsdown for the packages), then the `.d.ts` check (`scripts/check-dts.ts`: no `any`) |
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

## Repository layout

```
packages/core/      @fragiola/flow       src/<domain>/ (document, state, commands, model, features,
                                         one folder per feature, engine, geometry, attributes);
                                         entry index.ts; tests/ mirroring src/, tests/types/,
                                         tests/guard.test.ts
site/               package.json         the repository's guard tests (tests/): the layout, .d.ts,
                                         package, E2E selection and CI workflow checks
scripts/                                 check-layout.ts, check-dts.ts, source-condition.ts,
                                         check-package.ts, e2e-suites.ts (check-features.ts with #2)
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
