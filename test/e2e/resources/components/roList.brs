sub Main()
    list = CreateObject("roList")
    list.AddTail("a")
    list.AddTail("b")
    list.AddTail("c")
    list.AddTail("d")
    list.ResetIndex()
    x = list.GetIndex()
    while x <> invalid
        print x
        x = list.GetIndex()
    end while
    print list[2]
end sub