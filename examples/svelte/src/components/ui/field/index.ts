// Svelte port of the Fragiola UI field (examples/react/src/components/ui/field.tsx): the same parts,
// classes and palette roles from the `field` family. Base UI's Field wires the label to the control
// in React; here `Field.Root` gives its parts one id (`$props.id()`), the label's `for` and the
// control's `id` (`#/components/atoms/fields`, `#/components/ui/select`), so a control is named by
// its label.
import FieldBody from "./field-body.svelte";
import FieldInset from "./field-inset.svelte";
import FieldLabel from "./field-label.svelte";
import FieldRoot from "./field-root.svelte";
import FieldRow from "./field-row.svelte";

export const Field = {
    Root: FieldRoot,
    Label: FieldLabel,
    Row: FieldRow,
    Body: FieldBody,
    Inset: FieldInset,
};
