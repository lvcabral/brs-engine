#const feature_enabled = false
#const debug_mode = true

sub main()
#if not feature_enabled
    print "Feature is disabled"
#else
    print "Feature is enabled"
#end if

#if not debug_mode
    print "Production mode"
#else if debug_mode
    print "Debug mode active"
#end if

#if not false
    print "not false evaluates to true"
#end if

#if not true
    print "This should not print"
#else
    print "not true evaluates to false"
#end if
end sub
