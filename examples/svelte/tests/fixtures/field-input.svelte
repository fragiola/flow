<!-- A field with its label and a text input. -->
<script lang="ts">
    import { Input } from "#/components/atoms/fields";
    import { Field } from "#/components/ui/field";
</script>

<Field.Root>
    <Field.Label>Name</Field.Label>
    <Field.Row>
        <Field.Body>
            <Input value="Start" />
        </Field.Body>
    </Field.Row>
</Field.Root>
