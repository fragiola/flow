# Examples (Vue)

The same examples as `examples/react/src/examples` (its README is the authoring guide: levels,
anatomy, rules), with the same ids, metadata (`examples/shared/src/meta`), behaviour, names and
test ids, written in Vue 3.5 with `@fragiola/flow-vue`. Every shared spec
(`examples/shared/e2e`) runs here unchanged, in the five themes; Vue is a complete framework
(`COMPLETE_FRAMEWORKS`), so a missing example fails.

```
src/examples/
  <id>/index.vue     the example: a plain <script lang="ts"> (the header comment, the registry
                     type, the features, the data), then <script setup> and the template
  <id>/styles.ts     copied from examples/react as it is (tests/vendored.test.ts)
  <id>/*.vue         a component React writes in the same .tsx file (an SFC holds one)
  <id>/*.ts          plain siblings, copied from examples/react with the adapter's name swapped
  _kit/              persistence.ts and undo.ts, framework-free: copied as they are
```

What differs from React, by Vue's idioms:

- `const Flow = typedFlow<Types, typeof features>()` types the primitives (a template takes no type
  argument); `<Flow.Nodes v-slot="{ node }">`, `<Flow.Edges v-slot="{ edge }">`.
- Controlled lists and viewport are `v-model:nodes`, `v-model:edges`, `v-model:viewport`; the flow
  ref is `useFlowRef()` bound with `:flow-ref`, read as `flow.value`.
- Classes are bound from `styles.ts` (`:class="styles.node"`, `:class="styles.tone(tone)"`): no
  `class="…"`, no string inside `:class`, no `cn()` in a template (tests/examples.test.ts). The
  part's state is styled through its `data-*`, never a function.
- A panel outside the root reads the model with `model.subscribe` into a `shallowRef` (the
  workflow builder's `use-workflow.ts`); a subscription ends in `onUnmounted` or
  `onScopeDispose`.
- Fragiola UI has no Vue registry: `#/components/atoms/{badge,fields}` and
  `#/components/ui/{field,select}` are ports of the vendored React pieces (Reka UI under the
  Select), wearing the same classes from the copied families (`src/components/families`).
