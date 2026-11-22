import { FlowBackgroundDirective } from "./directives/background.directive";
import { FlowConnectionLineDirective } from "./directives/connection-line.directive";
import { FlowControlsDirective } from "./directives/controls.directive";
import { FlowEdgeDirective } from "./directives/edge.directive";
import { FlowEdgeLabelDirective } from "./directives/edge-label.directive";
import { FlowEdgePathDirective } from "./directives/edge-path.directive";
import { FlowEdgeToolbarDirective } from "./directives/edge-toolbar.directive";
import {
    FlowEdgesDirective,
    FlowEdgesItemDirective,
} from "./directives/edges.directive";
import { FlowFitViewDirective } from "./directives/fit-view.directive";
import { FlowHandleDirective } from "./directives/handle.directive";
import { FlowNodeDirective } from "./directives/node.directive";
import { FlowNodeToolbarDirective } from "./directives/node-toolbar.directive";
import {
    FlowNodesDirective,
    FlowNodesItemDirective,
} from "./directives/nodes.directive";
import { FlowNodesSelectionDirective } from "./directives/nodes-selection.directive";
import { FlowReconnectAnchorDirective } from "./directives/reconnect-anchor.directive";
import { FlowRootDirective } from "./directives/root.directive";
import { FlowSelectionBoxDirective } from "./directives/selection-box.directive";
import { FlowToggleInteractiveDirective } from "./directives/toggle-interactive.directive";
import { FlowViewportDirective } from "./directives/viewport.directive";
import { FlowZoomInDirective } from "./directives/zoom-in.directive";
import { FlowZoomOutDirective } from "./directives/zoom-out.directive";

/**
 * Every Flow directive of the main entry, for a standalone component's `imports`:
 * `@Component({ imports: [FLOW], … })` (React's `Flow` namespace). The features' directives are
 * on their entries (`FLOW_MINIMAP` on `@fragiola/flow-angular/minimap`, `FLOW_RESIZE` on
 * `/resize`).
 */
export const FLOW = [
    FlowRootDirective,
    FlowViewportDirective,
    FlowNodesDirective,
    FlowNodesItemDirective,
    FlowNodeDirective,
    FlowHandleDirective,
    FlowEdgesDirective,
    FlowEdgesItemDirective,
    FlowEdgeDirective,
    FlowEdgePathDirective,
    FlowEdgeLabelDirective,
    FlowReconnectAnchorDirective,
    FlowConnectionLineDirective,
    FlowNodesSelectionDirective,
    FlowSelectionBoxDirective,
    FlowBackgroundDirective,
    FlowControlsDirective,
    FlowZoomInDirective,
    FlowZoomOutDirective,
    FlowFitViewDirective,
    FlowToggleInteractiveDirective,
    FlowNodeToolbarDirective,
    FlowEdgeToolbarDirective,
] as const;
