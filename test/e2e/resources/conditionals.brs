sub main()
    foo = 5

    ' just a simple if statement; no else
    if foo < 10 then print 1

    ' this one should get skipped
    if foo < 0 then print "foo < 0"

    ' add an else
    if foo < 1 then print "foo < 1" else print 2

    ' add an else if
    if foo < 1 then print "foo < 1" else if foo = 5 then print 3 else print "foo > 1 and not 5"

    ' just a simple if statement; no else
    if foo < 10 then
        print 4
    end if

    ' this one should get skipped
    if foo < 0 then
        print "foo < 0"
    end if

    ' add an else
    if foo < 1 then
        print "foo < 1"
    else
        print 5
    end if

    ' add an elseif
    if foo < 1 then
        print "foo < 1"
    else if foo < 3 then
        print "foo < 3"
    else if foo = 5 then
        print 6
    else if foo < 10 then
        print "foo < 10"
    else
        print "from else"
    endif

    ' inline if inside if
    if foo < 5
        if foo < 3 then print "foo < 3"
    else if foo = 5
        print 7
    end if

    ' inline if with dotted expression
    aa = {}
    if foo > 5 then aa.value = ">5" else aa.value = 8
    print aa.value

    ' if not with boolean
    if not true then
        print "this will never print"
    end if

    if not false then
        print "not false"
    end if

    ' if not with an expression
    bar = "abc"
    if not bar = "def" then
        print "bar does not equal 'def'"
    end if

    ' if not with or
    if not bar = "def" or false then
        print "if not with or variation 1"
    end if

    if not bar = "abc" or true then
        print "if not with or variation 2"
    end if

    ' if not with and
    if not bar = "def" and true then
        print "if not with and"
    end if

    ' if not with two expressions
    foo = 1
    if not bar = "def" and foo = 1 then
        print "if not with two expressions variation 1"
    end if

    if bar = "abc" and not foo = 2 then
        print "if not with two expressions variation 2"
    end if

    ' if not multiple times
    foo = 1
    if not bar = "def" and not foo = 2 then
        print "if not multiple times"
    end if

    ' if not with <> operator
    if not bar <> "abc" then
        print "if not with <> operator"
    end if

    ' if not with > operator
    foo = 1
    if not foo > 1 then
        print "foo is not > 1"
    end if

    ' if not with < operator
    foo = 2
    if not foo < 2 then
        print "foo is not < 2"
    end if

    ' if not with < operator
    foo = 2
    if not foo < 2 and not foo > 2 then
        print "foo is not < 2 and not > 2"
    end if

    test_issue_481()
    test_issue_30()
end sub

' MWE from https://github.com/sjbarag/brs/issues/481
sub test_issue_481()
    nop = sub() : end sub

    if false then nop(): print "#481 still repro's": return
    print "#481 fixed"
end sub

' Test for https://github.com/rokucommunity/brs/issues/30
function test_issue_30()
    testA = ["apple", 2, "banana", "orange", 5, "grape", "pear"]
    for fruit = 0 to testA.count()-1
        if type(testA[fruit]).inStr(0,"String") = -1 ? testA[fruit]
    next
end function
