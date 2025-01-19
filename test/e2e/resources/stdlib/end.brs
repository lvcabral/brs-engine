sub main()
    tester()
end sub
sub testEnd() : print "testing end..." : end: print "not printed" : end sub
sub tester() : print "test the test" : testEnd() : print "should not print" : end sub
