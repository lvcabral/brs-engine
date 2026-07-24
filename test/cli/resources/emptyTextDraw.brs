sub main()
    ' Regression: node-canvas v4 aborts the process (SIGTRAP) when measureText/fillText
    ' receive an empty string. The engine must guard these calls before hitting canvas.
    screen = CreateObject("roScreen", true, 854, 480)
    screen.Clear(&h000000FF)
    reg = CreateObject("roFontRegistry")
    font = reg.GetDefaultFont(40, false, false)
    screen.DrawText("", 100, 100, &hFFFFFFFF, font)
    print "empty width: "; font.GetOneLineWidth("", 854)
    print "empty ellipsized: "; font.GetOneLineWidth("", 10)
    print "normal width > 0: "; font.GetOneLineWidth("abc", 854) > 0
    ' node-canvas v4 collapses whitespace-only strings to width 0; the engine
    ' must recover the real advance (word-wrap layouts measure spaces alone)
    print "space width > 0: "; font.GetOneLineWidth(" ", 854) > 0
    print "spaced wider: "; font.GetOneLineWidth("a b", 854) > font.GetOneLineWidth("ab", 854)
    screen.SwapBuffers()
    end
end sub
