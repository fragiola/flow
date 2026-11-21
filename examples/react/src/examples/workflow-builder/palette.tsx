import { CATALOG, type CatalogEntry } from "./catalog";
import { styles } from "./styles";

// The step palette: each entry is dragged onto the canvas with the browser's drag and drop, or
// clicked to add the step in the middle of the view.

export const STEP_MIME = "application/x-workflow-step";

const GROUPS = ["Triggers", "Actions", "Logic"] as const;

export function Palette({ onAdd }: { onAdd: (entry: CatalogEntry) => void }) {
    return (
        <nav aria-label="Steps" className={styles.palette}>
            {GROUPS.map((group) => (
                <section
                    key={group}
                    aria-labelledby={`palette-${group}`}
                    className={styles.paletteGroup}
                >
                    <h3
                        id={`palette-${group}`}
                        className={styles.paletteHeading}
                    >
                        {group}
                    </h3>
                    {CATALOG.filter((entry) => entry.group === group).map(
                        (entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                draggable
                                onDragStart={(event) => {
                                    event.dataTransfer.setData(
                                        STEP_MIME,
                                        entry.id,
                                    );
                                    event.dataTransfer.effectAllowed = "copy";
                                }}
                                onClick={() => onAdd(entry)}
                                className={styles.paletteItem}
                            >
                                <span className={styles.paletteIcon(group)}>
                                    <entry.icon />
                                </span>
                                {entry.label}
                            </button>
                        ),
                    )}
                </section>
            ))}
        </nav>
    );
}
