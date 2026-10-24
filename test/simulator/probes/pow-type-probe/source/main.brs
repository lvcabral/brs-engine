' Pow Type Probe: the type and value of x ^ y for every pair of numeric types (Integer, LongInteger, Float, Double).
' Written for #1283. type(r, 3) gives the exact numeric type. Output: PROBE|pow|<base>|<exponent>|<type>|<value>
sub main()
    ' Gives time to reconnect to the debug console, which drops its clients when an app launches.
    sleep(5000)
    print "PROBE|start"
    r = 2 ^ 2
    print "PROBE|pow|2|2|" + type(r, 3) + "|" + r.ToStr()
    r = 2 ^ -1
    print "PROBE|pow|2|-1|" + type(r, 3) + "|" + r.ToStr()
    r = 2 ^ 31
    print "PROBE|pow|2|31|" + type(r, 3) + "|" + r.ToStr()
    r = 2 ^ 2&
    print "PROBE|pow|2|2&|" + type(r, 3) + "|" + r.ToStr()
    r = 2 ^ -1&
    print "PROBE|pow|2|-1&|" + type(r, 3) + "|" + r.ToStr()
    r = 2 ^ 62&
    print "PROBE|pow|2|62&|" + type(r, 3) + "|" + r.ToStr()
    r = 2 ^ 0.5!
    print "PROBE|pow|2|0.5!|" + type(r, 3) + "|" + r.ToStr()
    r = 2 ^ 2!
    print "PROBE|pow|2|2!|" + type(r, 3) + "|" + r.ToStr()
    r = 2 ^ 0.5#
    print "PROBE|pow|2|0.5#|" + type(r, 3) + "|" + r.ToStr()
    r = 2 ^ 2#
    print "PROBE|pow|2|2#|" + type(r, 3) + "|" + r.ToStr()
    r = 2 ^ -1074
    print "PROBE|pow|2|-1074|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ 2
    print "PROBE|pow|-2|2|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ -1
    print "PROBE|pow|-2|-1|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ 31
    print "PROBE|pow|-2|31|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ 2&
    print "PROBE|pow|-2|2&|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ -1&
    print "PROBE|pow|-2|-1&|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ 62&
    print "PROBE|pow|-2|62&|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ 0.5!
    print "PROBE|pow|-2|0.5!|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ 2!
    print "PROBE|pow|-2|2!|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ 0.5#
    print "PROBE|pow|-2|0.5#|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ 2#
    print "PROBE|pow|-2|2#|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ -1074
    print "PROBE|pow|-2|-1074|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ 2
    print "PROBE|pow|46341|2|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ -1
    print "PROBE|pow|46341|-1|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ 31
    print "PROBE|pow|46341|31|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ 2&
    print "PROBE|pow|46341|2&|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ -1&
    print "PROBE|pow|46341|-1&|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ 62&
    print "PROBE|pow|46341|62&|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ 0.5!
    print "PROBE|pow|46341|0.5!|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ 2!
    print "PROBE|pow|46341|2!|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ 0.5#
    print "PROBE|pow|46341|0.5#|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ 2#
    print "PROBE|pow|46341|2#|" + type(r, 3) + "|" + r.ToStr()
    r = 46341 ^ -1074
    print "PROBE|pow|46341|-1074|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ 2
    print "PROBE|pow|2&|2|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ -1
    print "PROBE|pow|2&|-1|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ 31
    print "PROBE|pow|2&|31|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ 2&
    print "PROBE|pow|2&|2&|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ -1&
    print "PROBE|pow|2&|-1&|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ 62&
    print "PROBE|pow|2&|62&|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ 0.5!
    print "PROBE|pow|2&|0.5!|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ 2!
    print "PROBE|pow|2&|2!|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ 0.5#
    print "PROBE|pow|2&|0.5#|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ 2#
    print "PROBE|pow|2&|2#|" + type(r, 3) + "|" + r.ToStr()
    r = 2& ^ -1074
    print "PROBE|pow|2&|-1074|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ 2
    print "PROBE|pow|-2&|2|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ -1
    print "PROBE|pow|-2&|-1|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ 31
    print "PROBE|pow|-2&|31|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ 2&
    print "PROBE|pow|-2&|2&|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ -1&
    print "PROBE|pow|-2&|-1&|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ 62&
    print "PROBE|pow|-2&|62&|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ 0.5!
    print "PROBE|pow|-2&|0.5!|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ 2!
    print "PROBE|pow|-2&|2!|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ 0.5#
    print "PROBE|pow|-2&|0.5#|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ 2#
    print "PROBE|pow|-2&|2#|" + type(r, 3) + "|" + r.ToStr()
    r = -2& ^ -1074
    print "PROBE|pow|-2&|-1074|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ 2
    print "PROBE|pow|1.5!|2|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ -1
    print "PROBE|pow|1.5!|-1|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ 31
    print "PROBE|pow|1.5!|31|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ 2&
    print "PROBE|pow|1.5!|2&|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ -1&
    print "PROBE|pow|1.5!|-1&|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ 62&
    print "PROBE|pow|1.5!|62&|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ 0.5!
    print "PROBE|pow|1.5!|0.5!|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ 2!
    print "PROBE|pow|1.5!|2!|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ 0.5#
    print "PROBE|pow|1.5!|0.5#|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ 2#
    print "PROBE|pow|1.5!|2#|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5! ^ -1074
    print "PROBE|pow|1.5!|-1074|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ 2
    print "PROBE|pow|1.5#|2|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ -1
    print "PROBE|pow|1.5#|-1|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ 31
    print "PROBE|pow|1.5#|31|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ 2&
    print "PROBE|pow|1.5#|2&|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ -1&
    print "PROBE|pow|1.5#|-1&|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ 62&
    print "PROBE|pow|1.5#|62&|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ 0.5!
    print "PROBE|pow|1.5#|0.5!|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ 2!
    print "PROBE|pow|1.5#|2!|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ 0.5#
    print "PROBE|pow|1.5#|0.5#|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ 2#
    print "PROBE|pow|1.5#|2#|" + type(r, 3) + "|" + r.ToStr()
    r = 1.5# ^ -1074
    print "PROBE|pow|1.5#|-1074|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ 2
    print "PROBE|pow|2#|2|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ -1
    print "PROBE|pow|2#|-1|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ 31
    print "PROBE|pow|2#|31|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ 2&
    print "PROBE|pow|2#|2&|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ -1&
    print "PROBE|pow|2#|-1&|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ 62&
    print "PROBE|pow|2#|62&|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ 0.5!
    print "PROBE|pow|2#|0.5!|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ 2!
    print "PROBE|pow|2#|2!|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ 0.5#
    print "PROBE|pow|2#|0.5#|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ 2#
    print "PROBE|pow|2#|2#|" + type(r, 3) + "|" + r.ToStr()
    r = 2# ^ -1074
    print "PROBE|pow|2#|-1074|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ 2
    print "PROBE|pow|-8#|2|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ -1
    print "PROBE|pow|-8#|-1|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ 31
    print "PROBE|pow|-8#|31|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ 2&
    print "PROBE|pow|-8#|2&|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ -1&
    print "PROBE|pow|-8#|-1&|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ 62&
    print "PROBE|pow|-8#|62&|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ 0.5!
    print "PROBE|pow|-8#|0.5!|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ 2!
    print "PROBE|pow|-8#|2!|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ 0.5#
    print "PROBE|pow|-8#|0.5#|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ 2#
    print "PROBE|pow|-8#|2#|" + type(r, 3) + "|" + r.ToStr()
    r = -8# ^ -1074
    print "PROBE|pow|-8#|-1074|" + type(r, 3) + "|" + r.ToStr()
    ' Typed variables instead of literals.
    d = 2#
    i = -1074
    l = 3&
    f = 2!
    r = d ^ i
    print "PROBE|var|d^i|" + type(r, 3) + "|" + r.ToStr()
    r = d ^ l
    print "PROBE|var|d^l|" + type(r, 3) + "|" + r.ToStr()
    r = l ^ d
    print "PROBE|var|l^d|" + type(r, 3) + "|" + r.ToStr()
    r = f ^ l
    print "PROBE|var|f^l|" + type(r, 3) + "|" + r.ToStr()
    r = i ^ f
    print "PROBE|var|i^f|" + type(r, 3) + "|" + r.ToStr()
    ' Right associativity, and the precision of the result.
    r = 2 ^ 3 ^ 2
    print "PROBE|assoc|2^3^2|" + type(r, 3) + "|" + r.ToStr()
    r = 1.1# ^ 2
    print "PROBE|prec|1.1#^2|" + type(r, 3) + "|" + r.ToStr("%.17g")
    r = 1.1! ^ 2
    print "PROBE|prec|1.1!^2|" + type(r, 3) + "|" + r.ToStr("%.17g")
    r = 3& ^ 40
    print "PROBE|prec|3&^40|" + type(r, 3) + "|" + r.ToStr()
    r = 3 ^ 40
    print "PROBE|prec|3^40|" + type(r, 3) + "|" + r.ToStr()
    ' Unary minus between ^ and *.
    r = -2 ^ 2 * 3
    print "PROBE|mix|-2^2*3|" + type(r, 3) + "|" + r.ToStr()
    r = 2 * -3 ^ 2
    print "PROBE|mix|2*-3^2|" + type(r, 3) + "|" + r.ToStr()
    r = -2 ^ -1
    print "PROBE|mix|-2^-1|" + type(r, 3) + "|" + r.ToStr()
    print "PROBE|done"
end sub
