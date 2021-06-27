' ----- declare a bunch of functions -----
function staticReturn()
    return "staticReturn"
end function

function conditionalReturn(t as boolean)
    print "conditionalReturn:"
    if t = true then
        return 5
    else
        return invalid
    end if
end function

function forLoopReturn(stopAt as integer)
    print "forLoopReturn:"
    for i = 0 to 10
        if i = stopAt then return i
    end for
end function

function whileLoopReturn(stopAt as integer)
    print "whileLoopReturn:"
    i = 0
    while i < 10
        if i = stopAt then return i
        i = i + 1
    end while
end function

function boxedReturnType() as object
    return 3.14159
end function

function returnInvalidAsObject() as object
    return invalid
end function

' ----- then execute them -----
print staticReturn()
print conditionalReturn(true)
print conditionalReturn(false)
print forLoopReturn(2)
print whileLoopReturn(3)

boxed = boxedReturnType()
print "boxedReturnType:"
print type(boxed) boxed ' => RoFloat 3.14159

print "invalidAsObject:"
boxedInvalid = returnInvalidAsObject() ' => invalid
print type(boxedInvalid) boxedInvalid ' => roInvalid <Component: roInvalid>
