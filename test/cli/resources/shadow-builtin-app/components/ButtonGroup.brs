sub init()
    m.top.initRan = true
    m.top.customOnly = "inited"
    label = CreateObject("roSGNode", "Label")
    label.id = "madeInInit"
    m.top.appendChild(label)
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    ' Reading m.top here is what crashed when the built-in class was instantiated instead.
    return m.top.layoutDirection = "vert"
end function
