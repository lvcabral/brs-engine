sub init()
    m.top.functionName = "runTask"
end sub

sub runTask()
    m.port = CreateObject("roMessagePort")
    m.top.observeField("phase", m.port)

    m.top.report1 = joinLines(readPhase1())
    m.top.ready = 1

    ' Wait for the render thread to mutate the global state, then re-read everything.
    if waitForPhase(2)
        m.top.report2 = joinLines(readPhase2())
    else
        m.top.report2 = "R20..R23 = SKIPPED (phase 2 handshake timed out)"
    end if
    m.top.ready = 2
end sub

function waitForPhase(target as Integer) as Boolean
    if m.top.phase >= target then return true
    while true
        msg = wait(5000, m.port)
        if msg = invalid then return false
        if type(msg) = "roSGNodeEvent"
            if msg.getField() = "phase" and msg.getData() >= target then return true
        end if
    end while
end function

' ---- Phase 1: read global state as the render thread set it up ------------------------------
function readPhase1() as Object
    lines = []

    ' Scalars on the global node.
    emit(lines, "R01 m.global.appName            ", m.global.appName)
    emit(lines, "R02 m.global.launchCount        ", m.global.launchCount)

    ' A node-valued global field, and fields added to it at runtime.
    cfg = m.global.configNode
    emit(lines, "R03 m.global.configNode         ", cfg)
    if cfg <> invalid
        emit(lines, "R04   .apiKey (runtime field)   ", cfg.apiKey)
        emit(lines, "R05   .region (runtime field)   ", cfg.region)
    end if

    ' Methods on a render-owned node: child access and a subtree search.
    mgr = m.global.manager
    if mgr <> invalid
        emit(lines, "R06 m.global.manager.getChildCount()", mgr.getChildCount())
        child = mgr.getChild(0)
        if child <> invalid then emit(lines, "R07   .getChild(0).title        ", child.title)
        found = mgr.findNode("Item7")
        emit(lines, "R08   .findNode(Item7)          ", found)
        if found <> invalid then emit(lines, "R09     found.title             ", found.title)
    end if

    ' Container-valued fields: are they readable, and by value?
    settings = m.global.settings
    emit(lines, "R10 m.global.settings           ", settings)
    if settings <> invalid then emit(lines, "R11   .theme                    ", settings.theme)
    tags = m.global.tags
    emit(lines, "R12 m.global.tags               ", tags)
    if tags <> invalid and tags.Count() > 0 then emit(lines, "R13   [0]                       ", tags[0])

    ' Node identity across two separate reads of the same global field.
    a = m.global.configNode
    b = m.global.configNode
    if a <> invalid and b <> invalid
        emit(lines, "R14 identity a.isSameNode(b)    ", a.isSameNode(b))
    end if

    ' The task's own node needs no rendezvous.
    emit(lines, "R15 m.top.taskLocal (own field) ", m.top.taskLocal)

    ' callFunc on a render-owned custom component: whose `m` runs?
    probe = m.global.probe
    if probe <> invalid
        r = probe.callFunc("report", invalid)
        if r <> invalid
            emit(lines, "R16 probe.callFunc createdIn    ", r.createdIn)
            emit(lines, "R17   callCount (render-side m) ", r.callCount)
        end if
    end if

    ' Writes from the task back into render-owned state.
    if cfg <> invalid
        cfg.region = "written-by-task"
        emit(lines, "R18 write cfg.region, read back ", m.global.configNode.region)
    end if
    m.global.launchCount = 99
    emit(lines, "R19 write global scalar, read back", m.global.launchCount)

    return lines
end function

' ---- Phase 2: after the render thread mutated the same state ---------------------------------
function readPhase2() as Object
    lines = []
    cfg = m.global.configNode

    ' The decisive staleness checks: the render thread changed these AFTER launch.
    if cfg <> invalid
        emit(lines, "R20 cfg.apiKey after render edit", cfg.apiKey)
        emit(lines, "R21 cfg.sessionId (added later) ", cfg.sessionId)
    end if
    mgr = m.global.manager
    if mgr <> invalid then emit(lines, "R22 manager count after append  ", mgr.getChildCount())
    emit(lines, "R23 m.global.appName after edit ", m.global.appName)
    return lines
end function
