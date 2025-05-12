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
end sub