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
    ba.fromHexString("00FF1001")
    print ba[0] = 0 and ba[1] = 255 and ba[2] = 16 and ba[3] = 1
    print ba.getSignedByte(1) = -1
    print ba.getSignedLong(0) = 17891072

    ba = CreateObject("roByteArray")
    ba.FromAsciiString("Hello world!")
    n = ba.GetCrc32()
    print n
    print "0x" + StrI(n, 16)

    ba = CreateObject("roByteArray")
    ' Invalid pair of chars are ignored and set to 0
    ba.fromHexString("0#FFD801..FF")
    print ba.toHexString()
    print ba.toHexString() = "00FFD80100FF"
    ' Invalid hex (odd number of chars) are ignored and original array is kept
    ba.fromHexString("FFDD001")
    print ba.toHexString()

    ' Check the capacity of the byte array
    ba = CreateObject("roByteArray")
    cap = ba.capacity()
    print "count: " + ba.count().toStr() + " capacity: " + ba.capacity().toStr()
    for x = 0 to 4000
        ba.push(x)
        if ba.capacity() <> cap
            print "count: " + ba.count().toStr() + " capacity: " + ba.capacity().toStr() + " diff: " + (ba.capacity() - cap).toStr()
            cap = ba.capacity()
        end if
    end for

    ' Test the ReadFile, WriteFile and Append methods
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
    print  ba1.appendFile("tmp:/ByteArrayTestFileSmall", 9, 3)
    ba3 = CreateObject("roByteArray")
    ba3.setResize(13, false)
    print ba3.readFile("tmp:/ByteArrayTestFileSmall")
    print ba3.toAsciiString()
    ba3.clear()
    print "can empty itself: " + ba3.isEmpty().toStr() + " capacity: " + ba3.capacity().toStr()

    'Resize Tests
    print "BA count: " + ba.count().toStr() + " capacity: " + ba.capacity().toStr()
    ba.fromHexString("DDDDDDFF")
    print "BA count: " + ba.count().toStr() + " capacity: " + ba.capacity().toStr()
    bar = CreateObject("roByteArray")
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " new"
    bar.fromHexString("DDDDDDFF")
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " fromHexString"
    bar.setResize(5, false)
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " setResize, 5, false"
    bar.setResize(7, false)
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " setResize, 7, false"
    bnw = CreateObject("roByteArray")
    bnw.fromHexString("CC")
    bnw.setResize(1, false)
    print "count: " + bnw.count().toStr() + " capacity: " + bnw.capacity().toStr() + " resizable: " + bnw.isResizable().toStr() + " bnw.setResize, 1, false"
    bnw.fromHexString("DDDDDDFFFF")
    print "count: " + bnw.count().toStr() + " capacity: " + bnw.capacity().toStr() + " resizable: " + bnw.isResizable().toStr() + " bnw.fromHex() 5"
    bnw.setResize(3, true)
    print "count: " + bnw.count().toStr() + " capacity: " + bnw.capacity().toStr() + " resizable: " + bnw.isResizable().toStr() + " bnw.setResize, 3, true"
    bnw.fromHexString("DDDDDDFFFF")
    bnw.Push(1.6)
    bnw.Push(244)
    print "count: " + bnw.count().toStr() + " capacity: " + bnw.capacity().toStr() + " resizable: " + bnw.isResizable().toStr() + " bnw setup"
    bar.append(bnw)
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " append"
    bar.push(0)
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " push"
    bar.push(0)
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " push"
    bar.push(0)
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " push"
    bar.push(0)
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " push"
    bar.unshift(0)
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " unshift"
    bar.append(bnw)
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " append"
    bar.append(bnw)
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " append"
    bar.pop()
    bar.pop()
    bar.pop()
    bar.pop()
    bar.pop()
    print "count: " + bar.count().toStr() + " capacity: " + bar.capacity().toStr() + " resizable: " + bar.isResizable().toStr() + " 5 pop()"
end sub
