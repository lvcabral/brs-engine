#const ipsum = true
' dolor simply aliases lorem
#const dolor = lorem

sub main()
#if lorem
    doStuff()
#else if ipsum
    doStuff(10)
#else if dolor
    doStuff()
#else
    #error neither lorem nor ipsum are enabled!
#end if
end sub

#if lorem
sub doStuff()
    print "I'm lorem!"
end sub
#end if

#if ipsum
sub doStuff(param)
    print "I'm ipsum!"
end sub
#end if
