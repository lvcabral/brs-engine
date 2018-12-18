sub main()
    aa = createObject("roAssociativeArray")
    aa.foo = "foo"

    aa.addReplace("bar", 5)
    aa.append({ baz: false })

    print "AA size: " aa.count()                            ' => 3
    print "AA keys size: " aa.keys().count()                ' => 3
    print "AA items size: " aa.items().count()              ' => 3
    print "can delete elements: " aa.delete("baz")          ' => true
    print "can look up elements: " aa.lookup("foo") = "foo" ' => true
    print "can check for existence: " aa.doesExist("bar")   ' => true

    aa.clear()
    print "can empty itself: " aa.count() = 0               ' => true
end sub
