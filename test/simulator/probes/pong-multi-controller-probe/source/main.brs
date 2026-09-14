' Pong Multi-Controller Probe
'
' Exercises the `multi_controllers=1` manifest flag (issue #1214):
'   - Player 1 (left paddle) is driven by the Keyboard, always remote id "WD:0".
'   - Player 2 (right paddle) is driven by the first Game Pad seen, remote id "BT:<n>" -
'     bound dynamically from GetRemoteID() the first time it sends an event.
' Both players can move simultaneously without clobbering each other's key state (the
' per-remote debounce/dedup fix), and Player 2's paddle speed is driven by the live analog
' left-stick value via the brs-engine-only roUniversalControlEvent.GetValue() extension,
' falling back to fixed-speed digital Up/Down when no analog reading is available yet.
'
' AnalogAxis indices (see docs/remote-control.md#analog-controller-values-brs-engine-extension):
'   0=LeftX  1=LeftY  2=RightX  3=RightY  4=LeftTrigger  5=RightTrigger

' brs-engine has no runtime `const` statement, so key/axis codes are grouped in a plain AA.
function PongKeys() as object
    return { back: 0, up: 2, down: 3, axisLeftY: 1 }
end function

function RandomDirection() as integer
    if Rnd(2) = 1
        return -1
    end if
    return 1
end function

sub main()
    m.keys = PongKeys()

    ' `multi_controllers` on roRemoteInfo.hasFeature() is a brs-engine capability flag (unrelated
    ' Roku equivalent) - true whenever GetValue() exists on this build, regardless of whether the
    ' app's manifest turns the behavior on. Gate the call on it so this same source still runs
    ' safely (falling back to digital-only Player 2 control) on older simulator versions that
    ' predate GetValue() and would otherwise throw calling an unknown member.
    remoteInfo = CreateObject("roRemoteInfo")
    m.hasAnalogSupport = remoteInfo.HasFeature("multi_controllers", 0)

    m.width = 1280
    m.height = 720
    m.margin = 40
    m.paddleW = 16
    m.paddleH = 130
    m.ballSize = 22
    m.digitalSpeed = 9.0
    m.maxAnalogSpeed = 15.0
    m.analogDeadzone = 0.12
    m.winScore = 7

    m.colors = {
        bg: &h08080FFF
        net: &h46465AFF
        p1: &h5AC8FFFF
        p2: &hFF6E6EFF
        ball: &hFFCD3CFF
        text: &hF0F0F5FF
        dim: &hB4B4BEFF
    }

    screen = CreateObject("roScreen", true, m.width, m.height)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)

    fontReg = CreateObject("roFontRegistry")
    m.bigFont = fontReg.GetDefaultFont(72, true, false)
    m.medFont = fontReg.GetDefaultFont(28, true, false)
    m.smallFont = fontReg.GetDefaultFont(20, false, false)

    ResetMatch()
    ServeBall(RandomDirection())

    clock = CreateObject("roTimespan")
    clock.Mark()
    frameMs = 16

    while true
        msg = port.GetMessage()
        if type(msg) = "roUniversalControlEvent"
            if HandleInput(msg)
                exit while ' Back button pressed on any remote
            end if
        else
            Sleep(1)
        end if

        if clock.TotalMilliseconds() >= frameMs
            clock.Mark()
            Tick()
            Render(screen)
        end if
    end while
end sub

sub ResetMatch()
    m.score1 = 0
    m.score2 = 0
    m.p1 = { y: (m.height - m.paddleH) / 2, up: false, down: false }
    m.p2 = { y: (m.height - m.paddleH) / 2, up: false, down: false, remote: invalid, event: invalid }
    m.winner = invalid
    m.winTimer = 0
end sub

' Handles one control event. Returns true when the app should exit (Back pressed).
function HandleInput(msg as object) as boolean
    key = msg.GetKey()
    press = msg.IsPress()

    ' GetKey() clamps any printable character to 0 too, same as the real Back code - use
    ' GetChar() to make sure this really is the Back button, not stray keyboard text input.
    if press and key = m.keys.back and msg.GetChar() = 0
        return true
    end if

    remote = msg.GetRemoteID()
    if remote = "WD:0" ' Keyboard is always WD:0 - Player 1
        if key = m.keys.up
            m.p1.up = press
        else if key = m.keys.down
            m.p1.down = press
        end if
    else if Left(remote, 3) = "BT:" ' Game pad - Player 2
        if m.p2.remote = invalid
            m.p2.remote = remote
            print "[pong] Player 2 game pad connected: "; remote
        end if
        if remote = m.p2.remote
            if key = m.keys.up
                m.p2.up = press
            else if key = m.keys.down
                m.p2.down = press
            end if
            ' Cache the event so Tick() can keep polling GetValue() every frame for smooth
            ' analog movement, even between discrete key press/release messages.
            m.p2.event = msg
        end if
    end if
    return false
end function

