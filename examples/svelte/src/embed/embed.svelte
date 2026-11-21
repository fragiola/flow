<!--
    One example on the whole viewport (`?id=<id>`). It says `ready` once the example has mounted:
    the flow's engine is created in its root's effect and measures its nodes in the next task, so it
    waits two frames, and the site shows the frame with the nodes measured and the edges drawn. A
    frame the browser does not render gets no animation frames, so a timeout sends it anyway. An
    example that throws shows its error (a boundary), and says `ready` too.
-->
<script lang="ts">
    import { postReady, reportHeight } from "examples-shared/embed/messages";
    import type { Component } from "svelte";
    import { LOADERS } from "./loaders.generated";

    const READY_TIMEOUT_MS = 500;

    let { id }: { id: string } = $props();

    const loader = $derived(LOADERS[id]);
    let Example = $state.raw<Component | undefined>();
    let error = $state.raw<Error | undefined>();
    let content = $state<HTMLElement>();
    let sent = false;

    function ready(): void {
        if (sent) return;
        sent = true;
        postReady(id);
        if (loader?.layout === "flow" && content) reportHeight(id, content);
    }

    function fail(caught: unknown): void {
        console.error(caught);
        error = caught instanceof Error ? caught : new Error(String(caught));
        ready();
    }

    $effect(() => {
        loader?.load().then((module) => {
            Example = module.default;
        }, fail);
    });

    // after the example (or the unknown id's message) is in the document
    $effect(() => {
        if (loader && !Example) return;
        let second = 0;
        const first = requestAnimationFrame(() => {
            second = requestAnimationFrame(ready);
        });
        const fallback = setTimeout(ready, READY_TIMEOUT_MS);
        return () => {
            cancelAnimationFrame(first);
            cancelAnimationFrame(second);
            clearTimeout(fallback);
        };
    });
</script>

{#if !loader}
    <div role="alert" class="m-4 self-start">Unknown example "{id}"</div>
{:else if error}
    <div
        role="alert"
        class="palette-danger m-4 self-start rounded-md bg-palette-soft p-4 text-palette-accent"
    >
        This example failed: {error.message}
    </div>
{:else if Example}
    <svelte:boundary onerror={fail}>
        <div bind:this={content} data-testid="example-root" class="flex min-h-0 min-w-0 flex-col">
            <Example />
        </div>
    </svelte:boundary>
{/if}
