// The public entry of @fragiola/flow, the framework-free core of Flow: the document and its JSON
// Schema, the model and its commands, the engine that binds a flow to the DOM, the edge path
// helpers, the engine-free static geometry (a server render), the part attributes and the feature
// contract. Each feature is its own entry
// (`@fragiola/flow/selection`, `/subflows`, `/drag`, `/resize`, `/connection`, `/reconnection`,
// `/keyboard`, `/minimap`), which this one never imports (`scripts/check-features.ts`).

export {
    DIRECTION_ATTRIBUTE,
    DRAG_HANDLE_ATTRIBUTE,
    END_ATTRIBUTE,
    edgesLayerAttributes,
    type FlowPart,
    flag,
    ID_ATTRIBUTE,
    LEVEL_ATTRIBUTE,
    type MutablePartAttributes,
    NO_GESTURE_ATTRIBUTE,
    NO_WHEEL_ATTRIBUTE,
    PART_ATTRIBUTE,
    type PartAttributes,
    POSITION_ATTRIBUTE,
    partAttributes,
    type ResizeHandleAttributeOptions,
    type ResizeHandleDirection,
    type ResizeHandleVariant,
    resizeHandleAttributes,
    VARIANT_ATTRIBUTE,
} from "./attributes/part-attributes";

export type {
    CommandDefinition,
    Failure,
    ReduceContext,
} from "./commands/define";
export type {
    BatchEntry,
    BatchStep,
    CommandContext,
    CommandContextBase,
    CommandContextGetKey,
    CommandContextGetMap,
    CommandError,
    CommandErrorCode,
    CommandEvent,
    CommandInfo,
    CommandListener,
    CommandMap,
    CommandName,
    CommandResult,
    ConnectionPayload,
    EdgeDataPatchOf,
    EdgeFlagsPayload,
    Middleware,
    NodeDataPatchOf,
    NodeFlagsPayload,
    PayloadOf,
    RemovedResult,
    ResultOf,
    RunOptions,
    SelectionMode,
    SelectionResult,
} from "./commands/types";
export { veto } from "./commands/veto";
export type { CreateId, IdKind } from "./document/create-id";
export {
    edgeSchema,
    flowDocumentSchema,
    nodeSchema,
} from "./document/document-schema";
export { FlowValidationError } from "./document/flow-validation-error";
export { isEdge, isNode } from "./document/type-guards";
export type {
    AnyTypes,
    BuiltInEdgeType,
    DeclaredHandle,
    EdgeDataOf,
    EdgeFields,
    EdgeFlags,
    EdgeOf,
    EdgePathOptions,
    EdgeTypeOf,
    FlowDocument,
    FlowDocumentJson,
    FlowEdge,
    FlowEdgeInput,
    FlowJson,
    FlowNode,
    FlowNodeInput,
    FlowTypes,
    NodeDataOf,
    NodeFields,
    NodeFlags,
    NodeOf,
    NodeTypeOf,
    SelectionFields,
    SubflowFields,
    XY,
} from "./document/types";
export {
    type ValidateFlowOptions,
    validateFlow,
} from "./document/validate-flow";
export type {
    FlowEngineAdapter,
    FlowHandle,
    HandleRegistration,
    PartPayloadMap,
    PressTarget,
    ViewChange,
} from "./engine/adapter";
export type { AutoPanGesture, AutoPanOptions } from "./engine/auto-pan";
export {
    createFlowEngine,
    type FlowEngine,
    type FlowEngineOptions,
    type PanOnScrollMode,
} from "./engine/create-flow-engine";
export {
    type CallbackEventType,
    ENGINE_EVENT_CALLBACKS,
    type EventCallbackName,
} from "./engine/event-callbacks";
export type {
    ConnectionDrop,
    ConnectionEnd,
    FlowEngineEvent,
    FlowEngineEventOf,
    FlowEngineEventType,
    FlowPointerInfo,
    MoveSource,
    SelectionDragStep,
} from "./engine/events";
export type {
    InteractionKind,
    Interactivity,
    InteractivityPayload,
} from "./engine/interactivity";
export type {
    BackgroundPattern,
    BackgroundPatternPayload,
    BackgroundVariant,
    Connection,
    EdgeToolbarPayload,
    EdgeToolbarPosition,
    EngineActionKey,
    EngineActionMap,
    EngineActionPayload,
    EngineActionResult,
    EngineGetKey,
    EngineGetMap,
    EngineGetPayload,
    EngineGetResult,
    EngineIsKey,
    EngineIsMap,
    EngineIsPayload,
    FitViewPayload,
    InternalNode,
    IntersectingNodesPayload,
    MinimapView,
    NodeToolbarPayload,
    NodeToolbarPosition,
    SelectionBox,
    ViewportForBoundsPayload,
    ZoomStepPayload,
} from "./engine/verbs";
export type { ViewportEasing } from "./engine/viewport-animation";
export {
    type KeyPressKeys,
    type KeyPressTarget,
    watchKeyPress,
} from "./engine/watch-key-press";
export {
    FEATURE_KEYS,
    type FeatureKeyKind,
    type FeatureName,
    type OwnedBy,
} from "./features/keys";
export type {
    AllowedKeys,
    AnyFlowFeature,
    CommandNameOf,
    EngineActionKeyOf,
    EngineGetKeyOf,
    EngineIsKeyOf,
    FeatureEngine,
    FeatureEngineHost,
    FeatureGesture,
    FeatureModel,
    FeatureNamesOf,
    FlowFeature,
    FlowFeatures,
    FlowReader,
    ModelGetKeyOf,
    ModelIsKeyOf,
} from "./features/types";
export {
    type BezierPathOptions,
    type BezierPathResult,
    bezierPath,
} from "./geometry/bezier-path";
export { type EdgeCenter, edgeCenter } from "./geometry/edge-center";
export type { PathOptions } from "./geometry/edge-geometry";
export {
    type SimpleBezierPathOptions,
    simpleBezierPath,
} from "./geometry/simple-bezier-path";
export {
    type SmoothStepPathOptions,
    type StepPathOptions,
    type StepTurnOptions,
    smoothStepPath,
    stepPath,
} from "./geometry/smooth-step-path";
export {
    type StaticGeometry,
    type StaticGeometryOptions,
    staticGeometry,
} from "./geometry/static-geometry";
export {
    type StraightPathOptions,
    straightPath,
} from "./geometry/straight-path";
export type {
    EdgePath,
    HandleSide,
    PathEnds,
    PathResult,
    Rect,
    Viewport,
} from "./geometry/types";
export {
    type FitPadding,
    type PaddingValue,
    type ViewportForBoundsOptions,
    viewportForBounds,
} from "./geometry/viewport-for-bounds";
export type { RenderLayer, ZIndexMode } from "./geometry/z-order";
export {
    type CommandArgs,
    createFlowModel,
    type DefaultEdgeOptions,
    type DispatchOptions,
    type FlowModel,
    type FlowModelOptions,
} from "./model/create-flow-model";
export type { FromSchema } from "./schema/from-schema";
export type {
    JsonSchema,
    JsonSchemaType,
    JsonValue,
    ValidationIssue,
} from "./schema/types";
export type {
    HandleType,
    ModelGetKey,
    ModelGetMap,
    ModelGetPayload,
    ModelGetResult,
    ModelIsKey,
    ModelIsMap,
    ModelIsPayload,
    NodeConnection,
    NodeData,
    NoPayload,
    QueryArgs,
} from "./state/queries";
export { sameFlowValue } from "./state/same-flow-value";
