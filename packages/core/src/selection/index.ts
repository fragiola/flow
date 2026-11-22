// @fragiola/flow/selection: the selection feature. An opt-in entry: the main entry never imports
// it, and an app that never installs it never ships it.
export {
    type BoxSelectionMode,
    type SelectionFeature,
    type SelectionKey,
    type SelectionOptions,
    selection,
} from "./selection";
