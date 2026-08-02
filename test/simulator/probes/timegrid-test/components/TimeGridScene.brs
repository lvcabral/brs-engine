sub init()
    m.top.setFocus(true)
    m.top.backgroundColor = "0x101418FF"

    m.grid = m.top.findNode("epg")
    m.grid.observeField("channelFocused", "onChannelFocused")
    m.grid.observeField("programFocused", "onProgramFocused")
    m.grid.observeField("programSelected", "onProgramSelected")

    buildGuide()
    m.grid.setFocus(true)
end sub

' Builds a self-contained channels -> programs ContentNode tree, with program start times
' anchored to the current time so the "now" bar and past-time screen are meaningful.
sub buildGuide()
    now = CreateObject("roDateTime")
    startSec = now.AsSeconds()
    ' TimeGrid works best when contentStartTime sits on a 30-minute mark. Start the guide one
    ' hour before "now" so there is some past programming to dim.
    startSec = startSec - (startSec mod 1800) - 3600
    m.grid.contentStartTime = startSec

    channelNames = ["NEWS 24", "SPORTS HD", "MOVIE MAX", "KIDS TV", "MUSIC ONE", "NATURE", "COMEDY", "DISCOVER"]
    titles = ["Morning Report", "Live Match", "Feature Film", "Cartoon Hour", "Top Hits", "Wild Planet", "Stand-Up", "How It Works", "Headlines", "Highlights", "Late Show", "Story Time"]

    content = CreateObject("roSGNode", "ContentNode")
    for c = 0 to channelNames.Count() - 1
        channel = content.CreateChild("ContentNode")
        channel.title = channelNames[c]
        playStart = startSec
        for p = 0 to 5
            program = channel.CreateChild("ContentNode")
            program.title = titles[(c + p) mod titles.Count()]
            program.playStart = playStart
            ' Vary durations (30/60/90 min) so cells have visibly different widths.
            dur = 1800
            if (c + p) mod 3 = 0 then dur = 3600
            if (c + p) mod 5 = 0 then dur = 5400
            program.playDuration = dur
            playStart = playStart + dur
        end for
    end for

    m.grid.content = content
end sub

sub onChannelFocused()
    print "[TimeGrid] channel focused: "; m.grid.channelFocused
end sub

sub onProgramFocused()
    details = m.grid.programFocusedDetails
    print "[TimeGrid] program focused: ch="; details.focusChannelIndex; " prog="; details.focusIndex
end sub

sub onProgramSelected()
    print "[TimeGrid] SELECTED program "; m.grid.programSelected; " on channel "; m.grid.channelSelected
end sub
