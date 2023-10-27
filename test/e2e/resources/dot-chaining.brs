sub main()
    a = [" 1 ", " 2 ", " 3 "]
    b = a.pop().trim().toInt()
    print "removed number '" + b.toStr() + "' from array, remaining " + a.count().toStr()
    m.__result = "bad"
    immediatePromise("foo").then(sub(result)
        print "promise-like resolved to '" + result + "'"
    end sub)
    print "optional chaining " + testOptionalChaining()
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

function testOptionalChaining()
    responseData = {
        data:{
            metricsData:{
                addOnsStepStart : "works"
            }
        }
    }
    result = responseData?.data.metricsData?.addOnsStepStart
    return result
end function
