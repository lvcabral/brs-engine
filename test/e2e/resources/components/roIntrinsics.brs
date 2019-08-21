sub main()
    print "Starting"
    booleanObjectA = createObject("roBoolean", true)
    print "booleanObjectA set"
    booleanObjectB = createObject("roBoolean", false)
    print "booleanObjectB set"
    doubleObject = createObject("roDouble", 123.456)
    print "doubleObject set"
    floatObject = createObject("roFloat", 789.012)
    print "float object set"
    intergerObject = createObject("roInt", 23)
    print "Int object set"

print booleanObjectA
print booleanObjectB
print booleanObjectA = booleanObjectB
print doubleObject
print floatObject
print intergerObject

end sub