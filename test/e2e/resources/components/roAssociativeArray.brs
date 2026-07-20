sub main()
    aa = createObject("roAssociativeArray")
    aa.foo = "foo"

    aa.addReplace("bar", 5)
    aa.append({ baz: false })

    print "AA size: " aa.count()                                ' => 3
    print "AA keys size: " aa.keys().count()                    ' => 3
    print "AA items size: " aa.items().count()                  ' => 3
    print "can delete elements: " aa.delete("baz")              ' => true
    print "can look up elements: " aa.lookup("foo") = "foo"     ' => true
    print "can look up elements (brackets): " aa["foo"] = "foo" ' => true
    print "can case insensitive look up elements: " aa.lookupCI("foO") = "foo" ' => true
    print "can check for existence: " aa.doesExist("bar")       ' => true
    print "items() example key: " aa.items()[0].key             ' => bar
    print "items() example value: " aa.items()[0].value         ' => 5

    ' Enable case sentitive mode
    aa.setModeCaseSensitive()
    aa["KeY1"] = "value1"
    print "key is not found if sensitive mode is enabled" aa.doesExist("key1") ' => false
    print "key exits with correct casing" aa["KeY1"] ' => value1
    print "lookup uses mode case too" aa.lookup("KeY1") ' => value1
    print "lookupCI ignore mode case" aa.lookupCI("kEy1") ' => value1

    aa.clear()
    print "can empty itself: " aa.isEmpty()                     ' => true

    ' check mimic of RBI AA keys saving logic
    aa = {"dd": 0, "DD":1}
    print "saved key: "aa.keys()[0] ' => DD
    aa.dd = 2
    print "saved key after accessing by dot: "aa.keys()[0] ' => dd
    aa["Dd"] = 3
    print "saved key after accessing by index: "aa.keys()[0] ' => Dd
    print "AA keys size: " aa.keys().count() ' => 1

    ' Roku OS 15.3 - values() returns the values ordered by key
    conventions = {"2027": "Chicago", "2026": "Los Angeles", "2028": "New York"}
    print "values() count: " conventions.values().count()        ' => 3
    print "values() in key order: " conventions.values().join(", ") ' => Los Angeles, Chicago, New York

    ' A member read of a missing key returns invalid even when an interface method shares the
    ' name (apps probe parsed JSON with `invalid <> data.items`); only a call site resolves it.
    data = {"foo": 1, "testme": function() : return "passed" : end function}
    print "missing items reads invalid: " invalid = data.items   ' => true
    print "missing keys reads invalid: " invalid = data.keys     ' => true
    print "items() still callable: " data.items().count()        ' => 1
    print "key bracket call still works: " data["testme"]()      ' => passed
    print "methods in bracket returns invalid: " data["count"]   ' => invalid
    try
        print "methods in bracket raise error: " data["count"]() ' => error
    catch e
        print "methods in bracket raise error: " e.message
    end try
end sub
