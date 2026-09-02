' Drives the "detached agent" pattern used by third-party instrumentation SDKs:
' a custom component created from module scope with CreateObject, never appended to the Scene,
' configured entirely through callFunc, and holding Timer + Task children declared in its XML.
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    ' Step 1 — create + initialize the agent. agentInit caches findNode() results in its `m`.
    m.agent = ProbeAgent("probe-account")

    ' Step 2 — a later main-thread callFunc that reads those cached `m` entries through one more
    ' in-component call (the two-level nesting the real SDK uses).
    ? "[PROBE] --- step 2: main-thread callFunc reading init-cached m ---"
    agentSetInterval(m.agent, 90)

    ' Step 3 — let the agent's own Timers fire, which run its Task children; each task calls back
    ' into the agent by rendezvous (m.top.getParent() then callFunc).
    ? "[PROBE] --- step 3: waiting for task rendezvous ---"
    pump(port, 16)

    ' Step 4 — the same main-thread callFunc again, now that three Task threads have rendezvoused
    ' onto the detached agent repeatedly. If any of those rebuilt a duplicate of the agent for its
    ' address, this is where the init-cached `m` entries come back invalid.
    ? "[PROBE] --- step 4: main-thread callFunc after task rendezvous ---"
    agentSetInterval(m.agent, 45)
    m.agent.callFunc("agentSetIntervalPrimary", 30)

    pump(port, 8)

    ' Step 5 — the agent handed around *inside* an associative array field, the way apps stash
    ' service handles on m.global. Reading an AA/array field back returns a copy of the container;
    ' the node references inside it must stay the same nodes.
    ? "[PROBE] --- step 5: callFunc on an agent read back out of an AA field ---"
    scene.setField("services", { agent: m.agent })
    services = scene.services
    ? "[PROBE] services.agent type="; type(services.agent)
    ? "[PROBE] services.agent isSameNode="; services.agent.isSameNode(m.agent)
    agentSetInterval(services.agent, 15)

    ' Step 6 — same thing through an array field.
    ? "[PROBE] --- step 6: callFunc on an agent read back out of an array field ---"
    scene.setField("agents", [m.agent])
    list = scene.agents
    ? "[PROBE] agents[0] isSameNode="; list[0].isSameNode(m.agent)
    agentSetInterval(list[0], 20)

    ? "[PROBE] --- done ---"
end sub

sub pump(port as Object, ticks as Integer)
    i = 0
    while i < ticks
        msg = wait(500, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then return
        end if
        i = i + 1
    end while
end sub
