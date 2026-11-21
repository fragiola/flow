# Examples (Angular)

The same examples as `examples/react/src/examples` (its README is the authoring guide: levels,
anatomy, rules), with the same ids, metadata (`examples/shared/src/meta`), behaviour, names and
test ids, written in Angular 22 (standalone components, signals, zoneless, OnPush) with
`@fragiola/flow-angular`. Every shared spec (`examples/shared/e2e`) runs here unchanged, in the
five themes; Angular is a complete framework (`COMPLETE_FRAMEWORKS`), so a missing example fails.

```
src/examples/
  <id>/index.ts      the example: the header comment, the registry type, the features, the data,
                     then the component it default-exports (its template inline)
  <id>/styles.ts     copied from examples/react as it is (tests/vendored.test.ts)
  <id>/*.ts          a component React writes in the same .tsx file (a node, a panel), or a plain
                     sibling copied from examples/react with the adapter's name swapped
  _kit/              persistence.ts and undo.ts, framework-free: copied as they are
```

What differs from React, by Angular's idioms:

- The primitives are directives on the example's own elements: `<div flowRoot>`, `<div flowViewport>`,
  `<div [flowNode]="node">`, `<button flowZoomIn>`; a component imports `FLOW` (and `FLOW_MINIMAP`,
  `FLOW_RESIZE` from the feature entries).
- The model is made in a field (`createFlowModel<Types, typeof features>(json, { features })`)
  and given to the root (`[model]="model"`): `<ng-template [flowNodesItem]="model" let-node>` and
  `[flowEdgesItem]="model"` type each template's node and edge by the registry. Edge templates
  write their SVG elements with the `svg:` prefix (`<svg:g [flowEdge]="edge">`), an edge label with
  `xhtml:` (`<xhtml:div flowEdgeLabel>`).
- Controlled lists and viewport are `[(nodes)]`, `[(edges)]`, `[(viewport)]` over signals. A bound
  output checks the example's whole template on every emit (each drag step, each pan): bind one
  only where it is needed; `injectViewport()`, `injectSelection()` and the flow ref's
  `engine.subscribe` give live values without it. The flow ref is `createFlowRef()` in a field,
  given as `[flowRef]="flow"`, read as `flow.current` (a signal's value: a template follows it).
- Engine state in a template comes through a signal: a template reading `engine.can(…)` alone
  never updates.
- Classes are bound from `styles.ts` (`[class]="styles.node"`, `[class]="styles.tone(tone)"`):
  no `class="…"`, no string inside `[class]="…"`, no `[class.x]` and no `cn()` in a template
  (tests/examples.test.ts). The part's state is styled through its `data-*`, never a binding of
  its state.
- A panel outside the root reads the model with `model.subscribe` into signals (the workflow
  builder's `inject-workflow.ts`), the listener stopped by the component's `DestroyRef`; a panel
  inside the root uses the injection functions (`injectSelection()`, …), which need the root: they
  are called in a component rendered inside `flowRoot`, never in the one that renders it.
- Fragiola UI has no Angular registry: `#/components/atoms/{badge,fields}` and
  `#/components/ui/{field,select}` are ports of the vendored React pieces as directives
  (`span[kitBadge]`, `input[kitInput]`, `kitFieldRoot` …, `<kit-select>`), wearing the same
  classes from the copied families (`src/components/families`); the Select is a native `<select>`
  in the field's box, as examples/svelte's.
