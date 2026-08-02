sub init()
    ' Runs while this component is still detached from the scene tree.
    m.top.globalFind = describeNode(m.global.findNode("SceneChild"))
    m.top.topFind = describeNode(m.top.findNode("SceneChild"))
    m.top.globalParent = describeNode(m.global.getParent())
end sub
