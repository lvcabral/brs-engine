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
    print "can check for existence: " aa.doesExist("bar")       ' => true
    print "items() example key: " aa.items()[0].key             ' => bar
    print "items() example value: " aa.items()[0].value         ' => 5

    ' Enable case sentitive mode
    aa.setModeCaseSensitive()
    aa["KeY1"] = "value1"
    print "key is not found if sensitive mode is enabled" aa.doesExist("key1") ' => false
    print "key exits with correct casing" aa["KeY1"] ' => value1
    print "lookup uses mode case too" aa.lookup("KeY1") ' => value1

    aa.clear()
    print "can empty itself: " aa.isEmpty()                     ' => true
end sub
