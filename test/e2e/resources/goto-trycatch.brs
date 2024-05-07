sub main()
    ? "start tests"
    testInside()
    testOutside()
    ? "test ends here"
end sub

sub testInside()
    goto inside
    try
        ? "this should never print 1"
    catch ex
        ? "this should never print 2"
        inside:
        goto out
    end try
    ? "this should never print 3"
    END
    out:
    ? "test 1"
end sub

sub testOutside()
    try
        goto out
        ? "this should never print 1"
    catch ex
        ? "this should never print 2"
    end try
    ? "this should never print 3"
    END
    out:
    ? "test 2"
end sub