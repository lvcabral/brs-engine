sub main()
    aa = {
        foo: "bar",
        lorem: 1.234
    }
    aa.self = aa
    print formatJson(aa)

    print formatJson(parseJson("{""boolean"":false,""float"":3.14,""integer"":2147483647,""longinteger"":2147483650,""null"":null,""string"":""ok""}"))
    pi = createObject("roFloat")
    pi.setFloat(3.14)
    print parseJson(formatJson({
        string: "ok",
        null: invalid,
        longinteger: 2147483650,
        integer: 2147483647,
        float: pi,
        boolean: false
    }))
    ' Test parseJson with invalid input
    a = {
        nx: 123
        sa: "abc"
        di: CreateObject("roDeviceInfo")
        ar: [1, 2, 3]
    }
    print formatJson(a)
    print formatJson(a, &h0100)
    print formatJson(a, &h0200)
    ' Test UNICODE conversion on FormatJson
    euroStr = Chr(&h20AC)
    ? FormatJSON(euroStr)
    ? FormatJSON(euroStr, &h0001)
    ' Test case sensitivity on ParseJSON
    print parseJSON("123")
    print parseJSON("""ABC""")
    json = "{""x"": 123, ""X"": 456}"
    print parseJSON(json, "i")
    print parseJSON("{""root"": " + json + "}").root
    ' Test numeric precision on ParseJSON
    ' Integer tests (32-bit signed: -2,147,483,648 to 2,147,483,647)
    print parseJSON("{""num"": 2147483647}")?.num ' Max positive integer
    print parseJSON("{""num"": -2147483648}")?.num ' Min negative integer
    ' Long Integer tests (64-bit signed: beyond 32-bit range)
    print parseJSON("{""num"": 2147483648}")?.num ' Beyond max integer
    print parseJSON("{""num"": -2147483649}")?.num ' Beyond min integer
    a = parseJSON("{""num"": 9223372036854775807}")?.num ' Max long integer
    print a, type(a, 3)
    b = parseJSON("{""num"": -9223372036854775808}")?.num ' Min long integer
    print b, type(b, 3)
    ' Float tests (32-bit IEEE 754 single precision)
    c = parseJSON("{""num"": 340282346638528859811704183484516925440}")?.num ' Max positive float
    print c, type(c, 3)
    ' Double tests (64-bit IEEE 754 double precision)
    d = parseJSON("{""num"": 1.1234567}")?.num
    print d, type(d, 3)
    e = parseJSON("{""num"": 11.1234567}")?.num
    print e, type(e, 3)
    f = parseJSON("{""num"": 111.1234567}")?.num
    print f, type(f, 3)
    g = parseJSON("{""num"": 1111.1234567}")?.num
    print g, type(g, 3)
	h = parseJSON("{""num"": 1.1234567}", "d")?.num
	print h, type(h, 3)
	i = parseJSON("{""num"": 11.1234567}", "d")?.num
	print i, type(i, 3)
    j = parseJSON("{""num"": 111.1234567}", "d")?.num
    print j, type(j, 3)
	k = parseJSON("{""num"": 1111.1234567}", "d")?.num
	print k, type(k, 3)
    l = parseJSON("{""num"": 1e308}")?.num
    print l, type(l, 3)
    n = parseJSON("{""num"": 2e308}")?.num
    print n, type(n, 3)
    o = parseJSON("{""num"": 2e3}")?.num
    print o, type(o, 3)
    ' Test ParseJSON with invalid input
    print parseJSON("tru")
	print parseJSON("")
	print parseJSON("{""num"": -1.12345678}", "Id")?.num
    print parseJSON("{""num"": -1.12345678}", "Di")?.num
    print parseJSON("{""num"": -1.12345678}", "id ")?.num
end sub