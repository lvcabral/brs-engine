sub main()
    a = 1
    b = "abc"
    c = 123.456
    d = invalid
    test(a, b, c)
    test(a, b, invalid)
    test(a)
end sub

function test(i as integer, s as string, d as object) as boolean
    print i, s, d
end function