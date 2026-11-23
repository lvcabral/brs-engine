sub init()
    m.top.initRan = true
    m.top.customOnly = "inited:" + bgHelper()
    label = CreateObject("roSGNode", "Label")
    label.id = "madeInInit"
    m.top.appendChild(label)
end sub

function bgHelper() as String
    return "bg-helper"
end function
