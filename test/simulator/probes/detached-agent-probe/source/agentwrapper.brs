' Module-scope wrapper around the agent node, mirroring how instrumentation SDKs ship a `source/`
' facade whose function names deliberately duplicate the component script's public API.
function ProbeAgent(account as String) as Object
    agent = CreateObject("roSGNode", "probe.agent.Agent")
    agent.callFunc("agentActivateLogging", true)
    agent.callFunc("agentInit", account)
    return agent
end function

' Same name as the component's `agentSetInterval`, on purpose: resolving the wrong one would be a
' silent behaviour change, so the probe exercises both scopes.
function agentSetInterval(agent as Object, seconds as Integer) as Void
    agent.callFunc("agentSetInterval", seconds)
end function
