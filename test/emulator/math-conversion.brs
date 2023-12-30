sub main()
    a# = 123
    b# = 123.456
    x = b#
    print a#, b#, int(b#), sqr(x)
    i = 123
    c# = i
    j% = 123.456
    k% = b#
    print c#, j%, k%
    print type(a#), type(b#), type(c#), type(i), type(j%), type(k%)
end sub
'Expected result
' 123             123
' 123             123
' Double          Double          Double          Integer         Integer         Integer