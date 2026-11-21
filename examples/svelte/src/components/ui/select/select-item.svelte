<!-- `Select.Item`: one option (`value`, its label as children). -->
<script lang="ts">
    import type { HTMLOptionAttributes } from "svelte/elements";

    let { children, ...rest }: HTMLOptionAttributes = $props();
</script>

<option data-slot="select-item" {...rest}>{@render children?.()}</option>
