'-----------------------------------------------------------------------------
' Tests the limits of the BrightScript Double (64-bit floating point) type.
'-----------------------------------------------------------------------------
Function main()
    ' A number with a '#' suffix forces the Double type.
    ' We start with a large double.
    maxDouble# = 1.7976931348623158e308#

    ' Smallest positive double (subnormal).
    minPositiveDouble# = 4.9406564584124654e-324#

    ' Display the expected maximum and minimum values.
    print "--- Expected IEEE 754-2008 64-bit Double Limits ---"
    print "Max Positive Double: " + maxDouble#.ToStr("%.16e")
    print "Min Positive Double: " + minPositiveDouble#.ToStr("%.16e")
    print ""

    print "--- Testing Exceeding Max Value (Overflow) ---"
    testOverflow# = maxDouble# * 1.1 ' Multiply by 1.1 to cause an overflow.
    print "maxDouble# * 1.1 = " + testOverflow#.ToStr()
    print ""

    print "--- Testing Exceeding Min Positive Value (Underflow) ---"
    testUnderflow# = minPositiveDouble# / 2.0 ' Divide by 2 to cause an underflow.
    print "minPositiveDouble# / 2.0 = " + testUnderflow#.ToStr()
    if testUnderflow# = 0.0
        print "*** Confirmed: Underflow results in 0."
    else
        print "*** Error: Underflow did not result in 0."
    end if
    print ""

    print "--- Testing Negative Limits ---"
    testNegativeMax# = -minPositiveDouble#
    testNegativeMin# = -maxDouble#
    print "Min Negative Double (approx): " + testNegativeMin#.ToStr("%.16e")
    print "Max Negative Double (approx): " + testNegativeMax#.ToStr("%.16e")
    print ""

    print "--- Test Complete ---"
End Function
