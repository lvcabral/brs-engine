sub main()
    var1 = 10000.43
    var2 = CreateObject("roDouble")
    var2.setDouble(var1)
    ? "var1 = ";var1
    ? "var2 = ";var2
    ? "var2.toStr() = ";var2.toStr()
    ? 40
    ? (40).toStr()
    ? (40).toStr("%05d")
    ? (40).toStr("%o")
    ? (31).toStr("%02x")
    ? (31).toStr("%02X")
    ? (99).toStr("%d red luftballoons")
    ? "this is a long string to be truncated".toStr("%.16s")
    ? "short string".toStr("%32s")
    ? (65).toStr("%c")
    ? (65).toStr("'%c'")
    ? (3.14159).toStr("%f")
    ? (3.14159).toStr("%0.2f")
    ? (3.14159).toStr("%e")
    ? (3.14159).toStr("%010.2f")
    ? (13).toStr()
    ? (13).toStr("%d %5.2f")
    ? (13).toStr("%%%%%%")
    ? (13).toStr("A")
    ? "%d is bigger than %d".Format(32, 16)
    ? "%d is bigger than %s".Format(32, "12")
    ? "A".format()
end sub