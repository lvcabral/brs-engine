#const foo = true
#const bar = false

sub main()
    ' This should cause a compile error
#if foo and bar
    print "This should not parse"
#end if
end sub
