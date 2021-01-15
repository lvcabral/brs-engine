sub main()
    a = 5

    print "[pre_try] a = " a
    try
        a = a * 2
        print "[in_try] a = " a
    catch e
        ' currently unimplemented
    end try

    print "[post_try] a = " a
end sub
