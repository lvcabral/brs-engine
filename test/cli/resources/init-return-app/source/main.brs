sub Main()
    print "=== Init Return Repro ==="
    plain = CreateObject("roSGNode", "PlainInit")
    print "plain init: "; type(plain)
    jumped = CreateObject("roSGNode", "GotoInit")
    print "goto init: "; type(jumped)
    print "direct goto return: "; type(gotoReturn()); gotoReturn()
    print "=== Init Return Repro Complete ==="
end sub

function gotoReturn() as float
    if true then
        goto done
done:
        return 2
    end if
end function
