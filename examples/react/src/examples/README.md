# Examples

Each folder is one example of the site's gallery (`fragiola.com/flow/examples/<folder>`), rendered
alone by this app at `index.html?id=<folder>`.

```
src/examples/
  <id>/index.tsx     the example (default export)
  <id>/styles.ts     how it looks: one class string (or function of an app value) per part
  <id>/*.ts(x)       optional sibling files, shown in the code panel (workflow-builder's catalog,
                     rules, nodes, palette and inspector)
  _kit/              shared demo code and app policy: persistence.ts (local storage), undo.ts (an
                     undo history over the model's events); no Flow assembly, no styles
```

What every framework's examples share, and no reader copies, lives once in `examples/shared`
(`examples-shared`, private), so a Vue, Svelte or Angular app of the same examples reuses it:

```
examples/shared/
  src/meta/<id>.ts     each example's metadata: title, description, level, order, features, docs
                       link, layout, height (one file per example, for every framework)
  src/meta-types.ts    its shape, the levels and the default heights
  src/themes/          the five themes (one CSS file each, values only) and their list
  src/embed/messages.ts  the embed's messages to the site (`fragiola:example:*`)
  scripts/             the examples finder, the manifest builder, the loader generator
  e2e/                 every Playwright spec (smoke, themes, iframe, examples/<id>.spec.ts), run
                       against each framework's embed (`examplesE2eConfig`)
  tests/               the metadata, themes, contrast and e2e-helper checks
```

An example of this app is a folder `src/examples/<id>/` with an `index.tsx`, and its metadata is
found by its id. A folder without metadata, or metadata that no framework app has a folder for,
fails `examples/shared/tests/meta.test.ts`. An example keeps its id in every framework.

## Levels

The gallery groups examples by topic, its levels (`LEVELS` in `examples/shared/src/meta-types.ts`,
in sidebar order); `order` is an example's place inside its level. The orders follow the gallery
table of Epic #49 and keep gaps where its new examples go.

| level | title | what belongs in it |
|---|---|---|
| `basics` | Basics | a flow drawn: the first flow, a read-only diagram, server rendering, the minimap and the controls |
| `nodes` | Nodes | what a node is and does: custom nodes, resizers, toolbars, sub-flows and grouping |
| `edges` | Edges | how an edge is drawn and changed: edge types, labels and toolbars, reconnecting and deleting on drop |
| `connections` | Connections | drawing a new edge: rules and validation, the connection's announcements |
| `interaction` | Interaction | what a user does to the flow: select and use the keyboard, snap, add nodes, context menus |
| `layout` | Layout | placing nodes automatically (the layout examples of Epic #49) |
| `data` | Data and state | the flow as data: computing over connections, saving and restoring, undo and redo |
| `styling` | Styling | how a flow looks beyond the themes: backgrounds |
| `apps` | Apps | several features together, as a product would put them (`workflow-builder`, the landing's showcase) |

## Adding an example

1. Create `src/examples/<id>/index.tsx` and `styles.ts`, and its metadata in
   `examples/shared/src/meta/<id>.ts` (see `examples/shared/src/meta-types.ts`).
2. `pnpm dev` at the root lists it in the playground (`apps/playground`), with hot reload, the
   themes and its source: `http://localhost:5197/?example=<id>`. The embed alone is
   `pnpm --filter examples-react dev` (`http://localhost:5185/?id=<id>`, `PORT` moves it; it
   regenerates the loaders).
3. The smoke e2e visits it in every theme and inside an iframe. Add a spec for its main behaviour
   in `examples/shared/e2e/examples/<id>.spec.ts`: every framework runs it, through
   `data-flow-part`, `data-flow-id`, the state attributes, roles, accessible names and test ids
   only, and skips it while that framework lacks the example.

## Anatomy of an example

A reader opens `index.tsx` and sees the logic first: what is rendered, how the flow is assembled,
which API is called. How it looks is one click away, in `styles.ts`.

- **`index.tsx` renders `<Flow.Root>`** and every part under it, in the same file or in sibling
  files of the same folder, never in a shared module: `_kit/` holds no Flow assembly
  (`tests/examples.test.ts`).
- **The root fills a sized element**: the example's frame. Inside `Flow.Viewport`, `Flow.Edges`
  comes before `Flow.Nodes` (nodes are drawn on top), then `Flow.ConnectionLine`; the
  backgrounds come before the viewport; `Flow.SelectionBox`, `Flow.Controls`, `MiniMap` and the
  example's own panels come after it.
- **One background layer per pattern**: every flow renders `dots`, `lines` and `cross`, and the
  theme shows one of them (`--fl-grid-dots`, `--fl-grid-lines`, `--fl-grid-cross`). The
  `backgrounds` and `snap-to-grid` examples, about the background itself, choose their own.
- **Classes in `styles.ts`**, beside `index.tsx`. It exports one `styles` object with a class
  string per part, or a function of an app value (a node's tone, a port's type). No `.tsx` file of
  an example holds a class string or calls `cn()` (`tests/examples.test.ts`).
- **State through `data-*`**: the package's state is styled with data variants (`data-selected:`,
  `data-dragging:`, `data-valid:`, `data-invalid:`, `data-[position=top-left]:`), never a
  function of the part's state: the markup stays the same in every framework.
- **Classes are complete literals.** Tailwind finds a class by reading the source, so
  `` `palette-${tone}` `` is never generated: map a value to a full class instead.
- **Accessible names inline**: the package renders no text and no `aria-label`. Every focusable
  node and edge gets its name (`role="group"`, `aria-roledescription`, `aria-label`), every
  control button and icon button its `aria-label`, every live region its role.
- **Tokens, not values that differ per theme**: fonts, a node's corners, frame and padding, a
  handle's size and shape, an edge's stroke and dashes, the grid's pattern, the focus ring read
  the `--fl-*` tokens each theme declares (listed in `examples/shared/src/themes/<name>.css`).
  Positions and sizes are the flow's document, never tokens.
- **A controlled flow keeps its children functions stable** (a module function such as
  `renderNode`): a new function re-renders every node.

## Rules

- **Copyable imports only**: `react`, `@fragiola/flow-react` and its feature entries
  (`@fragiola/flow-react/drag`, …; it re-exports the core), `lucide-react`, Fragiola UI
  (`#/components/ui/*`, `#/components/atoms/*`, `#/lib/cn`), and relative files inside
  `src/examples/`. `#/` is the app's `src/`; `@name` is reserved for packages (site export
  contract, §6), so `@/` is never used. `tests/examples.test.ts` enforces it.
- **Theme-agnostic**: style through palette roles (`bg-palette-base`, …) and the theme tokens
  (`--fl-*`), never fixed colours, so the example works in every theme.
- **App policy stays in the app**: persistence, undo and redo, connection rules, announcements and
  every cosmetic style live in the example or in `_kit/`, never in a package.
- **Fragiola UI is vendored** by `scripts/vendor-fragiola.ts` (`pnpm --filter examples-react
  vendor`, `FRAGIOLA_REGISTRY` points it at another registry) and committed; the build never
  fetches.
- **No modal**: no example opens a Dialog, AlertDialog or Drawer, so the embed has no overlay
  promotion (site export contract §5.4); the inspector's Select is a non-modal popup and stays in
  the frame.
