sub init()
    m.background = m.top.findNode("background")
    m.top.enableRenderTracking = true
    m.top.observeField("renderTracking", "onRenderTracking")
end sub

sub onRenderTracking()
    if m.top.renderTracking <> "full" then return
    m.background.width = m.top.buttonWidth
    m.background.height = 70
    m.background.visible = true
    m.top.isReady = true
end sub
