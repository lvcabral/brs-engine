sub init()
    m.top.functionName = "taskMain"
    m.loggingState = false
end sub

sub taskMain()
    if m.agent = invalid
        ' The SDK pattern: reach the owning component through the parent link, then call back into
        ' it. On a device this is the agent node; the call rendezvouses to the render thread.
        m.agent = m.top.getParent()
        ? "[PROBE] task parent=" + type(m.agent)
        if m.agent = invalid
            ? "[PROBE] FAIL task could not reach its parent"
            return
        end if
        m.sampleType = m.top.sampleType
        m.loggingState = m.agent.callFunc("agentCheckLogging")
        ? "[PROBE] task logging="; m.loggingState; " sampleType=" + m.sampleType
    end if

    samples = m.agent.callFunc("agentTakeSamples", m.sampleType)
    if samples = invalid
        ? "[PROBE] FAIL agentTakeSamples returned invalid"
        return
    end if
    ? "[PROBE] task samples=" + str(samples.Count())
    m.agent.callFunc("agentReport", m.sampleType)
end sub
