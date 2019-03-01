sub main()
    hasReservedWords = {
        createObject: true,
        in: true,
        stop: true,
        run: true,
        then: "useful for promises!"
    }

    for each word in hasReservedWords
        print word
    end for

    immediatePromise("foo").then(sub(result)
        print "promise-like resolved to '" + result + "'"
    end sub)
end sub

' A simple promise-like function that immediately resolves to the provided value.
' You probably don't want to use it in production.
' @param {*} val the value this promise-like should immediately resolve to
' @returns {AssociativeArray} an associative array contianing a `then` property, used to chain
'                             promise-like constructs.
function immediatePromise(val as dynamic) as object
    return {
        __result: val
        then: sub(resolved as function)
            resolved(m.__result)
        end sub
    }
end function