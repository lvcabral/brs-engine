sub main()
    ba1=CreateObject("roByteArray")
    ba1.FromAsciiString("leasure.")
    print ba1.ToBase64String()="bGVhc3VyZS4="
    ba1.FromAsciiString("coração❤")
    print ba1.toAsciiString()="coração❤"

    ba=CreateObject("roByteArray")
    ba.fromhexstring("00FF1001")
    print ba[0]=0 and ba[1]=255 and ba[2]=16 and ba[3]=1
    print ba.getSignedByte(1)=-1
    print ba.getSignedLong(0)=17891072
    ba.push(1000)
    print ba
    ba.unshift(-30)
    print ba

    ba = CreateObject("roByteArray") 
    ba.FromAsciiString("Hello world!")
    n = ba.GetCrc32()
    print n, "0x" ; StrI(n, 16)
    print "461707669", "0x1b851995"

    ba=CreateObject("roByteArray")
    ba.fromHexString("0#FFD801..FF")
    print ba.toHexString() = "00FFD80100FF"

    ba=CreateObject("roByteArray")
    for x=0 to 4000
        ba.push(x)
    end for

    print ba.WriteFile("tmp:/ByteArrayTestFile")
    print ba.WriteFile("tmp:/ByteArrayTestFileSmall", 33, 10)

    ba2=CreateObject("roByteArray")
    ba2.ReadFile("tmp:/ByteArrayTestFile")
    print ba.Count()=ba2.Count()
    result = true
    for x=0 to 4000
        if ba[x]<>ba2[x]
            result = false
            exit for
        end if
    end for
    print result

    print ba2.ReadFile("tmp:/ByteArrayTestFile", 10, 100)
    print ba2.count()=100
    result = true
    for x=10 to 100
        if ba2[x-10]<>x
            result = false
            exit for
        end if
    end for
    print result
    ? ba1.appendFile("tmp:/ByteArrayTestFileSmall",9,3)
    ba3=CreateObject("roByteArray")
    print ba3.readFile("tmp:/ByteArrayTestFileSmall")
    print ba3.toAsciiString()
    ba3.clear()
    print "can empty itself: " ba3.isEmpty()
end sub