sub Tick()
    if m.winner <> invalid
        m.winTimer = m.winTimer - 1
        if m.winTimer <= 0
            ResetMatch()
            ServeBall(RandomDirection())
        end if
        return
    end if

    UpdatePaddle(m.p1, m.p1.up, m.p1.down, 0.0)

    analogY = 0.0
    if m.hasAnalogSupport and m.p2.event <> invalid
        analogY = m.p2.event.GetValue(m.keys.axisLeftY)
    end if
    UpdatePaddle(m.p2, m.p2.up, m.p2.down, analogY)

    UpdateBall()
end sub

sub UpdatePaddle(paddle as object, up as boolean, down as boolean, analogY as float)
    speed = 0.0
    if Abs(analogY) > m.analogDeadzone
        speed = analogY * m.maxAnalogSpeed
    else if up
        speed = -m.digitalSpeed
    else if down
        speed = m.digitalSpeed
    end if

    paddle.y = paddle.y + speed
    if paddle.y < m.margin
        paddle.y = m.margin
    else if paddle.y > m.height - m.margin - m.paddleH
        paddle.y = m.height - m.margin - m.paddleH
    end if
end sub

sub ServeBall(direction as integer)
    m.ball = {
        x: (m.width - m.ballSize) / 2
        y: (m.height - m.ballSize) / 2
        dx: 7.0 * direction
        dy: (Rnd(0) * 6.0 - 3.0)
    }
end sub

sub UpdateBall()
    ball = m.ball
    ball.x = ball.x + ball.dx
    ball.y = ball.y + ball.dy

    if ball.y < m.margin
        ball.y = m.margin
        ball.dy = -ball.dy
    else if ball.y > m.height - m.margin - m.ballSize
        ball.y = m.height - m.margin - m.ballSize
        ball.dy = -ball.dy
    end if

    ' Player 1 paddle (left)
    p1x = m.margin
    if ball.dx < 0 and ball.x <= p1x + m.paddleW and ball.x + m.ballSize >= p1x and ball.y + m.ballSize >= m.p1.y and ball.y <= m.p1.y + m.paddleH
        BounceOffPaddle(ball, m.p1, 1)
    end if

    ' Player 2 paddle (right)
    p2x = m.width - m.margin - m.paddleW
    if ball.dx > 0 and ball.x + m.ballSize >= p2x and ball.x <= p2x + m.paddleW and ball.y + m.ballSize >= m.p2.y and ball.y <= m.p2.y + m.paddleH
        BounceOffPaddle(ball, m.p2, -1)
    end if

    if ball.x < 0
        m.score2 = m.score2 + 1
        AfterPoint(1) ' serve toward Player 1, who just missed
    else if ball.x > m.width
        m.score1 = m.score1 + 1
        AfterPoint(-1) ' serve toward Player 2, who just missed
    end if
end sub

sub BounceOffPaddle(ball as object, paddle as object, direction as integer)
    center = paddle.y + m.paddleH / 2
    offset = (ball.y + m.ballSize / 2 - center) / (m.paddleH / 2)
    ball.dx = Abs(ball.dx) * direction * 1.03 ' small speed-up on every rally
    ball.dy = offset * 7.0
end sub

sub AfterPoint(direction as integer)
    if m.score1 >= m.winScore
        m.winner = "PLAYER 1"
    else if m.score2 >= m.winScore
        m.winner = "PLAYER 2"
    end if

    if m.winner <> invalid
        m.winTimer = 180 ' ~3 seconds at 60fps before auto-restart
    else
        ServeBall(direction)
    end if
end sub

sub Render(screen as object)
    c = m.colors
    screen.Clear(c.bg)

    ' Center net
    dash = 16
    y = m.margin
    while y < m.height - m.margin
        screen.DrawRect(m.width / 2 - 2, y, 4, dash, c.net)
        y = y + dash * 2
    end while

    screen.DrawRect(m.margin, m.p1.y, m.paddleW, m.paddleH, c.p1)
    screen.DrawRect(m.width - m.margin - m.paddleW, m.p2.y, m.paddleW, m.paddleH, c.p2)

    if m.winner = invalid
        screen.DrawRect(m.ball.x, m.ball.y, m.ballSize, m.ballSize, c.ball)
    end if

    score = Str(m.score1).Trim() + "        " + Str(m.score2).Trim()
    screen.DrawText(score, m.width / 2 - 130, 24, c.text, m.bigFont)

    screen.DrawText("P1: Keyboard (Arrow Keys)", m.margin, m.height - 34, c.p1, m.smallFont)
    p2Label = "P2: connect a game pad and press any button"
    if m.p2.remote <> invalid
        p2Label = "P2: Game Pad (" + m.p2.remote + ") - Left Stick or D-Pad"
    end if
    p2Width = m.smallFont.GetOneLineWidth(p2Label, m.width)
    screen.DrawText(p2Label, m.width - m.margin - p2Width, m.height - 34, c.p2, m.smallFont)

    if m.winner <> invalid
        label = m.winner + " WINS!"
        w = m.medFont.GetOneLineWidth(label, m.width)
        screen.DrawText(label, (m.width - w) / 2, m.height / 2 - 14, c.text, m.medFont)
    end if

    screen.SwapBuffers()
end sub
