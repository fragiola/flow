// The id `Field.Root` gives its label (`for`) and its control (`id`), so a control is named by its
// label: Base UI's Field does this wiring in React.
import { getContext, setContext } from "svelte";

const FIELD_CONTROL_ID = Symbol("field-control");

/** Gives the parts inside a field its control's id (called by `Field.Root`). */
export function setFieldControlId(id: string): void {
    setContext(FIELD_CONTROL_ID, id);
}

/** The id the control of the enclosing `Field.Root` takes, if any. */
export function fieldControlId(): string | undefined {
    return getContext<string | undefined>(FIELD_CONTROL_ID);
}
