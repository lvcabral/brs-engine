sub main()
    a = [" 1 ", " 2 ", " 3 ", " 4 ", " 5 ", " 6 ", " 7 "]
    b = a.pop().trim().toInt()
    print "removed number '" + b.toStr() + "' from array, remaining " + a.count().toStr()
    c = (a.pop()).trim().toInt()
    print "removed number '" + c.toStr() + "' from array, remaining " + a.count().toStr()
    m.__result = "fail"
    immediatePromise("success").then(sub(result)
        print "promise-like resolved to '" + result + "'"
    end sub)
    print "optional chaining " + testOptionalChaining()
    m.name = "root"
    level1 = {name: "level1", param: "param test result was: "}
    level1.run = sub()
        print createLevel2().testResult(m.param)
        print createLevel2().testResult("literal test result was: ")
    end sub
    level1.run()
end sub

function createLevel2()
    instance = __level2_builder()
    instance.new()
    return instance
end function

function __level2_builder()
    instance = {name: "level2"}
    instance.new = sub()
        m.name = "newName"
    end sub
    instance.testResult = function(param) as string
         if m.name = "newName"
            result = "success"
        else
            result = "fail"
        end if
        return param + result
    end function
    return instance
end function

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
