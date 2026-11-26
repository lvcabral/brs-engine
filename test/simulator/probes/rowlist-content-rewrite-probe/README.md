# rowlist-content-rewrite-probe

When does a RowList give an item component its `itemContent` again after the item's ContentNode is
written?

One row of five items (`RewriteProbeItem`). Each item's `itemContent` observer prints its call count and,
depending on the item id, writes to its own content (it stops writing after 5 calls, so a loop shows as
`calls=5` instead of hanging):

| Item | Write from its own `itemContent` observer |
| --- | --- |
| `same-update` | `update({ actionId: "details" }, true)`, an unchanged value after the first call |
| `same-assign` | `title = "fixed"`, the value it already has |
| `new-assign` | `description = "d<n>"`, a new value each call |
| `external-same` | none; the scene assigns `title = "fixed"` (unchanged), later `update({ title: "fixed" })` |
| `external-new` | none; the scene assigns `title = "changed"` |

A plain `Node` also holds the `external-new` ContentNode in a `node` field and observes it.

## Device result (Roku Express 4K+, OS 16.1, `device-trace.txt`)

- Every item's observer runs once when the list creates it, whatever the observer writes to its own
  content, including a new value.
- An unchanged write from outside, by assignment or by `update()`, doesn't call the item's observer.
- A new value from outside calls it once. It also notifies the plain node's field holding the same
  ContentNode, first.

`engine-trace.txt` matches the device trace (apart from the device line). Before the fix, the engine
called every item's observer twice at creation, called it again on unchanged writes, and called it twice
for one external change (once through the holding field, once more when the list re-assigned the content).
A production app whose item observer writes an unchanged value back to its content was given its content
again every frame, rebuilding its children until memory ran out.

## Run

```sh
./pack.sh   # builds rowlist-content-rewrite-probe.zip (don't commit it)
curl --digest -u rokudev:<pw> -F mysubmit=Install -F archive=@rowlist-content-rewrite-probe.zip http://<roku-ip>/plugin_install
nc <roku-ip> 8085             # wait for PROBE|done (about 12 s after launch)
brs-cli --root .              # engine run
```

The regression test is "Gives a RowList item its itemContent again only when the content really changed"
in `test/cli/cli-scenegraph.test.js` (`rowlist-content-rewrite-app`).
