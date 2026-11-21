// The Svelte options of @fragiola/flow-svelte, read by svelte-package, svelte-check and the Vite
// plugin (the tests): every component is in runes mode. TypeScript in `<script lang="ts">` needs no
// preprocessor (Svelte 5 strips the types itself).
/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
export default {
    compilerOptions: { runes: true },
};
