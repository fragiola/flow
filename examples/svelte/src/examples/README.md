# Examples (Svelte)

The same examples as `examples/react/src/examples` (its README is the authoring guide: levels,
anatomy, rules), with the same ids, metadata (`examples/shared/src/meta`), behaviour, names and
test ids, written in Svelte 5 (runes) with `@fragiola/flow-svelte`. Every shared spec
(`examples/shared/e2e`) runs here unchanged, in the five themes; Svelte is a complete framework
(`COMPLETE_FRAMEWORKS`), so a missing example fails.

```
src/examples/
  <id>/index.svelte  the example: <script module lang="ts"> (the header comment, the registry
                     type, the features, the data), then <script lang="ts"> and the markup
  <id>/styles.ts     copied from examples/react as it is (tests/vendored.test.ts)
  <id>/*.svelte      a component React writes in the same .tsx file (a .svelte file holds one)
  <id>/*.ts          plain siblings, copied from examples/react with the adapter's name swapped
  <id>/*.svelte.ts   a sibling that holds runes (a `$state` needs the `.svelte` suffix)
  _kit/              persistence.ts and undo.ts, framework-free: copied as they are
```

What differs from React, by Svelte's idioms:

- `const Flow = typedFlow<Types, typeof features>()` types the primitives (a template takes no type
  argument); `{#snippet children(node)}` inside `<Flow.Nodes>`, `{#snippet children(edge)}` inside
  `<Flow.Edges>`; a `render` snippet spreads the primitive's props on the app's own element:
  `{#snippet render({ props, children })}<button {...props}>{@render children()}</button>{/snippet}`.
- Controlled lists and viewport are `bind:nodes`, `bind:edges`, `bind:viewport` over `$state.raw`
  (a list mutated in place is not seen: assign a new one); the flow ref is `useFlowRef()` given as
  `flowRef={flow}`, read as `flow.current`. Callback props are lowercase (`onnodeschange`).
- A sibling component imports the types and the features from `./index.svelte`'s module script
  (`import type { Types } from "./index.svelte"`).
- Classes are bound from `styles.ts` (`class={styles.node}`, `class={styles.tone(tone)}`): no
  `class="…"`, no string inside `class={…}`, no `cn()` in the markup (tests/examples.test.ts). The
  part's state is styled through its `data-*`, never a function.
- A panel outside the root reads the model with `model.subscribe` into `$state.raw` (the workflow
  builder's `use-workflow.svelte.ts`), the subscription ended by the effect that made it; a panel
  inside the root uses the runes (`useSelection()`, …), which need the root's context: they are
  called in a component rendered inside `<Flow.Root>`, never in the one that renders it.
- Fragiola UI has no Svelte registry: `#/components/atoms/{badge,fields}` and
  `#/components/ui/{field,select}` are ports of the vendored React pieces, wearing the same classes
  from the copied families (`src/components/families`); the Select is a native `<select>` in the
  field's box.
