sub main()
    var1 = 10000.43
    var2 = CreateObject("roDouble")
    var2.setDouble(var1)
    ? "var1 = ";var1
    ? "var2 = ";var2
    ? "var2.toStr() = ";var2.toStr()

    var2.setDouble(1)
    ? "var2.1 = ";var2
    ? "var2.1.toStr() = ";var2.toStr()

    myInt = 11111111
    myLong = CreateObject("roLongInteger")
    myLong.setLongInt(myInt)
    ? myLong.toStr()
    ? myLong.toStr("%10d")
    ? 40
    ? (40).toStr()
    ? (40).toStr("%05d")
    ? (40).toStr("%o")
    ? (31).toStr("%02x")
    ? (31).toStr("%02X") ' Fail
    ? (99).toStr("%d red luftballoons")
    ? "this is a long string to be truncated".toStr("%.16s") ' Fail
    ? "short string".toStr("%32s")
    ? (65).toStr("%c")
    ? (65).toStr("'%c'")
    ? (3.14159).toStr("%f")
    ? (3.14159).toStr("%0.2f")
    ? (3.14159).toStr("%e")
    ? (3.14159).toStr("%010.2f")
    ? (13).toStr("%d %f.")
    ? (13).toStr()
    ? (13).toStr("%%%%%%")
    ? (13).toStr("A")
    ? (13).toStr("%d %d")
    x = CreateObject("roInvalid")
    ? x.toStr()
    ? "%d is bigger than %d".Format(32, 16)
end sub