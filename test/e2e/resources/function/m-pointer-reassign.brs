sub main()
    m.foo = "bar"
    print m.foo
    changeM()
    print m.foo
    aa = {
    printM: printM,
    changeM: changeM
    }
    aa.printM()
    aa.changeM()
    aa.printM()
    print m.abc
    print m.foo
end sub

sub changeM()
    m = 1
    print m + 1
end sub

sub printM()
    if m.abc = invalid
        m.abc = "abc"
    else
        m.abc += "def"
    end if
    print m.abc
end sub
