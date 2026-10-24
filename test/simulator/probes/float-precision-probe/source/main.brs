' Float Precision Probe: whether a Float keeps its float32 value or a 7-digit decimal, seen through printing, format
' strings, FormatJson, conversion to Double, comparisons, arithmetic and math functions. Written for #1286.
' Output: PROBE|<case>|<type>|print=|str=|tostr=|g9=|g17=|json=
sub main()
    ' Gives time to reconnect to the debug console, which drops its clients when an app launches.
    sleep(5000)
    print "PROBE|start"
    show("lit-1.1", 1.1!)
    show("lit-0.1", 0.1!)
    show("lit-0.3", 0.3!)
    show("lit-nosuffix-1.1", 1.1)
    show("lit-pi", 3.14159265!)
    show("lit-123456789", 123456789!)
    show("lit-16777217", 16777217!)
    show("lit-16777219", 16777219!)
    show("lit-1e38", 1e38!)
    show("lit-1.5e-45", 1.5e-45)
    show("lit-2.5", 2.5!)
    show("lit-1234567.5", 1234567.5!)
    show("lit-0.000123456789", 0.000123456789!)
    show("mul-1.1*1.1", 1.1! * 1.1!)
    show("mul-0.1*3", 0.1! * 3)
    show("add-0.1+0.2", 0.1! + 0.2!)
    show("div-1/3", 1! / 3!)
    show("div-int-1/3", 1 / 3)
    show("div-2/3", 2 / 3)
    show("pow-1.1^2", 1.1! ^ 2)
    show("sqr-2", Sqr(2))
    show("sin-1", Sin(1))
    show("val-1.1", Val("1.1"))
    show("int-to-float-16777217", 16777217 + 0!)
    show("double-to-float", Csng(1.1#))
    show("float-to-double", Cdbl(5) + 1.1!)
    d# = 1.1!
    show("assign-double", d#)
    f! = 1.1#
    show("assign-float", f!)
    show("mixed-1.1!+1#", 1.1! + 1#)
    show("mixed-0.1!*1#", 0.1! * 1#)
    ' How a Double is written, with and without float32-representable values.
    show("dbl-1.1", 1.1#)
    show("dbl-2.1000000238418579", 2.1000000238418579#)
    show("dbl-1/3", 1# / 3#)
    show("dbl-1.23456789012345", 1.23456789012345#)
    show("dbl-0.1+0.2", 0.1# + 0.2#)
    show("dbl-16777217", 16777217#)
    show("dbl-123456789", 123456789#)
    show("dbl-1e300", 1e300#)
    show("dbl-2.5", 2.5#)
    show("dbl-1/3!", 1# / 3!)
    show("dbl-1234567.5", 1234567.5#)
    show("dbl-0.000123456789", 0.000123456789#)
    show("dbl-12345678.9", 12345678.9#)
    show("lit-10digits", 0.1234567891!)
    show("lit-12345678901", 12345678901!)
    print "PROBE|cmp|1.1!=1.1#|" + (1.1! = 1.1#).ToStr()
    print "PROBE|cmp|0.1!*3=0.3!|" + (0.1! * 3 = 0.3!).ToStr()
    print "PROBE|cmp|0.1!+0.2!=0.3!|" + (0.1! + 0.2! = 0.3!).ToStr()
    print "PROBE|cmp|1/3*3=1|" + (1 / 3 * 3 = 1).ToStr()
    print "PROBE|cmp|16777217!=16777216!|" + (16777217! = 16777216!).ToStr()
    print "PROBE|cmp|1.1!<1.1#|" + (1.1! < 1.1#).ToStr()
    print "PROBE|int|" + Int(16777217!).ToStr() + "|" + Cint(16777217!).ToStr() + "|" + Fix(2.9999999!).ToStr() + "|" + Int(0.1! * 30).ToStr()
    ' Subnormal Float results of Integer ^ negative Integer.
    for each c in [[2, -149], [3, -95], [10, -45], [7, -53], [2, -150]]
        r = c[0] ^ c[1]
        print "PROBE|sub|" + c[0].ToStr() + "^" + c[1].ToStr() + "|" + type(r, 3) + "|" + r.ToStr("%.9e")
    end for
    r = 1.5! ^ -255
    print "PROBE|sub|1.5!^-255|" + type(r, 3) + "|" + r.ToStr("%.9e")
    ' FormatJson and print of whole and large values.
    fj = [3e20!, 1e19!, 9.2e18!, 1e18!, 16777216!, -123456789!, 0.5!, 1e-7!, 2147483648!]
    for each v in fj
        print "PROBE|json-float|" + v.ToStr("%.9g") + "|" + FormatJson([v]) + "|str=" + Str(v)
    end for
    dj = [1.5e300#, 1.2345678901234567e300#, 1e17#, 1.5e17#, 12345678901234567890#, 9007199254740993#, 9.2e18#, 1e19#, 100.25#, -16777217#, 123456789012.5#, 1e-7#, 0.1#, 100#]
    for each v in dj
        print "PROBE|json-double|" + v.ToStr("%.17g") + "|" + FormatJson([v]) + "|str=" + Str(v)
    end for
    ' Str() of Integer and LongInteger values.
    print "PROBE|str-int|" + Str(2166136261&) + "|" + Str(4294967295&) + "|" + Str(-9223372036854775807&) + "|" + Str(16777217) + "|" + Str(123456789) + "|" + Str(2147483647) + "|" + Str(-2147483648) + "|" + Str(1234567)
    print "PROBE|print-double-begin"
    print 1.5e300#
    print 1.5e17#
    print 9007199254740993#
    print 100.25#
    print 0.1#
    print 1e-7#
    print 1# / 3#
    print -1# / 3#
    print 123456789012.5#
    print [1# / 3#, 1.5e17#, 0.1#]
    print {d: 1# / 3#}
    print "PROBE|print-double-end"
    print "PROBE|print-begin"
    print 1.1!; 0.1! * 3; 1 / 3; 123456789!; 1.5e-45
    print [1.1!, 1 / 3]
    print 1.1#; 1# / 3#; 2.1000000238418579#; 123456789#; 1.23456789012345#
    print "PROBE|print-end"
    print "PROBE|done"
end sub

sub show(name as string, v as dynamic)
    print "PROBE|" + name + "|" + type(v, 3) + "|str=" + Str(v) + "|tostr=" + v.ToStr() + "|g9=" + v.ToStr("%.9g") + "|g17=" + v.ToStr("%.17g") + "|json=" + FormatJson([v]) + "|boxed=" + Box(v).ToStr()
end sub
