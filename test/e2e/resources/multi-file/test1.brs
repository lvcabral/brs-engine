sub Main()
    print("function in same file: " + sameFileFunc())
    print("function in different file: " + differentFileFunc())
    print("function with dependency: " + dependentFunc())
    print("result" + testOptionalChaining())
end sub

function sameFileFunc()
    return "from sameFileFunc()"
end function

function dependencyFunc()
    return "from dependencyFunc()"
end function

function testOptionalChaining()
    result = responseData?.data.metricsData?.addOnsStepStart
    responseData = {
        data:{
            metricsData:{
                addOnsStepStart : "print"
            }
        }
    }
    return result
end function
