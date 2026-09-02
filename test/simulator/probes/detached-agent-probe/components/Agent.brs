sub init()
    m.loggingState = false
    m.agentVersion = m.top.version
    ? "[PROBE] Agent.init version=" + m.agentVersion
end sub

function agentActivateLogging(state as Boolean) as Void
    m.loggingState = state
end function

' Caches findNode() results in the script scope — the entries every later callFunc depends on.
function agentInit(account as String) as Void
    m.account = account
    m.primaryInterval = 60
    m.samples = []

    m.primaryTask = m.top.findNode("PrimaryTask")
    ? "[PROBE] agentInit primaryTask=" + type(m.primaryTask)
    m.primaryTask.setField("sampleType", "primary")
    m.secondaryTask = m.top.findNode("SecondaryTask")
    ? "[PROBE] agentInit secondaryTask=" + type(m.secondaryTask)
    m.secondaryTask.setField("sampleType", "secondary")

    m.primaryTimer = m.top.findNode("primaryTimer")
    ? "[PROBE] agentInit primaryTimer=" + type(m.primaryTimer)
    m.primaryTimer.observeField("fire", "onPrimaryTimer")
    m.primaryTimer.duration = 1
    m.primaryTimer.control = "start"

    m.secondaryTimer = m.top.findNode("secondaryTimer")
    ? "[PROBE] agentInit secondaryTimer=" + type(m.secondaryTimer)
    m.secondaryTimer.observeField("fire", "onSecondaryTimer")
    m.secondaryTimer.duration = 1
    m.secondaryTimer.control = "start"

    m.tertiaryTask = m.top.findNode("TertiaryTask")
    m.tertiaryTask.setField("sampleType", "tertiary")
    m.tertiaryTimer = m.top.findNode("tertiaryTimer")
    ? "[PROBE] agentInit tertiaryTimer=" + type(m.tertiaryTimer)
    m.tertiaryTimer.observeField("fire", "onTertiaryTimer")
    m.tertiaryTimer.duration = 1
    m.tertiaryTimer.control = "start"

    ? "[PROBE] agentInit done account=" + m.account
end function

function agentSetInterval(seconds as Integer) as Void
    agentSetIntervalPrimary(seconds)
end function

function agentSetIntervalPrimary(seconds as Integer) as Void
    m.primaryInterval = seconds
    ' The reported crash site: m.primaryTimer was cached by agentInit on this same instance.
    m.primaryTimer.duration = seconds
    ? "[PROBE] agentSetIntervalPrimary ok duration=" + str(m.primaryTimer.duration)
end function

sub onPrimaryTimer()
    if LCase(m.primaryTask.state) = "run" then return
    m.primaryTask.control = "RUN"
end sub

sub onSecondaryTimer()
    if LCase(m.secondaryTask.state) = "run" then return
    m.secondaryTask.control = "RUN"
end sub

sub onTertiaryTimer()
    if LCase(m.tertiaryTask.state) = "run" then return
    m.tertiaryTask.control = "RUN"
end sub

' Called back from a Task thread by rendezvous.
function agentCheckLogging() as Boolean
    return m.loggingState
end function

function agentTakeSamples(sampleType as String) as Object
    m.samples.push(sampleType)
    return m.samples
end function

function agentReport(sampleType as String) as Void
    ? "[PROBE] agentReport " + sampleType + " account=" + m.account + " duration=" + str(m.primaryTimer.duration)
end function
