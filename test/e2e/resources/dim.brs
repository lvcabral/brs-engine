sub main()
    ' initialize foo to some base value
    dim array[3, 4]

    print array.count()
    print array[0].count()
    print array[3].count()

    array[3][4] = "hello"
    print array[3, 4]

    print array[4]
    print array[3][5]
    rokuExample()
end sub
