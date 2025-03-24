sub main()
    ' Integer (decimal)
    print 123.ToStr("%d")
    '=> "123"

    n = 300 + 45
    print n.ToStr("The value is %d.")
    '=> "The value is 345."

    month = 7
    print month.ToStr("%2d")
    '=> " 7"

    month = 8
    print month.ToStr("%02d")
    '=> "08"

    month = 9
    print month.ToStr("%-4d")
    '=> "9   "

    ' Integer (hex)
    hexy = 32767 - 1
    print hexy.ToStr("%08X")
    '=> "00007FFE"

    print hexy.ToStr("%06x")
    '=> "007ffe"

    big_num = &H100000000&
    print big_num.ToStr("%d = 0x%0X") ' Fails shows "68719476736 = 0x0"
    '=> "4294967296 = 0x100000000"

    ' Float
    f = 3.141592
    print f.ToStr("%f")
    '=> "3.141592"

    print f.ToStr("%.3f")
    '=> "3.142"

    print f.ToStr("%4.2f")
    '=> "3.14"

    ' String
    s = "123"
    print s.ToStr("[%s]")
    '=> "[123]"

    print s.ToStr("<%5s>")
    '=> "<  123>"

    print s.ToStr("<%-5s>")
    '=> "<123  >"
end sub