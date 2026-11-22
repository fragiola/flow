// @fragiola/flow/keyboard: the keyboard feature. An opt-in entry: the main entry never imports
// it, and an app that never installs it never ships it.
export {
    type BeforeDelete,
    type DeleteDecision,
    type KeyboardFeature,
    type KeyboardOptions,
    keyboard,
} from "./keyboard";
