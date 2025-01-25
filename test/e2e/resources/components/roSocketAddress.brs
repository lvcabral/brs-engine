sub main()
    print "stream socket test"
    socketAddress = CreateObject("roSocketAddress")
    if socketAddress <> invalid
        print "------ no address ------"
        debugObject(socketAddress)
        print "------ invalid IP with valid port ------"
        socketAddress.setAddress("192.168.1.256:8080")
        debugObject(socketAddress)
        print "------ invalid address with valid port ------"
        socketAddress.setAddress("@#$$%:999")
        debugObject(socketAddress)
        print "------ invalid address with invalid port ------"
        socketAddress.setAddress("@#$$%:777:88:bc")
        debugObject(socketAddress)
        print "------ host address no port ------"
        socketAddress.setAddress("roku.com")
        debugObject(socketAddress)
        print "------ host address with port ------"
        socketAddress.setAddress("lvcabral.com:3070")
        debugObject(socketAddress)
        print "------ IP address no port ------"
        socketAddress.setAddress("192.168.1.70")
        debugObject(socketAddress)
        print "------ IP address with port ------"
        socketAddress.setAddress("192.168.1.30:6502")
        debugObject(socketAddress)
        print "------ Set valid port ------"
        socketAddress.setPort(8080)
        debugObject(socketAddress)
        print "------ Set negative port ------"
        socketAddress.setPort(-1)
        debugObject(socketAddress)
        print "------ Set huge port ------"
        socketAddress.setPort(30303030)
        debugObject(socketAddress)
        print "------ Set valid host name ------"
        socketAddress.setHostName("github.com")
        debugObject(socketAddress)
        print "------ Set invalid host name ------"
        socketAddress.setHostName("github.com:8080")
        debugObject(socketAddress)
    end if
end sub

sub debugObject(socketAddress)
    ' print "socket address - getAddress()    --> "; socketAddress.getAddress()
    print "socket address - getHostName()   --> "; socketAddress.getHostName()
    print "socket address - getPort()       --> "; socketAddress.getPort()
    print "socket address - isAddressValid()--> "; socketAddress.isAddressValid()
end sub
