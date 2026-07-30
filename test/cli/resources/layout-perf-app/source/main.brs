' Layout-pass performance probe (docs/scenegraph-layout-passes.md): appends N custom
' components into a LayoutGroup; each component's `value` observer measures itself with
' boundingRect(), so every append triggers a full-tree layout refresh. On an engine with
' incremental (pruned) layout the per-component cost is flat, like a device; without
' pruning it rises linearly and the build is O(n²) overall.
sub Main()
    print "=== Layout Perf Probe ==="
    tileCount = 70

    layout = CreateObject("roSGNode", "LayoutGroup")
    layout.layoutDirection = "vert"
    layout.itemSpacings = [8]

    clock = CreateObject("roTimespan")
    total = CreateObject("roTimespan")
    timings = []
    total.mark()
    for i = 1 to tileCount
        clock.mark()
        tile = CreateObject("roSGNode", "PerfTile")
        layout.appendChild(tile)
        ' Set `value` after attach so the observer's boundingRect() refresh walks the whole
        ' (growing) tree from the root — the O(tree)-per-component pattern the probe exists
        ' to measure. Set before attach it would only measure the orphan tile.
        tile.value = "tile " + i.toStr()
        timings.push(clock.totalMilliseconds())
    end for
    totalMs = total.totalMilliseconds()

    rect = layout.boundingRect()
    print "tiles = "; tileCount
    print "layout height = "; rect.height
    ' Quartile samples instead of first/last: tile 1 is inflated by font-load/JIT warmup.
    ' Flat q1..q4 = device shape (incremental layout); rising = quadratic full refreshes.
    q = int(tileCount / 4)
    print "q1 tile ms = "; timings[q - 1]
    print "q2 tile ms = "; timings[2 * q - 1]
    print "q3 tile ms = "; timings[3 * q - 1]
    print "q4 tile ms = "; timings[tileCount - 1]
    print "total ms = "; totalMs
    print "=== Layout Perf Probe Complete ==="
end sub
