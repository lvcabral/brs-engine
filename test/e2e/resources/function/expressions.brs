a = function()
    print "anonymous function"
end function

a()

(sub()
    print "immediately-invoked function expression (IIFE)"
end sub)()

function acceptsCallback(initial as integer, cb as function)
    print "pre-callback"
    cb(initial * 2)
    print "post-callback"
end function

acceptsCallback(
    7,
    function(modified as integer)
        print "callback:"
        print modified
    end function
)