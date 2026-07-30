sub main()
    ' Text measurement is memoized per font (see RoFont.measureCache) because a LayoutGroup lays
    ' out by re-measuring its children on every pass. The cache key must keep every input apart:
    ' text, maxWidth and the font itself.
    screen = CreateObject("roScreen", true, 854, 480)
    reg = CreateObject("roFontRegistry")
    font = reg.GetDefaultFont(40, false, false)
    bigFont = reg.GetDefaultFont(80, false, false)
    text = "measure me twice"

    full = font.GetOneLineWidth(text, 854)
    print "stable: "; font.GetOneLineWidth(text, 854) = full
    ' A tighter maxWidth clamps the reported width; the wide measurement must not answer for it.
    print "clamped: "; font.GetOneLineWidth(text, 20) = 20
    ' ...and asking again with the original constraint still reports the full width.
    print "unclamped: "; font.GetOneLineWidth(text, 854) = full
    ' Each font instance has its own cache, so a larger size is not served the smaller result.
    print "font isolated: "; bigFont.GetOneLineWidth(text, 2000) > font.GetOneLineWidth(text, 2000)
    ' Different strings under identical constraints stay distinct.
    print "text isolated: "; font.GetOneLineWidth("iii", 854) <> font.GetOneLineWidth("WWW", 854)
    screen.SwapBuffers()
    end
end sub
