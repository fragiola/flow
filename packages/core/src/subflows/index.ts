// @fragiola/flow/subflows: the sub-flows feature. An opt-in entry: the main entry never imports
// it, and an app that never installs it never ships it.
export {
    type SubflowsFeature,
    type SubflowsOptions,
    subflows,
} from "./subflows";
