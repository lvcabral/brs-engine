sub main()
    testCast()
end sub

function testCast()
    print mathPi(), type(mathPi())
    print getDouble(mathPi()), type(getDouble(mathPi()))
    print getInt(0.5), type(getInt(0.5))
    print getInt(1.7), type(getInt(1.7))
    print getDouble(12), type(getDouble(12))
end function

function mathPI() as float
    return 3.14159265358
end function

function getFloat(value) as double
    return 110 + value
end function

function getDouble(value) as double
    return 110 + value
end function

function getInt(value) as integer
    return value
end function

