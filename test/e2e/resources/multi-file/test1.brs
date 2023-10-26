sub Main()
    print("function in same file: " + sameFileFunc())
    print("function in different file: " + differentFileFunc())
    print("function with dependency: " + dependentFunc())
end sub

function sameFileFunc()
    return "from sameFileFunc()"
end function

function dependencyFunc()
    return "from dependencyFunc()"
end function

