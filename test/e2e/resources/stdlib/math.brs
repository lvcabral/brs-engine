sub main()
    print Exp(3.1)
    print Log(17.4)
    print Sqr(11.17)
    print Atn(0.5)
    print Cos(3.14 / 4)
    print Sin(3.14 / 2)
    print Tan(3.14 / 4)
    print Abs(-3.5)
    print Cdbl(17)
    print Cint(17.3)
    print Csng(204)
    print Fix(-2.2)
    print Int(7.7)
    print Sgn(33.2)
    print Sgn(-800)

    ' Positive numbers
    print Fix(10.9) ' 10
    print Int(10.9) ' 10
    print Cint(10.9) ' 11

    ' Negative numbers
    print Fix(-10.9) ' -10
    print Int(-10.9) ' -11
    print Cint(-10.9) ' -11

    ' Halfway cases
    print Fix(10.5) ' 10
    print Int(10.5) ' 10
    print Cint(10.5) ' 11

    print Fix(-10.5) ' -10
    print Int(-10.5) ' -11
    print Cint(-10.5) ' -10

    ' Overflow
    lng& = 122334343434
    print lng&     ' => 122334343434
    print Fix(lng&) ' => 2147483647
    print Int(lng&) ' => 2147483647
	print Cint(lng&)' => 2147483647
    lng& = 2147483649
    print Fix(lng&) ' => 2147483647
    print Int(lng&) ' => 2147483647
	print Cint(lng&)' => 2147483647
    lng& = -2147483649
    print Fix(lng&) ' => 2147483647
    print Int(lng&) ' => 2147483647
	print Cint(lng&)' => 2147483647

    ' NaN
    print Sqr(-1) ' => nan
end sub
