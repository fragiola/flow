// Svelte port of the Fragiola UI select (examples/react/src/components/ui/select.tsx) as a native
// `<select>`: its box wears React's trigger classes (`field.row`, the chevron after the value), its
// options are the platform's. No headless select primitive for Svelte is added for one inspector
// field (React's is Base UI, Vue's Reka UI); the native element is labelled, keyboard-operable and
// a `combobox` to assistive technology as they are.
import SelectItem from "./select-item.svelte";
import SelectRoot from "./select-root.svelte";

export const Select = {
    Root: SelectRoot,
    Item: SelectItem,
};
