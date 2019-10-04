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
