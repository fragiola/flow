# Docs and examples gaps

Epic #8 wrote the React adapter, the playground, nineteen examples (`examples/react`) and the
site's documentation (`site/docs`) against the packages as they are. Everything the examples or the
documentation work around is listed here, as input for the next Epics, in the spirit of Dockable's
and Splitter's reports of the same name. Each workaround is also commented in the code or explained
on its docs page, since users copy it. The public side of this list is the site's
[Limitations](../site/docs/limitations.mdx) page (what xyflow has that Flow does not, and what to do
instead).

## 1. Package gaps (proposed API)

| # | needed by | needed | workaround | proposed API |
|---|---|---|---|---|
| F1 | the playground's fixture (`apps/playground/src/fixture/flow-fixture.tsx`), the touch reconnection E2E | Grab an edge's end with a finger. A reconnect anchor is drawn under its node's handle (edges come before nodes), and a finger beside a handle lands on the handle (Chromium's touch adjustment). | `reconnection({ radius: 30 })`: a press on the stroke within 30 px of an end moves that end. | A larger default radius on coarse pointers, or an anchor layer above the nodes. |

No example works around anything else: undo, persistence, announcements and connection rules are
app code by design (rule: no text, no app policy in the package), not gaps.

## 2. Closed gaps

None yet.
