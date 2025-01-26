function main()
    messagePort = CreateObject("roMessagePort")
    connections = {}
    buffer = CreateObject("roByteArray")
    buffer[512] = 0
    tcpListen = CreateObject("roStreamSocket")
    tcpListen.setMessagePort(messagePort)
    addr = CreateObject("roSocketAddress")
    addr.setPort(54321)
    tcpListen.setAddress(addr)
    tcpListen.notifyReadable(true)
    tcpListen.listen(4)
    if not tcpListen.eOK()
        print "Error creating listen socket"
        stop
    else
        print "Listening on port 54321"
    end if
    while True
        event = wait(0, messagePort)
        if type(event) = "roSocketEvent"
            changedID = event.getSocketID()
            if changedID = tcpListen.getID() and tcpListen.isReadable()
                ' New
                newConnection = tcpListen.accept()
                if newConnection = Invalid
                    print "accept failed"
                else
                    print "accepted new connection " newConnection.getID()
                    newConnection.notifyReadable(true)
                    newConnection.setMessagePort(messagePort)
                    connections[Stri(newConnection.getID())] = newConnection
                end if
            else
                ' Activity on an open connection
                connection = connections[Stri(changedID)]
                closed = False
                if connection.isReadable()
                    received = connection.receive(buffer, 0, 512)
                    print "received is " received
                    if received > 0
                        print "Echo input: '"; buffer.ToAsciiString(); "'"
                        ' If we are unable to send, just drop data for now.
                        ' You could use notifywritable and buffer data, but that is
                        ' omitted for clarity.
                        connection.send(buffer, 0, received)
                    else if received=0 ' client closed
                        closed = True
                    end if
                end if
                if closed or not connection.eOK()
                    print "closing connection " changedID
                    connection.close()
                    connections.delete(Stri(changedID))
                end if
            end if
        end if
    end while

    print "Main loop exited"
    tcpListen.close()
    for each id in connections
        connections[id].close()
    end for
End Function
