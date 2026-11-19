' Control flow inside a try block is not an error: it must never reach the catch block.
sub Main()
    for i = 1 to 3
        try
            if i = 2 then continue for
            if i = 3 then exit for
            print "for"; i
        catch e
            print "caught: "; e.message
        end try
    end for
    n = 0
    while true
        n = n + 1
        try
            if n = 2 then exit while
        catch e
            print "caught: "; e.message
        end try
    end while
    print "while exited at"; n
    print "returned "; inTry()
    try
        end
    catch e
        print "caught: "; e.message
    end try
    print "unreachable after end"
end sub

function inTry() as string
    try
        return "from try"
    catch e
        return "from catch"
    end try
end function
