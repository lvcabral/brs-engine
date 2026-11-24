sub main()
    print "returned: "; jumpIntoElseIf()
    x = 1
    goto second
    if x = 0 then
        print "if branch"
    else if x = 2 then
        print "first else if"
    else if x = 3 then
second:
        print "second else if, after label"
    else
        print "else branch"
    end if
    print "after if"
end sub

function jumpIntoElseIf() as string
    x = 1
    goto found
    if x = 0 then
        print "zero"
    else if x = 5 then
found:
        return "found"
    end if
    return "not found"
end function
