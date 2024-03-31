sub main()
    ' direct creation
    r = createObject("RoString")

    r.appendString("hello", 5) ' appends hello to the default empty string
    print r.getString() ' => "hello"

    s = "bar"
    print s.getString() ' => "bar"
    print s.toStr() ' => "bar" (again)

    r.setString("foo") ' setString in the ifString interface
    print r.getString() ' => "foo"

    r.setString("boo!", 1) ' setString in the ifStringOps interface, replaces old value
    r.appendString("ar", 10)

    ' comparisons
    print r = s ' => true
    print r > s ' => false
    print r < s ' => false
    print s <= r ' => true
    print s >= r ' => true

    ' autoboxing
    t = "a/b/c"
    print t.len() ' => 5
    print t.split("/")[1] ' => b

    u = "🐶"
    print u.encodeUriComponent() ' => %F0%9F%90%B6
    print "%F0%9F%90%B6".decodeUriComponent() ' => 🐶
    print "".isEmpty() ' => true
    print "<3".isEmpty() ' => false

    print "1234567890".startsWith("123") ' => true
    print "1234567890".endsWith("890") ' => true
    print "1234567890".startsWith("567", 4) ' => true
    print "1234567890".endsWith("567", 7) ' => true
end sub