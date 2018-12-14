sub Main()
    arr = createObject("roArray", 5, true)
    arr.append(["ipsum", "dolor"])
    arr.push("sit")
    arr.unshift("lorem")

    print "array length: " arr.count()          ' => 4
    print "last element: " arr.pop()            ' => sit
    print "first element: " arr.shift()         ' => lorem
    print "can delete elements: " arr.delete(1) ' => true

    arr.clear()
    print "can empty itself: " arr.count() = 0  ' => true
end sub
