sub main()
    time = createObject("roTimeSpan")
    time.mark()
    print fib(25) ' 13 seconds (1.6 Mac Intel)
	' print fib(27) ' 31 seconds (1.6 Mac Intel)
    ' print fib(30) ' 131 seconds (1.6 Mac Intel)
    seconds = time.totalSeconds()
    print "Time taken: "; seconds; " seconds"
end sub

function fib(n as integer) as integer
    if n < 2
        return n
    end if
    return fib(n-1) + fib(n-2)
end function