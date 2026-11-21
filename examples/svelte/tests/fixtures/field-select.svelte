<!-- A field with its label and a select. -->
<script lang="ts">
    import { Field } from "#/components/ui/field";
    import { Select } from "#/components/ui/select";
</script>

<Field.Root>
    <Field.Label>Starts on</Field.Label>
    <Select.Root value="schedule">
        <Select.Item value="webhook">Webhook</Select.Item>
        <Select.Item value="schedule">Schedule</Select.Item>
    </Select.Root>
</Field.Root>
