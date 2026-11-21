<!-- Without an id, a plain list of the examples (local checks). -->
<script lang="ts">
    import { LOADERS } from "./loaders.generated";
</script>

<ul class="m-4 flex flex-col gap-1 self-start">
    {#each Object.keys(LOADERS) as id (id)}
        <li><a class="underline" href={`?id=${id}`}>{id}</a></li>
    {/each}
</ul>
