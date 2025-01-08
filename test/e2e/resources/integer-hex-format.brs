sub main()
    ' Test CAFE FOOD
    base& = 3405705229
    print base&.ToStr("%d = 0x%0X")
    base& = &hCAFEF00D
    print base&.ToStr("%d = 0x%0X")
    base& = 150460469257
    print base&.ToStr("%d = 0x%0X")
    ' print base&.ToStr("%d = %c")
    base& = -255
    print base&.ToStr("%d = 0x%0X")
    other% = base&
    print other%.ToStr("%d = 0x%0X")
    ' print other%.ToStr("%d = %c")
    check = &hCAFEF00D&
    print type(check)
    print check.ToStr("%d = 0x%0X")
    check = &hCAFEF00D
    print type(check)
    print check.ToStr("%d = 0x%0X")
    'Test with LongInt type suffix
    big_num = &H100000000&
    print type(big_num)
    print big_num.ToStr("%d = 0x%0X")
    myInt = CreateObject("roInt")
    myInt.setInt(big_num)
    print myInt
    'Test with no suffix
    big_num = &H100000000
    print type(big_num)
    print big_num.ToStr("%d = 0x%0X")
    myInt = CreateObject("roInt")
    myInt.setInt(big_num)
    print myInt
    'Test with LongInt decimal format
    big_num = 4294967296
    print type(big_num)
    print big_num.ToStr()' ("%d = 0x%0X") ' RBI throws an error on double format string
    myInt = CreateObject("roInt")
    myInt.setInt(big_num)
    print myInt
    'Test with LongInt decimal format and suffix
    big_num = 4294967296&
    print type(big_num)
    print big_num.ToStr("%d = 0x%0X")
    myInt = CreateObject("roInt")
    myInt.setInt(big_num)
    print myInt
end sub