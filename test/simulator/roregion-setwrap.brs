function main()
    screen = CreateObject("roScreen", true, 720, 480)
    screen.SetAlphaEnable(true)
    msgport = CreateObject("roMessagePort")
    screen.setport(msgport)
    black = &h000000FF
    white = &hFFFFFFFF
    color = [black, white]
    bg = createObject("roBitmap", {width: 720, height: 480, alphaenable: true})
    size = 32
    state = 0
    for y = 0 to 15
        for x = 0 to 22
            if state = 0 then state = 1 else state = 0
            bg.drawrect(x * size, y * size, size, size, color[state])
        end for
    end for
    bgRegion = CreateObject("roRegion", bg, 0, 0, 720, 480)
    bgRegion.SetWrap(true)
    while true
        bgRegion.Offset(1, 1, 0, 0)
        screen.clear(0)
        screen.drawObject(0, 0, bgRegion)
        screen.swapbuffers()
    end while
end function