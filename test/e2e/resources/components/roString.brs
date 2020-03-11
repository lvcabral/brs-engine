sub main()
    ' direct creation
    r = createObject("RoString", "foo")

    s = "bar"
    print s.getString() ' => "bar"
    print s.toStr() ' => "bar" (again)

    r.setString("boo!", 1)
    r.appendString("ar", 10)

    ' comparisons
    print r = s ' => true

    ' autoboxing
    t = "a/b/c"
    print t.len() ' => 5
    print t.split("/")[1] ' => b

    u = "🐶"
    print u.encodeUriComponent() ' => %F0%9F%90%B6
    print "%F0%9F%90%B6".decodeUriComponent() ' => 🐶
end sub