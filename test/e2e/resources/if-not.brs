sub main()
    a = {
        bolFalse: false,
        bolTrue: true,
        intFalse: 0,
        intTrue: -1,
        floatFalse: 0.1,
        floatTrue: -1.1
    }
    print a
    print "Positive Test Bool"
    if a.bolFalse then print "True" else print "False"
    if a.bolTrue then print "True" else print "False"
    print "Positive Test Int"
    if a.intFalse then print "True" else print "False"
    if a.intTrue then print "True" else print "False"
    print "Positive Test Float"
    if a.floatFalse then print "True" else print "False"
    if a.floatTrue then print "True" else print "False"
    print "Negative Test Bool"
    if not a.bolFalse then print "True" else print "False"
    if not a.bolTrue then print "True" else print "False"
    print "Negative Test Int"
    if not a.intFalse then print "True" else print "False"
    if not a.intTrue then print "True" else print "False"
    print "Negative Test Float"
    if not a.floatFalse then print "True" else print "False"
    if not a.floatTrue then print "True" else print "False"
    print "Mixed Test"
    if a.intTrue and a.bolTrue then print "True" else print "False"
    if a.intTrue and a.floatTrue then print "True" else print "False"
    if a.floatTrue and a.bolTrue then print "True" else print "False"
    print "With Bitwise"
    print 1 and 2 = false
	print (1 and 2) = false
end sub