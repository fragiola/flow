<!-- The sender's body: "Send a value" starts the pulse while the flow still has its edge. -->
<script lang="ts">
    import { type FlowEdge, useFlowStore } from "@fragiola/flow-svelte";
    import { SendIcon } from "@lucide/svelte";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";

    let {
        label,
        sending,
        onsend,
        ondrop,
    }: { label: string; sending: boolean; onsend: () => void; ondrop: () => void } = $props();

    /** Whether the flow still has the edge that pulses: deleted, nothing carries a value. */
    const pulse = useFlowStore<boolean, Types, typeof features>(({ model }) =>
        model
            .get("all-edges")
            .some(
                (edge: FlowEdge<Types>) =>
                    edge.type === "animated" && edge.data?.motion === "pulse",
            ),
    );

    // the pulse's edge deleted while a value was on its way: no animationend will come
    $effect(() => {
        if (sending && !pulse.current) ondrop();
    });

    function onSend() {
        if (pulse.current) onsend();
    }
</script>

<div class={styles.body}>
    {label}
    <button type="button" aria-label="Send a value" disabled={sending} onclick={onSend} class={styles.send}>
        <SendIcon aria-hidden="true" />
        Send
    </button>
</div>
