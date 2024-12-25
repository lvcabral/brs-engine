sub main()
    booleanObjectA = createObject("roBoolean")
    booleanObjectA.setBoolean(true)
    booleanObjectB = createObject("roBoolean")
    doubleObject = createObject("roDouble")
    doubleObject.setDouble(123.456)
    floatObject = createObject("roFloat")
    floatObject.setFloat(789.012)
    integerObject = createObject("roInt")
    integerObject.setInt(23)
    longIntegerObject = createObject("roLongInteger")
    longIntegerObject.setLongInt(2000111222333)

    print "Boolean object A " booleanObjectA.toStr()
    print "Boolean object B " booleanObjectB
    print "Comparing true = false should be false "booleanObjectA = booleanObjectB
    print "Double value " doubleObject
    print "Double value * 2 " doubleObject.getDouble() * 2
    print "Float object "floatObject
    print "Float object * 10 "floatObject.getFloat() * 10
    print "Integer object "integerObject
    print "Integer object times itself "integerObject.getInt() * integerObject.getInt()
    print "Double to string "doubleObject.toStr()
    print "Float to string "floatObject.toStr()
    print "Integer to string "integerObject.toStr()
    print "LongInteger object type"type(longIntegerObject)
    print "LongInteger to string "longIntegerObject.toStr()
end sub
