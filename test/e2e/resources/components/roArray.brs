sub Main()
    arr = createObject("roArray", 5, true)
    arr.append(["ipsum", "dolor"])
    arr.push("sit")
    arr.unshift("lorem")

    print "array length: " arr.count()          ' => 4
    print "join array items: " arr.join(",")    ' => lorem,ipsum,dolor,sit
    arr.sort("i")
    print "sort array items: " arr.join(",")    ' => dolor,ipsum,lorem,sit
    print "last element: " arr.pop()            ' => sit
    print "first element: " arr.shift()         ' => lorem
    print "can delete elements: " arr.delete(1) ' => true
    arr.clear()
    print "can empty itself: " arr.isEmpty()    ' => true

    animals = ["ant", "bison", "camel", "duck", "elephant"]

    ' slice tests
    print animals.slice(2).join(",")
    ' Expected output: camel,duck,elephant

    print animals.slice(2, 4).join(",")
    ' Expected output: camel,duck

    print animals.slice(1, 5).join(",")
    ' Expected output: bison,camel,duck,elephant

    print animals.slice(-2).join(",")
    ' Expected output: duck,elephant

    print animals.slice(2, -1).join(",")
    ' Expected output: camel,duck

    print animals.slice().join(",")
    ' Expected output: ant,bison,camel,duck,elephant
end sub
