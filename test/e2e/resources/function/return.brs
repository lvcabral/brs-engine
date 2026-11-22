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

function forEachReturn(items as object)
    print "forEachReturn:"
    for each item in items
        if item = "b" then return item
    end for
    return "none"
end function

function tryReturn()
    print "tryReturn:"
    try
        return "from try"
    catch e
        return "unreachable"
    end try
end function

function catchReturn()
    print "catchReturn:"
    try
        throw "boom"
    catch e
        return "caught " + e.message
    end try
    return "unreachable"
end function

function nestedLoopReturn()
    print "nestedLoopReturn:"
    for i = 1 to 3
        j = 0
        while j < 3
            if i * j = 4 then return i * 10 + j
            j = j + 1
        end while
    end for
end function

function objectFromLoop()
    for i = 1 to 3
        obj = {id: i}
        if i = 2 then return obj
    end for
end function

function coercedNestedReturn(x as integer) as float
    if x > 0 then return x
    return 0
end function

sub voidEarlyReturn()
    print "voidEarlyReturn:"
    if true then return
    print "unreachable"
end sub

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

print forEachReturn(["a", "b", "c"])
print tryReturn()
print catchReturn()
print nestedLoopReturn()
print "objectFromLoop:"
print objectFromLoop().id
print "coercedNestedReturn:"
print type(coercedNestedReturn(3)) coercedNestedReturn(3)
voidEarlyReturn()
