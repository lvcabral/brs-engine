sub main()
    values = {
        "integer": 13,
        "float": 3.14159!,
        "double": 2.71828#,
        "longinteger": 2147483647119&,
    }

    for each kv in values.items()
        _type = kv.key
        value = kv.value

        print "assigning RHS of type '" _type "' with value: " value.toStr()

        integer% = value
        float! = value
        double# = value
        longinteger& = value

        print "integer% = " integer%
        print "float! = " float!
        print "double# = " double#
        print "longinteger& = " longinteger&
    end for
end sub
