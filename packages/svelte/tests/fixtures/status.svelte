<!-- The connection under way, from `useConnection`. -->
<script lang="ts">
    import { useConnection } from "../../src/index.js";

    const connection = useConnection();
</script>

<output
    data-flow-part="status"
    data-status={connection.current?.status ?? "none"}
></output>
