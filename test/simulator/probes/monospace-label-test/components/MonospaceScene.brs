sub init()
    m.top.setFocus(true)
    m.top.backgroundColor = "0x101418FF"

    ' Random-ish counter that visits values of different digit widths, so the proportional
    ' Label visibly jitters while the MonospaceLabel stays put.
    m.plCounter = m.top.findNode("plCounter")
    m.msCounter = m.top.findNode("msCounter")
    m.count = 11111110

    m.ticker = m.top.findNode("ticker")
    m.ticker.observeField("fire", "onTick")
    m.ticker.control = "start"
end sub

sub onTick()
    ' Step by an uneven amount so the number of "1" (narrow) vs "8" (wide) digits keeps
    ' changing - that is exactly what shifts a proportional, right-aligned Label around.
    m.count = m.count + 1234567
    if m.count > 99999999 then m.count = 10000001

    text = m.count.ToStr()
    m.plCounter.text = text
    m.msCounter.text = text
end sub
