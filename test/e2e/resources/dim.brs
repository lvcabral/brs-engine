sub main()
    ' initialize foo to some base value
    x = box(3)
    y = box(4)
    dim array[x, y]

    print array.count()
    print array[0].count()
    print array[3].count()

    array[3][4] = "hello"
    print array[3, 4]

    print array[4]
    print array[3][5]
end sub
