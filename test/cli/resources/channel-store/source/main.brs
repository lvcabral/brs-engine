sub main()
    port = CreateObject("roMessagePort")
    screen = CreateObject("roScreen", true, 854, 480)
    screen.SetMessagePort(port)
    store = CreateObject("roChannelStore")
    store.fakeServer(true)
    store.setMessagePort(port)
    order = []
    order.push({
        "code": "TCSMS1",
        "qty": 1
    })
    store.setOrder(order)
    store.deltaOrder("TS1", 3)
    order = store.getOrder()
    for each item in order
        print item.code, item.qty
    end for
    print "--  Catalog Items ---"
    store.getCatalog()
    messages = 0
    while true
        msg = wait(100, port)
        if type(msg) = "roChannelStoreEvent"
            if msg.isRequestSucceeded()
                print "Status  - "; msg.getStatusMessage(); " (code: "; msg.getStatus(); ")"
                print "Source Identity Check: "; msg.getSourceIdentity() = store.getIdentity()
            else
                print "Request - Failed: "; msg.isRequestFailed(); " Interrupted: "; msg.isRequestInterrupted()
                print "Status  - "; msg.getStatusMessage(); " (code: "; msg.getStatus(); ")"
            end if
            response = msg.getResponse()
            messages++
            if messages = 1
                for each item in response
                    print item.id;" "; item.code;" "; item.name
                end for
                print "--  Succeeded Order ---"
                print "Order:"; store.doOrder()
            else if messages = 2
                for each item in response
                    print item.code;" "; item.qty;" "; item.total
                end for
                print "--  Failed Order ---"
                store.clearOrder()
                store.doOrder()
            else if messages = 3
                print "--  Purchases ---"
                store.getPurchases()
            else if messages >= 4
                for each item in response
                    print item.purchaseId;" "; item.purchaseDate;" "; item.code;" "; item.qty;" "; item.cost
                end for
                exit while
            end if
        else if type(msg) = "roUniversalControlEvent"
            print "roUniversalControlEvent"
            if msg.getInt() = 0
                exit while
            end if
        else if msg <> invalid
            print msg
        end if
    end while
end sub