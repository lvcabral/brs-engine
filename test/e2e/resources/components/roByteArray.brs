'roByteArray test
sub main()
    ba1 = CreateObject("roByteArray")
    ba1.FromAsciiString("leasure.")
    print ba1.ToBase64String() = "bGVhc3VyZS4="
    ba1.FromAsciiString("coração❤")
    print ba1.toAsciiString() = "coração❤"

    ba = CreateObject("roByteArray")
    print ba.getSignedByte(1) = 0
    print ba.getSignedLong(0) = 0
    ba.fromhexstring("00FF1001")
    print ba[0] = 0 and ba[1] = 255 and ba[2] = 16 and ba[3] = 1
    print ba.getSignedByte(1) = -1
    print ba.getSignedLong(0) = 17891072
    ba.push(1000)
    print ba
    ba.unshift(-30)
    print ba

    ba = CreateObject("roByteArray")
    ba.FromAsciiString("Hello world!")
    n = ba.GetCrc32()
    print n, "0x" ; StrI(n, 16)
    print " 461707669", "0x1b851995"

    ba = CreateObject("roByteArray")
    ba.fromHexString("0#FFD801..FF")
    print ba
    print ba.toHexString()
    print "00FFD80100FF"
    print ba.toHexString() = "00FFD80100FF"
    ba.fromHexString("FFDD001")
    print ba
    print ba.toHexString()

    ba = CreateObject("roByteArray")
    cap = ba.capacity()
    print "count:"; ba.count(); " capacity:"; ba.capacity()
    for x = 0 to 4000
        ba.push(x)
        if ba.capacity() <> cap
            print "count:"; ba.count(); " capacity:"; ba.capacity(); " diff: "; ba.capacity() - cap
            cap = ba.capacity()
        end if
    end for

    print ba.WriteFile("tmp:/ByteArrayTestFile")
    print ba.WriteFile("tmp:/ByteArrayTestFileSmall", 33, 10)

    ba2 = CreateObject("roByteArray")
    ba2.ReadFile("tmp:/ByteArrayTestFile")
    print ba.Count() = ba2.Count()
    result = true
    for x = 0 to 4000
        if ba[x] <> ba2[x]
            result = false
            exit for
        end if
    end for
    print result

    print ba2.ReadFile("tmp:/ByteArrayTestFile", 10, 100)
    print ba2.count() = 100
    result = true
    for x = 10 to 100
        if ba2[x - 10] <> x
            result = false
            exit for
        end if
    end for
    print result
    ? ba1.appendFile("tmp:/ByteArrayTestFileSmall", 9, 3)
    ba3 = CreateObject("roByteArray")
    ba3.setResize(13, false)
    print ba3.readFile("tmp:/ByteArrayTestFileSmall")
    print ba3.toAsciiString(), ba3.count()
    ba3.clear()
    print "can empty itself: " ba3.isEmpty(), ba3.capacity()
    'Resize Tests
    print "With Resize"
    print "BA count:"; ba.count(); " capacity:"; ba.capacity()
    ba.fromHexString("DDDDDDFF")
    print "BA count:"; ba.count(); " capacity:"; ba.capacity()
    bar = CreateObject("roByteArray")
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "new"
    bar.fromHexString("DDDDDDFF")
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "fromHexString"
    bar.setResize(5, false)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "setResize, 5, false"
    bar.setResize(7, false)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "setResize, 7, false"
    bnw = CreateObject("roByteArray")
    bnw.fromHexString("CC")
    bnw.setResize(1, false)
    print "count:"; bnw.count(); " capacity:"; bnw.capacity(); " resizable: " bnw.isResizable(), "bnw.setResize, 1, false"
    bnw.fromHexString("DDDDDDFFFF")
    print "count:"; bnw.count(); " capacity:"; bnw.capacity(); " resizable: " bnw.isResizable(), "bnw.fromHex() 5"
    bnw.setResize(3, true)
    print "count:"; bnw.count(); " capacity:"; bnw.capacity(); " resizable: " bnw.isResizable(), "bnw.setResize, 3, true"
    bnw.fromHexString("DDDDDDFFFF")
    bnw.Push(invalid)
    bnw.Push(1.6)
    bnw.Push(244)
    print bnw
    print "count:"; bnw.count(); " capacity:"; bnw.capacity(); " resizable: " bnw.isResizable(), "bnw setup"
    bar.append(bnw)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "append"
    bar.push(0)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "push"
    bar.push(0)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "push"
    bar.push(0)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "push"
    bar.push(0)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "push"
    bar.unshift(0)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "unshift"
    bar.unshift(0)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "unshift"
    bar.append(bnw)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "append"
    bar.append(bnw)
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "append"
    bar.pop()
    bar.pop()
    bar.pop()
    bar.pop()
    bar.pop()
    print "count:"; bar.count(); " capacity:"; bar.capacity(); " resizable: " bar.isResizable(), "5 pop()"
    print bar.isLittleEndianCPU()
    print "Test finished with Success!"
end sub
