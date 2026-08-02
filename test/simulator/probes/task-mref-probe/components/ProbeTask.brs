' init() runs on the RENDER thread, when MainScene creates this node. Everything it puts in
' `m` is script-scope state that has to survive the launch of the task thread.
'
' The engine serializes `m` entry by entry in insertion order and dedupes nodes it has already
' emitted, so a node reachable by two routes is written out fully the first time and as a bare
' back-reference the second. Which route wins depends purely on that order — `top` and `global`
' are inserted at node creation, so they always go first. This probe pins down what a device
' actually hands the task thread for each of those shapes.
sub init()
    m.top.functionName = "runTask"

    ' Unrepeatable per-run value. The task compares its own copy against the render thread's
    ' (mirrored onto m.top below) to tell "m was copied across" from "init() re-ran here".
    m.initStamp = "stamp-" + str(rnd(1000000)).Trim()
    m.top.initStamp = m.initStamp

    ' ---- Case A: an AA in `m` holding the GLOBAL node -------------------------------------
    ' The shape a transpiled class instance takes when its constructor caches
    ' `GetGlobalAA().global` in a field. `m.global` is serialized first, so this copy of it is
    ' emitted as a back-reference.
    m.caseA = { node: GetGlobalAA().global }

    ' ---- Case B: an AA in `m` holding a node-valued FIELD of m.top ------------------------
    ' The node is serialized as part of `m.top`'s subtree, so this copy is a back-reference to
    ' a node that lives *inside* another entry rather than being one itself.
    payload = CreateObject("roSGNode", "ContentNode")
    payload.id = "PayloadNode"
    payload.title = "payload-from-init"
    m.top.payloadNode = payload
    m.caseB = { node: payload }

    ' ---- Case C: an AA in `m` holding a CHILD of m.top ------------------------------------
    child = CreateObject("roSGNode", "ContentNode")
    child.id = "ChildNode"
    child.title = "child-from-init"
    m.top.appendChild(child)
    m.caseC = { node: child }

    ' ---- Case D: the SAME standalone node held by two different `m` entries ----------------
    ' Reachable only through `m` — not through `top` or `global`. The first entry carries the
    ' node in full, the second is a back-reference to it.
    shared = CreateObject("roSGNode", "ContentNode")
    shared.id = "SharedNode"
    shared.title = "shared-from-init"
    m.caseD1 = { node: shared }
    m.caseD2 = { node: shared }

    ' ---- Case E: a node held DIRECTLY at the top level of `m` ------------------------------
    ' Same node again, this time not wrapped in an AA.
    m.caseE = shared
end sub

sub runTask()
    lines = []

    lines.push("---------- did `m` cross the thread boundary? ----------")
    lines.push("m.initStamp        = " + describe(m.initStamp))
    lines.push("m.top.initStamp    = " + describe(m.top.initStamp) + "   (render thread's value)")
    if m.initStamp = invalid or m.initStamp = ""
        lines.push("VERDICT: `m` did NOT cross — the task thread got a fresh script scope")
    else if m.initStamp = m.top.initStamp
        lines.push("VERDICT: `m` was COPIED across — same stamp, init() did not re-run here")
    else
        lines.push("VERDICT: init() RE-RAN on the task thread — stamps differ")
    end if
    lines.push("")

    lines.push("---------- A: AA in m holding the GLOBAL node ----------")
    a = mNode("caseA")
    lines.push("m.caseA.node       = " + describe(a))
    lines.push("  vs m.global      : " + sameNode(a, m.global))
    lines.push("")

    lines.push("---------- B: AA in m holding a node-valued FIELD of m.top ----------")
    b = mNode("caseB")
    lines.push("m.caseB.node       = " + describe(b))
    lines.push("m.caseB.node.title = " + fieldOf(b, "title") + "   (expect 'payload-from-init')")
    lines.push("m.top.payloadNode  = " + describe(m.top.payloadNode))
    lines.push("  same instance?   : " + sameNode(b, m.top.payloadNode))
    lines.push("")

    lines.push("---------- C: AA in m holding a CHILD of m.top ----------")
    c = mNode("caseC")
    lines.push("m.caseC.node       = " + describe(c))
    lines.push("m.caseC.node.title = " + fieldOf(c, "title") + "   (expect 'child-from-init')")
    kid = invalid
    if m.top.getChildCount() > 0 then kid = m.top.getChild(0)
    lines.push("m.top child 0      = " + describe(kid) + "   (child count " + str(m.top.getChildCount()).Trim() + ")")
    lines.push("  same instance?   : " + sameNode(c, kid))
    lines.push("")

    lines.push("---------- D: same standalone node under two m entries ----------")
    d1 = mNode("caseD1")
    d2 = mNode("caseD2")
    lines.push("m.caseD1.node      = " + describe(d1))
    lines.push("m.caseD2.node      = " + describe(d2))
    lines.push("m.caseD2 title     = " + fieldOf(d2, "title") + "   (expect 'shared-from-init')")
    lines.push("  same instance?   : " + sameNode(d1, d2))
    lines.push("")

    lines.push("---------- E: node held directly at the top level of m ----------")
    lines.push("m.caseE            = " + describe(m.caseE))
    lines.push("m.caseE.title      = " + fieldOf(m.caseE, "title") + "   (expect 'shared-from-init')")
    lines.push("  vs m.caseD1.node : " + sameNode(m.caseE, d1))
    lines.push("")

    lines.push("---------- liveness: does a write through one route show on the other? ----------")
    if b <> invalid and type(b) = "roSGNode"
        b.title = "changed-in-task"
        lines.push("wrote m.caseB.node.title = 'changed-in-task'")
        lines.push("m.top.payloadNode.title = " + fieldOf(m.top.payloadNode, "title"))
        lines.push("  'changed-in-task'  => both routes reach ONE node")
        lines.push("  'payload-from-init'=> the task holds two separate copies")
    else
        lines.push("skipped — m.caseB.node is not a node")
    end if
    if d1 <> invalid and type(d1) = "roSGNode"
        d1.title = "changed-via-D1"
        lines.push("wrote m.caseD1.node.title = 'changed-via-D1'")
        lines.push("m.caseD2.node.title = " + fieldOf(d2, "title"))
        lines.push("m.caseE.title       = " + fieldOf(m.caseE, "title"))
    end if

    m.top.report = joinLines(lines)
end sub

' Reads m.<key>.node without crashing when the entry or its node came across empty.
function mNode(key as String) as Dynamic
    entry = m[key]
    if entry = invalid then return invalid
    if type(entry) <> "roAssociativeArray" then return invalid
    return entry.node
end function
