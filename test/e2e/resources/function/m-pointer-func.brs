Sub Main()
    m.someValue = "root"
    objA = { myMethod: do_something, someValue: "not root" }
    print objA.myMethod()
End Sub

function do_something()
    print m.someValue
    return GenericFunction()
end function

Function GenericFunction()
    return m.someValue      'Must use Global m
End Function
