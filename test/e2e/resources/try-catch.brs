sub main()
    a = 5

    print "[pre_try] a =" a
    try
        a = a * 2
        print "[in_try] a =" a
		subFunc(a)
    catch e
        print "[in_catch] message = " e.message
		print "[in_catch] customField = " e.customField
		for each bt in e.backtrace
			print "[backtrace] =" bt.line_number
		end for
    end try

    print "[post_try] a =" a
	subFunc(a + 1)

	print "[return in try] = "; returnInTry()
end sub

function subFunc(a)
	try
		print "[subFunc] a =" a
		if a = 10
			thirdLevel()
		end if
		a = a * "" ' force a type error
	catch e
		print "Error # =" e.number
		if a = 10
        	e.customField = true
			throw e
		else
			print "Error message = " e.message
		end if
    endtry
end function

sub thirdLevel()
	print "[thirdLevel]"
	throw {message: "subFunc custom error message!", number: 6502, customField: false}
end sub

function returnInTry()
    try
        return "success"
    catch e
        return "fail"
    end try
    return "fail"
end function