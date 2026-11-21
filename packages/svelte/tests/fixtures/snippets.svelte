<!--
    `render` snippets for every element a primitive renders: each spreads the primitive's props on
    its own element, marked `data-testid="case"`, renders the primitive's content, and records the
    state it was given in `seen`.
-->
<script module lang="ts">
    import type { RenderSnippetProps } from "../../src/index.js";

    type Given = RenderSnippetProps<unknown, Element>;

    /** The states the snippets were given, last one last. */
    export const seen: unknown[] = [];

    function record(state: unknown): string {
        seen.push(state);
        return "";
    }

    export { button, circle, div, g, path, rect, svg };
</script>

{#snippet div({ props, state, children }: Given)}
    <div {...props as object} data-testid="case">{record(state)}{@render children()}</div>
{/snippet}

{#snippet button({ props, state, children }: Given)}
    <button {...props as object} data-testid="case">{record(state)}{@render children()}</button>
{/snippet}

{#snippet svg({ props, state, children }: Given)}
    <svg {...props as object} data-testid="case">{record(state)}{@render children()}</svg>
{/snippet}

{#snippet g({ props, state, children }: Given)}
    <g {...props as object} data-testid="case">{record(state)}{@render children()}</g>
{/snippet}

{#snippet path({ props, state }: Given)}
    <path {...props as object} data-testid="case">{record(state)}</path>
{/snippet}

{#snippet circle({ props, state }: Given)}
    <circle {...props as object} data-testid="case">{record(state)}</circle>
{/snippet}

{#snippet rect({ props, state }: Given)}
    <rect {...props as object} data-testid="case">{record(state)}</rect>
{/snippet}
