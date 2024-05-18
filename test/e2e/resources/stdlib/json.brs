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
    a = {
        nx: 123
        sa: "abc"
        di: CreateObject("roDeviceInfo")
        ar: [1, 2, 3]
    }
    print formatJson(a)
    print formatJson(a, 257)
    print formatJson(a, 513)
end sub