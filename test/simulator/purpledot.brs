Library "v30/bslDefender.brs"

sub main()
    m.code = bslUniversalControlEventCodes()
    m.port = CreateObject("roMessagePort")
    m.screen = CreateObject("roScreen", true, 854, 480)
    m.screen.SetAlphaEnable(true)
    m.screen.SetMessagePort(m.port)
    m.clock = CreateObject("roTimespan")
    purple = &h6F1AB1FF
    white = &hFFFFFFFF
    size = 15
    m.ball = CreateObject("roBitmap", {width: size, height: size, alphaenable: false})
    m.ball.clear(purple)
    m.position = {x: 0, y: 0}
    m.clock.Mark()
    while true
        event = m.port.GetMessage()
        if type(event) = "roUniversalControlEvent"
            id = event.GetInt()
            if id = m.code.BUTTON_BACK_PRESSED
                exit while
            else if id = m.code.BUTTON_UP_PRESSED
                move = "up"
            else if id = m.code.BUTTON_DOWN_PRESSED
                move = "down"
            else if id = m.code.BUTTON_LEFT_PRESSED
                move = "left"
            else if id = m.code.BUTTON_RIGHT_PRESSED
                move = "right"
            else
                move = ""
            end if
        else
            ticks = m.clock.TotalMilliseconds()
            if ticks > 45
                m.clock.Mark()
                if move = "up"
                    m.position.y -= size
                    if m.position.y < 0 then m.position.y = 0
                else if move = "down"
                    m.position.y += size
                    if m.position.y > 480 - size then m.position.y = 480 - size
                else if move = "left"
                    m.position.x -= size
                    if m.position.x < 0 then m.position.x = 0
                else if move = "right"
                    m.position.x += size
                    if m.position.x > 854 - size then m.position.x = 854 - size
                end if
                if move <> ""
                    m.screen.drawobject(m.position.x, m.position.y, m.ball)
                    m.screen.swapBuffers()
                end if
            end if
        end if
    end while
end sub
