Function Main()
	a1 = function(): return "anonymous": end function
	print "s1 "; type(a1); "="; a1
    print "s1() "; a1()

    f1 = Foo
    print "f1 "; Type(f1); "="; f1

    f2 = Box(Foo)
    print "f2 "; Type(f2); "="; f2

    print "adjusting f2"
    AdjustFun(f2)

    print "f2 "; Type(f2); "="; f2
    print "f2()"; "="; f2()

    f3 = f2.GetSub()
    print "f3 "; Type(f3); "="; f3
End Function

Function AdjustFun(f)
    f.SetSub(Bar)
End Function

Function Foo()
    return "--Foo--"
End Function

Function Bar()
    return "--Bar--"
End Function
' ==>
' s1 Function=<Function: $anon_1>
' f1 Function=<Function: foo>
' f2 roFunction=<Function: foo>
' adjusting f2
' f2 roFunction=<Function: bar>
' f2()=--Bar--
' f3 Function=<Function: bar>