sub main()
    m.value = "value 1"
    subf("value 2")
    m.subObj = {func: subf}
    m.value = "value 3"
    m.subObj.func("value 4")
end sub

function subf(newValue as string) as boolean
    print "old: " m.value
    m.value = newValue
    print "new: " m.value
    g = GetGlobalAA()
    print "glb: " g.value
    return true
end function
