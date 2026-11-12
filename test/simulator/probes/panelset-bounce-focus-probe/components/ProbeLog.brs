' Shared trace writer: PROBE|<case@run>|<seq>|<kind>|<body>. The sequence number keeps genuinely repeated
' lines apart when the host dedupes the console's replays.
sub plog(kind as string, body as string)
    s = m.global.probeSeq + 1
    m.global.probeSeq = s
    print "PROBE|" + m.global.probeTag + "|" + Right("000" + s.toStr(), 4) + "|" + kind + "|" + body
end sub
