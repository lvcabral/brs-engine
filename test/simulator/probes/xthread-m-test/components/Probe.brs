sub init()
    m.createdIn = "unset"
    m.token = "unset"
    m.callCount = 0
    m.stashed = invalid
end sub

' Records where this node was created. Called by the creator on its own thread.
sub setOrigin(args as Object)
    m.createdIn = args.origin
    m.token = args.token
end sub

' Stores a node reference in the script scope — the pattern that makes `m` expensive to copy.
sub stash(node as Object)
    m.stashed = node
end sub

' Reports what `m` holds. Every call bumps m.callCount, which reveals which thread's copy of
' `m` a cross-thread callFunc actually ran against.
function report(unused as Dynamic) as Object
    m.callCount = m.callCount + 1

    stashTitle = "<none>"
    stashKind = "invalid"
    if m.stashed <> invalid
        stashKind = type(m.stashed)
        if stashKind = "roSGNode" then stashTitle = fmt(m.stashed.title)
    end if

    return {
        createdIn: m.createdIn,
        token: m.token,
        callCount: m.callCount,
        stashKind: stashKind,
        stashTitle: stashTitle
    }
end function
