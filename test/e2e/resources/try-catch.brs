sub main()
    a = 5

    print "[pre_try] a = " a
    try
        a = a * 2
        print "[in_try] a = " a
		subFunc(a)
    catch e
        print "[in_catch] e = " e.message
		for each bt in e.backtrace
			print "[backtrace] = " bt.line_number
		end for
    end try

    print "[post_try] a = " a
end sub

function subFunc(a)
	try
		print "[subFunc] a = " a
		thirdLevel()
		a = a * "" ' force a type error
	catch e
		print e.number
        e.customField = false
		throw e
    endtry
end function

sub thirdLevel()
	print "[thirdLevel]"
	throw {message: "subFunc custom error message!", number: 6502, customField: true}
end sub
