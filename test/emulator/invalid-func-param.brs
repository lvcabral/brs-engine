sub main()
    a = 1
    b = "abc"
    c = 123.456
    d = invalid
    test(a, b, c)
    test(a, invalid, d)
    test(a)
end sub

function test(i as integer, s as string, d as double) as boolean
    print i, s, d
end function