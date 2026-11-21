// @fragiola/flow/reconnection: the reconnection feature (it requires `connection()`). An opt-in
// entry: the main entry never imports it, and an app that never installs it never ships it.
export {
    type ReconnectionFeature,
    type ReconnectionOptions,
    reconnection,
} from "./reconnection";
