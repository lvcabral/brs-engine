sub main()
    print createObject("roBoolean")
    print createObject("roBoolean", true)
    print createObject("roDouble")
    print createObject("roDouble", 1.0)
    print createObject("roFloat")
    print createObject("roFloat", 1.0)
    print createObject("roInt")
    print createObject("roInt", 1, 2, 3)
    print createObject("roLongInteger")
    print createObject("roLongInteger", 1)
    print createObject("roString")
    print createObject("roString", "hello")
    print createObject("roInvalid")
    print createObject("roInvalid", 1)
    print createObject("roScreen")
    print createObject("roScreen", "")
    print createObject("roScreen", true)
    print createObject("roScreen", true, 1280)
    print createObject("roScreen", true, 1280, 720)
    print createObject("roAssociativeArray").count()
    try
        print createObject("roAssociativeArray", {a: 1, b: 2}).count()
    catch e
        print e.number
    end try
    print createObject("roRegex")
    try
        print createObject("roRegex", 1)
    catch e
        print e.number
    end try
end sub