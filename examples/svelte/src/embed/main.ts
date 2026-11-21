// examples/vue/src/embed/main.ts for the Svelte app.
import { followTheme } from "examples-shared/embed/messages";
import { mount } from "svelte";
import Embed from "./embed.svelte";
import Index from "./embed-index.svelte";
import { LOADERS } from "./loaders.generated";
import "./styles.css";

// `?id=<id>` renders one example on the whole viewport, with no chrome: the site puts it in an
// iframe (contract v1.7, §5). The theme is already on `<body>` (vite.shared.ts, before the first
// paint); the site changes it with a message. Without an id, a plain list of links (local checks).
// The same protocol, markup and messages as examples/react's and examples/vue's embeds.

const stage = document.getElementById("root");
if (stage) {
    const id = new URLSearchParams(location.search).get("id");
    if (id && LOADERS[id]?.layout === "flow") {
        // a flow example sizes the frame: the stage takes its content's height
        stage.style.height = "auto";
        stage.style.gridTemplate = "auto / minmax(0, 1fr)";
    }
    followTheme();
    if (id) mount(Embed, { target: stage, props: { id } });
    else mount(Index, { target: stage });
}
