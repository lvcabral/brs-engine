sub main()
    print "in run.brs"
    result = Run("pkg:/test/e2e/resources/stdlib/runme.brs")
    print "returned to run.brs"
    print "runme.brs returned: " result
end sub