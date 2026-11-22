<!--
    Two nodes with named handles (`a`'s source `out`, `b`'s target `in`), for the handles' roles
    (`connectableStart` / `connectableEnd`) and the reconnect anchors of an edge's ends (#33).
-->
<script lang="ts">
    import { connection } from "@fragiola/flow/connection";
    import { reconnection } from "@fragiola/flow/reconnection";
    import { Flow, type RootProps } from "../../src/index.js";
    import { task } from "../flow.js";

    let {
        start,
        end,
        reconnectable,
        ...rest
    }: RootProps & {
        start?: boolean;
        end?: boolean;
        reconnectable?: boolean | "source" | "target";
    } = $props();
</script>

<Flow.Root
    defaultNodes={[task("a", 0, 0), task("b", 300, 0)]}
    defaultEdges={reconnectable === undefined
        ? []
        : [
              {
                  id: "e",
                  source: "a",
                  sourceHandle: "out",
                  target: "b",
                  targetHandle: "in",
                  reconnectable,
              },
          ]}
    features={[connection(), reconnection()]}
    {...rest}
>
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge}>
                    <Flow.EdgePath />
                    <Flow.ReconnectAnchor end="source" />
                    <Flow.ReconnectAnchor end="target" />
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node}>
                    {#if node.id === "a"}
                        <Flow.Handle
                            type="source"
                            side="right"
                            handleId="out"
                            connectableStart={start}
                        />
                    {:else}
                        <Flow.Handle
                            type="target"
                            side="left"
                            handleId="in"
                            connectableEnd={end}
                        />
                    {/if}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
</Flow.Root>
