' Roku OS 16.0: a conditional-compilation name with no #const/bs_const definition
' anywhere now evaluates to `false` instead of raising a compile error.
sub main()
#if mylibrary_enable_detailed_logging
    print "should not print: undefined name treated as true"
#else
    print "undefined name correctly treated as false"
#end if

#if not mylibrary_enable_detailed_logging
    print "not undefined name correctly treated as true"
#end if
end sub
