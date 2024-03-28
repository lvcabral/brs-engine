sub main()
    ' direct creation
    r = createObject("RoString")

    r.appendString("hello", 5) ' appends hello to the default empty string
    print r.getString() ' => "hello"

    s = "bar"
    print s.getString() ' => "bar"
    print s.toStr() ' => "bar" (again)

    r.setString("boo!", 1)
    r.appendString("ar", 10)

    ' comparisons
    print r = s ' => true
    print r > s
    print s <= r

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

    ' concatenation
    myStr1 = createObject("roString")
    myStr1.setString("1st.")
    myStr2 = createObject("roString")
    myStr2.setString("2nd.")
    print type(myStr1); " "; myStr1
    print type(myStr2); " "; myStr2
    myStr2 = MyStr1 + MyStr2
    print type(myStr2); " "; myStr2
    myStr1 = "prefix " + myStr1
    print type(myStr1); " "; myStr1
end sub