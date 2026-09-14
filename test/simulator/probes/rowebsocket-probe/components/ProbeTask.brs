' Owns the roWebSocket and its message port on its own thread, off the render thread.
'
' This is the idiomatic place for roWebSocket/roUrlTransfer-style polling in a SceneGraph app: a
' plain roMessagePort created on the *render* thread is auto-registered to the Scene's roSGScreen
' (see src/extensions/scenegraph/index.ts's createMessagePort override), and GetMessage() calls
' against it interleave with the screen's own event servicing in ways that starved roWebSocket's
' events entirely during probe development — a Task's port has no such entanglement.
'
' `probeCommand` is observed with this port, not a function name: on a real device, a function-name
' observer runs on whichever thread *wrote* the field (the Scene, on the render thread), not on this
' Task's own thread — confirmed on hardware; see the README's "What this probe found" section. A
' port-based observer is delivered as a message on this thread's own `wait()` loop instead.

sub init()
    m.top.functionName = "runTask"
end sub

sub runTask()
    m.ws = CreateObject("roWebSocket")
    port = CreateObject("roMessagePort")
    m.ws.SetMessagePort(port)
    m.top.ObserveField("probeCommand", port)
    m.ws.SetData({ probe: "rowebsocket-probe" })
    ' Public echo server: reachable from both a real Roku (over the internet) and brs-engine, so
    ' both sides connect to the exact same backend when diffing captured logs.
    m.ws.SetUrl("wss://ws.postman-echo.com/raw")

    m.sentCount = 0
    m.receivedCount = 0
    m.logLines = []
    m.state = {
        status: "not connected"
        openInfo: ""
        socketId: "SocketId=" + m.ws.GetSocketId().ToStr()
        lastText: ""
        lastData: ""
        pingStatus: ""
        timerStatus: ""
        counts: "Sent=0 Received=0"
        log: ""
    }
    m.dirty = true

    while true
        msg = wait(50, port)
        if type(msg) = "roWebSocketEvent"
            handleEvent(msg)
        else if type(msg) = "roSGNodeEvent" and msg.GetField() = "probeCommand"
            doCommand(msg.GetData())
        end if
        if m.dirty
            m.top.uiState = FormatJson(m.state)
            m.dirty = false
        end if
    end while
end sub

sub doCommand(cmd as string)
    if cmd = "open"
        m.state.status = "opening..."
        opened = m.ws.Open(0)
        logMessage("Open() -> " + opened.ToStr())
    else if cmd = "sendText"
        result = m.ws.Send("hello from roWebSocket probe #" + m.sentCount.ToStr())
        m.sentCount++
        logMessage("Send(text) -> " + FormatJson(result))
    else if cmd = "sendData"
        ba = CreateObject("roByteArray")
        ba.FromHexString("01020304DEADBEEF")
        result = m.ws.Send(ba)
        m.sentCount++
        logMessage("Send(bytearray) -> " + FormatJson(result))
    else if cmd = "ping"
        result = m.ws.SendPing("ping-" + m.sentCount.ToStr())
        m.sentCount++
        logMessage("SendPing() -> " + FormatJson(result))
    else if cmd = "pingtest"
        m.state.pingStatus = "PingTest running..."
        m.dirty = true
        ok = m.ws.PingTest(3000, "pingtest")
        m.state.pingStatus = "PingTest result=" + ok.ToStr()
        logMessage("PingTest() -> " + ok.ToStr())
    else if cmd = "close"
        m.ws.Close(1000, "probe requested close")
        logMessage("Close() called")
    else if cmd = "reopen"
        m.state.status = "reopening..."
        opened = m.ws.Open(0)
        logMessage("Open() (reconnect) -> " + opened.ToStr())
    else if cmd = "settimer"
        m.ws.SetTimer("tick", 2000, false)
        logMessage("SetTimer('tick', 2000ms, repeating) armed")
    else if cmd = "clear"
        m.logLines = []
        m.state.log = ""
        m.dirty = true
    end if
end sub

sub handleEvent(evt as object)
    infoType = evt.GetType()
    info = evt.GetInfo()
    if infoType = 1 ' Opened
        m.state.status = "OPENED"
        m.state.openInfo = "Protocol=[" + info.Protocol + "] IP=[" + info.TargetIPAddr + "] Url=" + info.EffectiveUrl
        logMessage("Opened: " + FormatJson(info))
    else if infoType = 2 ' Closed
        m.state.status = "CLOSED code=" + info.Code.ToStr()
        logMessage("Closed: " + FormatJson(info))
    else if infoType = 3 ' Error
        m.state.status = "ERROR"
        logMessage("Error: " + FormatJson(info))
    else if infoType = 4 ' MsgSent
        logMessage("MsgSent: " + FormatJson(info))
    else if infoType = 5 ' TextReceived
        m.receivedCount++
        m.state.lastText = "Last Text: " + info.Text
        logMessage("TextReceived: " + info.Text)
    else if infoType = 6 ' DataReceived
        m.receivedCount++
        hex = bytesToHex(info.Data)
        m.state.lastData = "Last Data (" + info.Data.Count().ToStr() + " bytes): " + hex
        logMessage("DataReceived: " + hex)
    else if infoType = 7 ' PingReceived
        logMessage("PingReceived: text=[" + info.Text + "]")
    else if infoType = 8 ' PongReceived
        m.state.pingStatus = "Last Pong: [" + info.Text + "]"
        logMessage("PongReceived: text=[" + info.Text + "]")
    else if infoType = 9 ' Timer
        m.state.timerStatus = "Timer[" + info.TimerId + "] occur=" + info.Occur.ToStr()
    end if
    m.state.counts = "Sent=" + m.sentCount.ToStr() + " Received=" + m.receivedCount.ToStr()
    m.dirty = true
end sub

function bytesToHex(bytes as object) as string
    hex = ""
    for i = 0 to bytes.Count() - 1
        h = StrI(bytes[i], 16)
        h = Right("0" + h.Trim(), 2)
        hex = hex + h + " "
    end for
    return hex
end function

sub logMessage(line as string)
    m.logLines.Push(line)
    while m.logLines.Count() > 10
        m.logLines.Shift()
    end while
    text = ""
    for each entry in m.logLines
        text = text + entry + Chr(10)
    end for
    m.state.log = text
    print "### PROBE "; line
    m.dirty = true
end sub
