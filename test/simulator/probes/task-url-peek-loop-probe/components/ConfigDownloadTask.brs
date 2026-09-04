' Reproduces a reported bug: an app that downloads its config from the internet during
' initialization saw the SAME roUrlEvent delivered over and over, in what looked like an
' infinite loop, even though the download itself completed fine.
'
' Root cause (see src/core/brsTypes/components/RoMessagePort.ts, peekMessage()): AsyncGetToString/
' AsyncGetToFile/AsyncHead/AsyncPostFromString/AsyncPostFromFile/AsyncPostFromFileToFile don't run
' the request immediately - they queue a one-shot job closure on the port's callbackQueue, which
' performs the real (synchronous) HTTP request the first time something drains the port.
' GetMessage()/WaitMessage() correctly `shift()` the closure off callbackQueue before invoking it,
' but PeekMessage() used to only read callbackQueue[0] and invoke it WITHOUT removing it. So the
' extremely common app idiom below - peek, then only GetMessage() once something is there - left a
' "zombie" callback in the queue: every later PeekMessage() call (once messageQueue drained again)
' re-invoked the SAME closure, firing a brand-new real HTTP request and delivering a brand-new
' roUrlEvent, forever. Because the config content is stable, every one of those events looks like
' "the same event" being redelivered - which matches the report.
'
' Run this probe against a build with the bug: VERDICT below reports BUG REPRODUCED, and the
' download fires multiple real HTTP requests for a single AsyncGetToString() call. Against the
' fixed engine it reports OK: exactly one event for one call.
sub init()
    m.top.functionName = "downloadConfig"
end sub

sub downloadConfig()
    ' A small, stable file this project already uses elsewhere as a network test fixture -
    ' see test/e2e/resources/components/roURLTransfer.brs.
    configUrl = "https://raw.githubusercontent.com/lvcabral/brs-engine/refs/heads/master/packages/browser/package.json"

    port = CreateObject("roMessagePort")
    xfer = CreateObject("roUrlTransfer")
    xfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
    xfer.InitClientCertificates()
    xfer.RetainBodyOnError(true)
    xfer.SetMessagePort(port)
    xfer.SetUrl(configUrl)

    lines = []
    lines.push("========== Task URL PeekMessage Loop Probe ==========")
    lines.push("Simulating an init-time config download driven by the common")
    lines.push("PeekMessage() + GetMessage() poll idiom instead of wait(timeout, port):")
    lines.push("")

    started = xfer.AsyncGetToString()
    lines.push("AsyncGetToString() called ONCE. started=" + started.toStr())
    lines.push("")

    ' Caps keep this safe to run even against a still-broken engine: it won't hang forever or
    ' hammer the network - it just reports the bug instead. Once the first event lands, only
    ' keep polling for a short tail (the zombie-callback bug re-fires on the very next poll that
    ' finds messageQueue empty, so a handful of extra iterations is enough to catch it).
    maxIterations = 60
    maxEvents = 5
    tailAfterFirstEvent = 15
    iteration = 0
    eventCount = 0
    firstEventIteration = -1

    while iteration < maxIterations and eventCount < maxEvents
        iteration++
        peeked = port.PeekMessage()
        if peeked <> invalid
            msg = port.GetMessage()
            if type(msg) = "roUrlEvent"
                eventCount++
                if firstEventIteration = -1 then firstEventIteration = iteration
                status = str(msg.GetResponseCode()).Trim()
                lines.push("[" + str(eventCount).Trim() + "] roUrlEvent on iteration " + str(iteration).Trim() + " - status=" + status)
            end if
        else
            sleep(10)
        end if
        if firstEventIteration <> -1 and (iteration - firstEventIteration) >= tailAfterFirstEvent then exit while
    end while

    lines.push("")
    lines.push("Poll iterations used: " + str(iteration).Trim() + " / " + str(maxIterations).Trim())
    lines.push("roUrlEvent objects delivered for that single AsyncGetToString() call: " + str(eventCount).Trim())
    lines.push("")

    if eventCount = 0
        lines.push("VERDICT: INCONCLUSIVE - no roUrlEvent received within the iteration cap (check network access).")
    else if eventCount = 1
        lines.push("VERDICT: OK - exactly one roUrlEvent delivered for one AsyncGetToString() call.")
    else
        lines.push("VERDICT: BUG REPRODUCED - " + str(eventCount).Trim() + " roUrlEvent objects delivered (that many real HTTP requests fired) for a single AsyncGetToString() call.")
    end if

    ' A clean fix leaves nothing behind: this must come back invalid, not another event.
    extra = port.PeekMessage()
    if extra = invalid
        lines.push("Post-loop PeekMessage(): invalid (no zombie callback left on the port)")
    else
        lines.push("Post-loop PeekMessage(): " + type(extra) + " (UNEXPECTED - a stray event/callback is still queued)")
    end if

    lines.push("========== end ==========")

    out = ""
    for each line in lines
        out = out + line + chr(10)
    end for
    m.top.report = out
end sub
