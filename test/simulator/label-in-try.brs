sub main()
    ? "start test"
    goto inside
    ? "this should never print 0"
    try
        ? "this should never print 1"
        inside:
        ? "inside the try"
        throw "something"
    catch ex
        'dump ex here
        ? "this should print"
    end try
    ? "done trying"
end sub