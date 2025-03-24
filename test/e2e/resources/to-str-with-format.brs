sub main()
	floatVar1 = 10000.45
	? "float1 =";floatVar1
	floatVar2 = 10000.4567
	? "float2 =";floatVar2
    floatVar3 = 10000.45678
    doubleObj = CreateObject("roDouble")
    doubleObj.setDouble(floatVar2)
    ? "float3 =";floatVar3
    ? "float3.toStr() = ";floatVar3.toStr()
    ? "0.123 ="; 0.123
    ? "0.123.toStr() = "; (0.123).toStr()
    ? "123.4567 ="; 123.4567
    ? "123.4567.toStr() = "; (123.4567).toStr()
    ? "double =";doubleObj
    ? "double.toStr() = ";doubleObj.toStr()
    ? 40
    ? 40.toStr()
    ? 40.toStr("%05d")
    ? 40.toStr("%o")
    ? 31.toStr("%02x")
    ? 31.toStr("%02X")
    ? 99.toStr("%d red luftballoons")
    ? "this is a long string to be truncated".toStr("%.16s")
    ? "short string".toStr("%32s")
    ? 65.toStr("%c")
    ? 65.toStr("'%c'")
    ? 3.14159.toStr("%f")
    ? 3.14159.toStr("%0.2f")
    ? 3.14159.toStr("%e")
    ? 3.14159.toStr("%010.2f")
    ? 13.toStr()
    ? 13.toStr("%d %5.2f")
    ? 13.toStr("%%%%%%")
    ? 13.toStr("A")
    ? "%d is bigger than %d".Format(32, 16)
    ? "%d is bigger than %s and smaller than %d".Format(32, "12", 64)
    ? "A".format()
    someTests()
    moreTests()
    otherTests()
end sub

sub moreTests()
    big_num = &H100000000&
    ? big_num.ToStr("%d = 0x%0X")
    ? "%07x".Format(&hFACE1)
    ? "%6X".Format(&hFACE1)
    ? "%-6X".Format(&hFACE1); "<"
    ? "%08x".Format(&hFACE1)
    ? "%*X".Format(6, &hFACE1)
    ? "%-*X".Format(6, &hFACE1); "<"
    ? "%0*x".Format(8, &hFACE1)
    'Precision
    ? "%.*f".Format(2, 3.14151)
    try
        ? "%.*f".Format("m", 3.14151)
    catch e
        ? e.message
    end try
end sub

sub someTests()
    print 2.toStr("%e")
    print 2.toStr("%f")
    print 3.141592653589793.toStr("%f")
    print 3.141592653589793.toStr("%e")
    print 3.141592653589793.toStr("%g")
    print 3.141592653589793.toStr("%.0f")
    print 3.141592653589793.toStr("%.0e")
    print 3.141592653589793.toStr("%.0g")
    print 2.2.toStr("%f")
    print (-2.2).toStr("%f")
    print 2.2.toStr("%+f")
    print (-2.2).toStr("%+f")
    print "%f %s".format(-12.34, "xxx")
end sub


sub otherTests()
    obj = CreateObject("roBoolean")
    print obj
    print obj.toStr()
    obj = CreateObject("roDouble")
    print obj
    print obj.toStr()
    print obj.toStr("%.1f")
    obj = CreateObject("roFloat")
    print obj
    print obj.toStr()
    print obj.toStr("%.1f")
    obj = CreateObject("roFunction")
    print obj
    print obj.toStr()
    print main
    print main.toStr()
    obj = CreateObject("roInt")
    print obj
    print obj.toStr()
    print obj.toStr("%.1f")
    obj = CreateObject("roInvalid")
    print obj
    print obj.toStr()
    print invalid.toStr()
    obj = CreateObject("roLongInteger")
    print obj
    print obj.toStr()
    print obj.toStr("%.1f")
    obj = CreateObject("roString")
    obj.setString("test")
    print obj
    print obj.toStr()
    print obj.toStr("%.3s")
end sub