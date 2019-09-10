sub main() 
    booleanObjectA = createObject("roBoolean", true) 
    booleanObjectB = createObject("roBoolean", false)
    doubleObject = createObject("roDouble", 123.456)
    floatObject = createObject("roFloat", 789.012)
    intergerObject = createObject("roInt", 23)

    print "Boolean object A " booleanObjectA.toStr()
    print "Boolean object B " booleanObjectB
    print "Comparing true = false should be false "booleanObjectA = booleanObjectB
    print "Double value " doubleObject
    print "Double value * 2 " doubleObject.getDouble() * 2
    print "Float object "floatObject
    print "Float object * 10 "floatObject.getFloat() * 10
    print "Integer object "intergerObject
    print "Integer object times itself "intergerObject.getInt() * intergerObject.getInt()

end sub