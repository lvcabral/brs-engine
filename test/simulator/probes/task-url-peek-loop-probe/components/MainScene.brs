' Kicks off the download on a background Task (the shape a real app uses to keep init-time
' network calls off the render thread) and prints whatever the task reports back.
sub init()
    m.task = CreateObject("roSGNode", "ConfigDownloadTask")
    m.task.observeField("report", "onReport")
    m.task.control = "RUN"
end sub

sub onReport()
    for each line in m.task.report.Split(chr(10))
        if line <> "" then ? "[PEEKLOOP] " + line
    end for
    m.top.findNode("Results").text = m.task.report
    ' Signals source/main.brs (observing this field) that it can close the screen and exit.
    m.top.report = m.task.report
end sub
