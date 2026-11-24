import { Component, signal } from "@angular/core";
import { injectFlow, type Rect } from "@fragiola/flow-angular";
import { LucideRoute, LucideSpline } from "@lucide/angular";
import { type Features, nameOf, type Types } from "./index";
import { routeAround } from "./routing";
import { styles } from "./styles";

/** The actions over every editable edge: route them around the nodes, or straighten them. */
@Component({
    selector: "example-editable-edge-actions",
    imports: [LucideRoute, LucideSpline],
    host: { class: "contents" },
    template: `
        <div [class]="styles.panel">
            <div role="toolbar" aria-label="Edge actions" [class]="styles.actions">
                <button type="button" (click)="route()" [class]="styles.action">
                    <svg lucideRoute aria-hidden="true"></svg>
                    Route
                </button>
                <button type="button" (click)="clear()" [class]="styles.action">
                    <svg lucideSpline aria-hidden="true"></svg>
                    Clear points
                </button>
            </div>
            <p [class]="styles.hint">
                Double-click an edge to add a point, drag a point to bend it, Delete removes it.
            </p>
            <p role="status" [class]="styles.status">{{ status() }}</p>
        </div>
    `,
})
export class Actions {
    protected readonly styles = styles;
    protected readonly status = signal("");
    private readonly flow = injectFlow<Types, Features>();

    protected route(): void {
        const { engine } = this.flow;
        const model = this.flow.model();
        const obstacles = model
            .get("all-nodes")
            .map((node) => engine.get("node-rect-by", { nodeId: node.id }))
            .filter((rect): rect is Rect => rect !== undefined);
        const stuck: string[] = [];
        const commands = model.get("all-edges").flatMap((edge) => {
            const path = engine.get("edge-path-by", { edgeId: edge.id });
            if (!path) return [];
            const found = routeAround(
                {
                    point: path.source,
                    side: path.sourceSide,
                    node: engine.get("node-rect-by", { nodeId: edge.source }),
                },
                {
                    point: path.target,
                    side: path.targetSide,
                    node: engine.get("node-rect-by", { nodeId: edge.target }),
                },
                obstacles,
            );
            if (!found.found) stuck.push(nameOf(edge));
            return [
                {
                    command: "edge.set-data" as const,
                    payload: {
                        edgeId: edge.id,
                        data: { points: found.points },
                    },
                },
            ];
        });
        model.run("batch", { commands });
        this.status.set(
            stuck.length === 0
                ? "Routed around the nodes."
                : `No way around for ${stuck.join(", ")}: a plain step stands in.`,
        );
    }

    protected clear(): void {
        const model = this.flow.model();
        model.run("batch", {
            commands: model.get("all-edges").map((edge) => ({
                command: "edge.set-data" as const,
                payload: { edgeId: edge.id, data: { points: [] } },
            })),
        });
        this.status.set("The edges are straight.");
    }
}
