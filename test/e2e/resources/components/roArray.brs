sub Main()
    ' resizable array tests
    arr = createObject("roArray", 5, true)
    arr.append(["ipsum", "dolor"])
    arr.push("sit")
    arr.unshift("lorem")

    print "array length: " arr.count()          ' => 4
    print "last element: " arr.pop()            ' => sit
    print "first element: " arr.shift()         ' => lorem
    print "can delete elements: " arr.delete(1) ' => true
    arr.clear()
    print "can empty itself: " arr.isEmpty()    ' => true

    ' fixed size array tests
    animals = ["ant", "bison", "camel", "duck", "elephant"]
    fixSize = createObject("roArray", 5, false)
    fixSize.append(animals)
    print "array length: " fixSize.count() ' => 5
    print "array capacity: " fixSize.capacity() ' => 5
    fixSize.push("fox")
    print "no change after push: " fixSize.count() ' => 5
    fixSize.clear()
    print "can empty itself: " arr.isEmpty()    ' => true
    print "same capacity after clear: " fixSize.capacity() ' => 5

    ' slice tests
    print animals.slice(2).join(",") ' =>  camel,duck,elephant
    print animals.slice(2, 4).join(",") ' =>  camel,duck
    print animals.slice(1, 5).join(",") ' =>  bison,camel,duck,elephant
    print animals.slice(-2).join(",") ' =>  duck,elephant
    print animals.slice(2, -1).join(",")' =>  camel,duck
    print animals.slice().join(",") ' =>  ant,bison,camel,duck,elephant
end sub
