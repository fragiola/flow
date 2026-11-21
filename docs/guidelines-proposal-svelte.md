# Guidelines proposal: Svelte adapters

Flow's Svelte adapter (`@fragiola/flow-svelte`, Epic #14, Issue #12) is the first Svelte adapter
of the Fragiola ecosystem. The guidelines (`../guidelines`, not a git repository) say nothing about
Svelte yet; this page holds the text proposed for them, for the maintainer to apply. The decisions
behind it, with their reasons, are in this repository's `AGENTS.md` ("The Svelte adapter (Issue
#12)").

## 1. `repository.md#source-layout`

### Names

Add after the Vue sentence of "Suffixes stay":

> Svelte components are kebab-case too (`node-resizer.svelte`), and so are Svelte's reactive
> modules, whose `.svelte.ts` suffix stays (`use-flow.svelte.ts`): a module that uses a rune
> (`$state`, `$derived`, `$effect`) must carry it.

### Folders by responsibility

Add a row to the table:

| package | folders | reference |
| --- | --- | --- |
| Svelte adapter | `components/` (`.svelte`), `runes/` (`.svelte.ts`), `utils/` | `../flow/packages/svelte/src` |

Add to the list of entries at a `src/` root: nothing new (`index.ts`, `parts.ts`, the root
context; Flow also keeps `typed.ts`, as its Vue adapter does). Add after "A primitive has the same
file name in every adapter":

> … `tab-list.tsx` in React, `tab-list.ts` in Vue, `tab-list.svelte` in Svelte. A Svelte package
> has no `src/lib/` (SvelteKit's convention): `svelte-package --input src`. Its relative imports
> carry their extension (`./context.js`, `./root.svelte`), since `svelte-package` does not rewrite
> them.

`check:layout` needs no change for this (the name before the first dot is checked); its test
should list `.svelte` and `.svelte.ts` names (Flow: `site/tests/check-layout.test.ts`).

## 2. `architecture/core-and-adapters.md`

### The package table

Change the "later" row to name Svelte's dependency:

| package | name | contains | depends on |
| --- | --- | --- | --- |
| later | `@fragiola/<x>-vue`, `-svelte`, `-angular` | the same primitives in that framework | the core; Svelte: peer `svelte` `^5.29` (attachments) |

### Adapter rules

Replace the source-layout bullet with:

> - Sources are organized in kebab-case files and folders by responsibility: `components/`,
>   `hooks/` (Vue: `composables/`; Svelte: `runes/`; Angular: `directives/` and `inject/`) and
>   `utils/` ([repository: Source layout](../repository.md#source-layout)).

Add a section after "Adapter rules":

> ## A Svelte adapter
>
> Reference: `../flow/packages/svelte` (Flow, Epic #14). Svelte 5, runes mode only.
>
> - **Composition.** A collection part takes a `children` snippet called per entity
>   (`{#snippet children(node)}`: React's children function). `render` is a snippet prop given
>   `{ props, state, children }`: the app spreads `props` on its own element and renders
>   `children` inside it (`{#snippet render({ props, children })}<section {...props}>{@render
>   children()}</section>{/snippet}`): the Svelte form of "render, never asChild". No `as`, no
>   element form.
> - **Refs and DOM work are attachments.** A primitive registers its element (with the engine,
>   with the consumer's `bind:ref`) through attachments (`createAttachmentKey`) in the props it
>   spreads, so the element a `render` snippet renders gets them too; a consumer's `{@attach …}` on
>   a primitive reaches its element. `ref = $bindable()` with no fallback (Svelte refuses
>   `bind:ref={undefined}` on a prop with one).
> - **Handlers, class, style.** Consumer handlers (`onclick`) compose after the primitive's own;
>   `class` takes any of Svelte's forms, `style` a string or a record, and both a function of the
>   state, as in React (Svelte does not normalize a component's props). Structural style keys win.
>   A spread `style` string replaces the element's whole style when it changes: a style the core
>   writes on an element (a transform, `touch-action`) is carried in the structural style too.
> - **State.** The model's frozen state never becomes a deep proxy: the root holds what changes in
>   `$state.raw` and bumps a revision on every commit and view change; each part reads in a
>   `$derived` that keeps its last object while equal. What the app gives goes through
>   `$state.snapshot` unless frozen. A value written back to a `bind:` the app keeps in a deep
>   `$state` is copied (a proxy of a frozen value breaks on its next write).
> - **Controlled props.** `bind:<value>` (`$bindable`) plus a lowercase callback
>   (`on<value>change`), mapped onto commands as in the other adapters.
> - **Hooks are runes** in `.svelte.ts` files: a part rune takes the entity or a getter of it and
>   returns `{ state, props }` as getters; a value rune returns `{ current }`. An external ref's
>   `current` is reactive.
> - **Portals** do not exist in Svelte: a part rendered elsewhere (a label in an HTML layer, a
>   toolbar outside the zoom) `mount`s its content in the target with the contexts of its place
>   (`getAllContexts`), and unmounts it with the part.
> - **Types.** A part typed by the registry is a generic component (`generics="T extends …"`); a
>   template passes no type argument, so the package also exports `typedFlow<T, F>()`-style typed
>   views of the namespace (Vue's). The namespace is `parts.ts` (`export { default as Root } from
>   "./components/root.svelte"`), re-exported as `export * as <Name>`.
>
> ### Toolchain and packaging
>
> - Built by `@sveltejs/package` (`dist/` mirrors `src/`: `.svelte` files as they are, a `.d.ts`
>   beside each), typechecked by `svelte-check --fail-on-warnings` as the package's `typecheck`,
>   tested with Vitest, jsdom and `@testing-library/svelte` (the flows under test are components,
>   in `tests/fixtures/`; a server render opts into node with `svelte/server`).
> - **TypeScript 6** for the Svelte package and its smoke app while `svelte-check` and
>   `svelte-package` do not take TypeScript 7 (the Vue `vue-tsc` precedent).
> - `exports`: `types`, `svelte`, `default` per entry (the source condition first in the repo,
>   `publishConfig.exports` dist-only), plus the legacy `svelte` field. The package check allows
>   the `svelte` condition.
> - **attw:** a Svelte package's declarations import `./x.svelte`, which `node16` cannot resolve;
>   the package check accepts that one problem (`InternalResolutionError` of a `.svelte` import
>   under `node16`) and nothing else.
> - **`check-dts`:** svelte2tsx's `z_$$bindings` member of a generic component uses `any`; the
>   check skips that member only.
> - **The features' bundle guard** reads source maps for a bundled package; an unbundled Svelte
>   build has none, so each built file is its own source and its relative imports are followed.
> - **The smoke app:** a scratch Vite + Svelte 5 app (`@sveltejs/vite-plugin-svelte`) outside the
>   workspace installs the tarball only, runs `svelte-check`, builds and loads its dev server; its
>   pins come from the examples app, else the package.

## 3. `ecosystem.md`

Principle 1 ("Each framework gets a thin adapter (`@fragiola/<x>-react` today; Vue, Angular, ...
later)") could read "React, Vue, Svelte today; Angular, ... later", and the projects table's Flow
row (not listed yet) would name `@fragiola/flow-svelte`.

## 4. `decisions.md`

Nothing open: no Svelte rule contradicts a guideline. One drift to record if the maintainer wants
it: the attw and `check-dts` exceptions above are Svelte tooling limits, to drop when
`svelte-check` / svelte2tsx and TypeScript resolve `.svelte` declarations under `node16`.
