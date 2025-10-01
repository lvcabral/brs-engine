sub main()
    try
        a = foo(2)
        print a; " "; type(a, 3)
        b = bar(1)
        print b; " "; type(b, 3)
        b = bar(2)
        print b; " "; type(b, 3)
        c = dar()
        print c; " "; type(c, 3)
        d = sar()
        print d; " "; type(d, 3)
    catch e
        print e.message
    end try
end sub

function foo(x) as boolean
    if x = 1
        return true
    end if
end function

function bar(y) as object
    if y = 1
        return invalid
    end if
end function

function dar() as double
    a = 3.14
end function

function sar() as string
    a = "hello"
end function

