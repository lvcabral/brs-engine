sub main()
    myVar = "test"
    RightTest(myVar, 1.3)
    LeftTest(myVar, -1)
    boxed = createObject("roString")
    boxed.setString("lorem ipsum")
    print "type(boxed) = " type(boxed) " | boxed = " boxed

    unboxed = unboxing(boxed)
    print "type(unboxed) = " type(unboxed) " | unboxed = " unboxed

    myFunc = _toBeVariable
    print checkSubBox(myFunc)

    ' Signed Integer
    color = &HC0C0C0FF
    print color
end sub

sub unboxing(s as string) as string
    print "type(s) = " type(s) " | s = " s
    return s
end sub


sub RightTest(param1 as dynamic, param2)
    print type(param1), type(param2)
    if param1 <> invalid
        print param1, param2
    else
        print "param invalid"
    end if
end sub

sub LeftTest(param1 as object, param2 as boolean)
    print type(param1), type(param2)
    if invalid <> param1
        print param1, param2
    else
        print "param invalid"
    end if
end sub

function checkSubBox(var as object) as boolean
    print type(var)
    myVar = CreateObject("roDouble")
    myVar.setDouble(0.221212121212)
    print myVar
    return myVar
end function

sub _toBeVariable()
    print "something"
end sub