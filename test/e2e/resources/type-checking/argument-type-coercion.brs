sub acceptsInteger(t as integer)
    print "received: " t.toStr()
end sub

sub acceptsFloat(t as float)
    print "received: " t.toStr()
end sub

sub acceptsDouble(t as double)
    print "received: " t.toStr()
end sub

sub acceptsLongInt(t as longinteger)
    print "received: " t.toStr()
end sub

function main()
    values = {
        "integer": 13,
        "float": 3.14159!,
        "double": 2.71828#,
        "longinteger": 2147483647119&,
    }

    for each kv in values.items()
        _type = kv.key
        value = kv.value

        for each f in [acceptsInteger, acceptsFloat, acceptsDouble, acceptsLongInt]
            print "calling '" f "' with argument of type '" _type "' with value: " value.toStr()
            f(value)
        end for
    end for
end function
