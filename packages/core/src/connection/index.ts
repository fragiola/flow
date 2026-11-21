// @fragiola/flow/connection: the connection feature. An opt-in entry: the main entry never imports
// it, and an app that never installs it never ships it.
export {
    type ConnectionFeature,
    type ConnectionMode,
    type ConnectionOptions,
    connection,
} from "./connection";
