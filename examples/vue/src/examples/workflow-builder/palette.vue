<script lang="ts">
import { CATALOG, type CatalogEntry } from "./catalog";
import { styles } from "./styles";

// The step palette: each entry is dragged onto the canvas with the browser's drag and drop, or
// clicked to add the step in the middle of the view.

export const STEP_MIME = "application/x-workflow-step";

const GROUPS = ["Triggers", "Actions", "Logic"] as const;
</script>

<script setup lang="ts">
const emit = defineEmits<{ add: [entry: CatalogEntry] }>();

function onDragStart(event: DragEvent, entry: CatalogEntry) {
    event.dataTransfer?.setData(STEP_MIME, entry.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
    <nav aria-label="Steps" :class="styles.palette">
        <section
            v-for="group in GROUPS"
            :key="group"
            :aria-labelledby="`palette-${group}`"
            :class="styles.paletteGroup"
        >
            <h3 :id="`palette-${group}`" :class="styles.paletteHeading">
                {{ group }}
            </h3>
            <button
                v-for="entry in CATALOG.filter((item) => item.group === group)"
                :key="entry.id"
                type="button"
                draggable="true"
                :class="styles.paletteItem"
                @dragstart="onDragStart($event, entry)"
                @click="emit('add', entry)"
            >
                <span :class="styles.paletteIcon(group)">
                    <component :is="entry.icon" />
                </span>
                {{ entry.label }}
            </button>
        </section>
    </nav>
</template>
