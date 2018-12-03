function differentFileFunc()
    return "from differentFileFunc()"
end function

function dependentFunc()
    return "from dependentFunc() with help from: " + dependencyFunc()
end function

Main()