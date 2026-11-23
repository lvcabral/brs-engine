sub init()
    m.top.shadowTag = "channel-init:" + bgHelper()
end sub

function bgHelper() as String
    return "bg-helper"
end function

function describe(_ = invalid as Dynamic) as String
    return "describe:" + m.top.subtype()
end function

function onKeyEvent(key as String, press as Boolean) as Boolean
    if press then print "PROBE|900|S8.key|" + m.top.subtype() + ":" + key + "|"
    return press
end function
