sub main()
    a = 5

    print "[pre_try] a = " a
    try
        a = a * 2
        print "[in_try] a = " a
		subFunc(a)
    catch e
        ' currently unimplemented
        print "[in_catch] e = " e
		for each bt in e.backtrace
			print "[backtrace] = " bt
		end for
    end try

    print "[post_try] a = " a
end sub

function subFunc(a)
	throw {message: "subFunc custom error message!", number: -2}
    print "[subFunc] a = " a
    a = a * "" ' force a type error
end function
