' Render-thread side of the roWebSocket probe: owns the UI labels and forwards remote key presses
' to ProbeTask, which owns the actual roWebSocket connection on its own thread — see the comment at
' the top of ProbeTask.brs for why the socket lives there instead of here, and for a real device
' behavior this probe found along the way.
'
' `uiState` is a JSON string, not an `assocarray` field, parsed back with `ParseJson()`, simply to
' bundle every displayed value into one field/one observer instead of one of each per label.
'
' Remote key -> action (BrightScript onKeyEvent() strings, per the "Handling Key Presses" reference
' — these differ from the /keypress/<name> names the ECP HTTP API and brs-cli's own keyboard mapper
' use internally, which the engine translates to these before dispatch):
'   OK          Open()
'   up          Send() a text message
'   down        Send() a binary (roByteArray) message
'   left        SendPing()
'   right       PingTest(3000)
'   rewind      Close()
'   fastforward Open() again (reconnect on the same object)
'   replay      SetTimer("tick", 2000, false) — arms/re-arms a repeating timer
'   options     Clear the on-screen log
'
' Timer/PingReceived/error events are entirely passive: whatever the socket produces on its own
' shows up in the log without a matching keypress.

sub init()
    m.top.backgroundColor = "0x101826FF"

    m.status = m.top.findNode("status")
    m.openInfo = m.top.findNode("openInfo")
    m.socketIdLabel = m.top.findNode("socketId")
    m.lastText = m.top.findNode("lastText")
    m.lastData = m.top.findNode("lastData")
    m.pingStatus = m.top.findNode("pingStatus")
    m.timerStatus = m.top.findNode("timerStatus")
    m.counts = m.top.findNode("counts")
    m.logLabel = m.top.findNode("log")

    m.task = CreateObject("roSGNode", "ProbeTask")
    m.task.ObserveField("uiState", "onUiState")
    m.task.control = "RUN"

    m.top.setFocus(true)
end sub

sub onUiState()
    state = ParseJson(m.task.uiState)
    if type(state) <> "roAssociativeArray" then return
    m.status.text = "Status: " + state.status
    m.openInfo.text = state.openInfo
    m.socketIdLabel.text = state.socketId
    m.lastText.text = state.lastText
    m.lastData.text = state.lastData
    m.pingStatus.text = state.pingStatus
    m.timerStatus.text = state.timerStatus
    m.counts.text = state.counts
    m.logLabel.text = state.log
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    handled = true
    if key = "OK"
        m.task.probeCommand = "open"
    else if key = "up"
        m.task.probeCommand = "sendText"
    else if key = "down"
        m.task.probeCommand = "sendData"
    else if key = "left"
        m.task.probeCommand = "ping"
    else if key = "right"
        m.task.probeCommand = "pingtest"
    else if key = "rewind"
        m.task.probeCommand = "close"
    else if key = "fastforward"
        m.task.probeCommand = "reopen"
    else if key = "replay"
        m.task.probeCommand = "settimer"
    else if key = "options"
        m.task.probeCommand = "clear"
    else
        handled = false
    end if
    return handled
end function
