function receiveArgs(arr as object) as string
    return describe(arr[0])
end function

function describe(v as dynamic) as string
    return type(v) + "|" + type(v, 3) + "|" + v
end function
