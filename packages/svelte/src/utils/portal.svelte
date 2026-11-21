<!--
    Renders its children into another element (`target`): the edges' HTML layer for an edge label
    (SVG holds no HTML), the root for a node toolbar (outside the zoom). Svelte has no portal: the
    content is mounted there as its own component, with every context of this place
    (`getAllContexts`), and unmounted when this goes or the target changes. Nothing renders where
    it is written, and nothing on the server (as React's portal before its target exists).
-->
<script lang="ts">
    import { getAllContexts, mount, type Snippet, unmount } from "svelte";
    import PortalContent from "./portal-content.svelte";

    let {
        target,
        children,
    }: { target: Element | null | undefined; children: Snippet } = $props();

    const contexts = getAllContexts();
    $effect(() => {
        const into = target;
        if (!into) return;
        const content = mount(PortalContent, {
            target: into,
            props: {
                get children() {
                    return children;
                },
            },
            context: contexts,
        });
        return () => {
            void unmount(content);
        };
    });
</script>
