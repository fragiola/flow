import { Component, computed, inject, input, output } from "@angular/core";
import { FLOW, FlowEdgeDirective } from "@fragiola/flow-angular";
import { LABELS, type Types } from "./index";
import { DASH_PERIOD, describeMotion, travelSeconds } from "./motion";
import { styles } from "./styles";

/**
 * An animated edge (on the edge's own group): a dot travelling its path, dashes flowing along it,
 * or one pulse when a value passes, each still under reduced motion but the pulse. The dot's path
 * is the edge's own (`flowEdge`'s `state().path`), read here so it follows a drag in this view
 * alone. Both paths are always written: the edge never takes its default one.
 */
@Component({
    selector: "[exampleAnimatedEdge]",
    imports: [FLOW],
    host: {
        "[attr.aria-label]": "label()",
        "[attr.data-reduced-motion]":
            "motion() !== 'pulse' && reduced() ? '' : null",
        "[attr.data-pulsing]": "pulsing() ? '' : null",
        "(animationend)": "onAnimationEnd($event)",
    },
    template: `
        <!-- a wide transparent path: a bigger target for a click -->
        <svg:path flowEdgePath [class]="styles.edgeHit" />
        <svg:path flowEdgePath [class]="styles.edge(motion())">
            @if (motion() === "dash" && moving()) {
                <svg:animate
                    attributeName="stroke-dashoffset"
                    [attr.from]="dashPeriod"
                    to="0"
                    dur="0.8s"
                    repeatCount="indefinite"
                />
            }
        </svg:path>
        @let drawn = path();
        @if (motion() === "travel" && moving() && drawn) {
            <svg:circle r="6" data-testid="traveller" [class]="styles.traveller">
                <svg:animateMotion
                    [attr.path]="drawn.path"
                    [attr.dur]="seconds(drawn.source, drawn.target) + 's'"
                    repeatCount="indefinite"
                />
            </svg:circle>
        }
    `,
})
export class AnimatedEdge {
    readonly reduced = input.required<boolean>();
    readonly sending = input.required<boolean>();
    /** the pulse ended: the value arrives */
    readonly arrive = output();
    protected readonly styles = styles;
    protected readonly dashPeriod = DASH_PERIOD;
    protected readonly seconds = travelSeconds;
    private readonly edge = inject<FlowEdgeDirective<Types>>(FlowEdgeDirective);
    protected readonly motion = computed(() => {
        const edge = this.edge.flowEdge();
        return edge.type === "animated" && edge.data
            ? edge.data.motion
            : "dash";
    });
    protected readonly path = computed(() => this.edge.state()?.path);
    protected readonly moving = computed(
        () => this.motion() !== "pulse" && !this.reduced(),
    );
    protected readonly pulsing = computed(
        () => this.motion() === "pulse" && this.sending(),
    );
    protected readonly label = computed(() => {
        const { source, target } = this.edge.flowEdge();
        return `${LABELS[source]} to ${LABELS[target]}: ${describeMotion(this.motion(), this.reduced())}`;
    });

    protected onAnimationEnd(event: AnimationEvent): void {
        // only the group's own pulse, not an animation inside it
        if (event.target === event.currentTarget && this.pulsing())
            this.arrive.emit();
    }
}
