// The public entry of @fragiola/flow, the framework-free core of Flow: the document and its JSON
// Schema, the model and its commands, and the feature contract. Each feature is its own entry
// (`@fragiola/flow/selection`, `/subflows`, `/drag`, `/resize`, `/connection`, `/reconnection`,
// `/keyboard`, `/minimap`), which this one never imports (`scripts/check-features.ts`). The engine
// arrives with fragiola/flow#3.

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
export type {
    AnyTypes,
    BuiltInEdgeType,
    EdgeDataOf,
    EdgeFields,
    EdgeFlags,
    EdgeOf,
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
    FeatureEngine,
    FeatureEngineHost,
    FeatureModel,
    FeatureNamesOf,
    FlowFeature,
    FlowFeatures,
    FlowReader,
    ModelGetKeyOf,
    ModelIsKeyOf,
} from "./features/types";
export {
    type CommandArgs,
    createFlowModel,
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
    NoPayload,
    QueryArgs,
} from "./state/queries";
