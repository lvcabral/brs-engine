sub main()
    var = 5
    aa = { foo: 3 }
    arr = [13]

    var++
    aa.foo--
    arr[0]++

    print var    ' => 6
    print aa.foo ' => 2
    print arr[0] ' => 14
end sub
