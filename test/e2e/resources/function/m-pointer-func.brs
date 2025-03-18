Sub Main()
    m.someValue = "root"
    objA = { myMethod: do_something, someValue: "not root" }
    print objA.myMethod()
    anon_func_context()
End Sub

function do_something()
    print m.someValue
    return GenericFunction()
end function

Function GenericFunction()
    return m.someValue      'Must use Global m
End Function

function anon_func_context()
    a = {
      foo: "bar",
      printM: sub()
            print(m.foo)
      end sub
    }
  a.printM()
    a["printM"]()
  x = a["printM"]
  x()
end function