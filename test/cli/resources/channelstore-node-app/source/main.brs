' Exercises every command documented for the ChannelStore node: the order/deltaOrder inputs,
' getUserData's attribute filtering, the channel-credential pair, and the partner-order
' (transactional purchase) pair against the fakeServer mock, plus GetRokuCustomerId through the
' generic request framework (`request`/`requestStatus`), which needs no fakeServer.
'
' As on a device, every command completes asynchronously: its result field is written from the
' message loop, never inside the `command`/`request` write. So each command here is issued through
' runCommand()/runRequest(), which wait on a port for the result field. The `deltaOrder` input is
' the exception — it republishes `order` as part of the write itself.
sub Main()
    print "=== ChannelStore Node Test ==="
    screen = CreateObject("roSGScreen")
    m.screenPort = CreateObject("roMessagePort")
    screen.setMessagePort(m.screenPort)
    m.port = CreateObject("roMessagePort")
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Let the scene's own (observer-driven) sequence finish first.
    for i = 0 to 2
        msg = wait(20, m.screenPort)
    end for
    runMessageLoopDelivery()
    runDeltaOrder()
    runOrderWithChildren()
    runOrderRepublish()
    runUserData()
    runChannelCred()
    runPartnerOrder()
    runFakeServerOff()
    runCustomerId()
    runTaskThread()
    print "=== ChannelStore Node Test Complete ==="
end sub

function newStore(fake as boolean) as object
    store = createObject("roSGNode", "ChannelStore")
    store.fakeServer = fake
    return store
end function

' Issues `command` and waits for the result `field` to be published, returning its value.
function runCommand(store as object, command as string, field as string) as dynamic
    store.observeField(field, m.port)
    store.command = command
    return awaitField(store, field)
end function

' Sends a generic-framework `request` and waits for its `requestStatus`.
function runRequest(store as object, request as object) as dynamic
    store.observeField("requestStatus", m.port)
    store.request = request
    return awaitField(store, "requestStatus")
end function

function awaitField(store as object, field as string) as dynamic
    msg = wait(2000, m.port)
    store.unobserveField(field)
    if type(msg) <> "roSGNodeEvent"
        print "timed out waiting for " + field
        return invalid
    end if
    return msg.getData()
end function

sub printOrder(order as object)
    for i = 0 to order.getChildCount() - 1
        item = order.getChild(i)
        print "  item: " + item.code + " qty=" + item.qty.toStr()
    end for
end sub

sub printOrderStatus(status as object)
    print "orderStatus: " + status.status.toStr() + " " + status.message
    for i = 0 to status.getChildCount() - 1
        purchased = status.getChild(i)
        print "  purchased: " + purchased.code + " " + purchased.total
    end for
end sub

' Lists a result node's own fields, skipping the base Node ones every node carries, so the
' output shows only which account attributes the request actually returned.
function joinKeys(node as object) as string
    baseFields = { change: true, focusable: true, focusedchild: true, id: true }
    result = ""
    for each key in node.keys()
        if baseFields[key] = invalid
            if result <> "" then result = result + ","
            result = result + key
        end if
    end for
    return result
end function

' Outside any observer, a command's result is still pending on the very next statement: it is only
' delivered once this code returns to the message loop (here, the wait() inside awaitField).
sub runMessageLoopDelivery()
    print "-- message-loop delivery --"
    store = newStore(false)
    store.observeField("channelCred", m.port)
    store.command = "getChannelCred"
    print "pending on the next statement: "; (store.channelCred = invalid)
    print "delivered from wait(): "; (awaitField(store, "channelCred") <> invalid)
end sub

' A Task thread runs a command through its own message loop and sees the credential Main stored.
sub runTaskThread()
    print "-- Task thread --"
    task = createObject("roSGNode", "CredTask")
    task.observeField("result", m.port)
    task.control = "run"
    msg = wait(5000, m.port)
    if type(msg) = "roSGNodeEvent"
        print msg.getData()
    else
        print "timed out waiting for the task"
    end if
end sub

' `deltaOrder` builds the order incrementally and republishes it, and a negative quantity
' removes the line item.
sub runDeltaOrder()
    print "-- deltaOrder --"
    store = newStore(true)
    store.deltaOrder = { code: "TCSMS1", qty: 1 }
    store.deltaOrder = { code: "TS1", qty: 2 }
    store.deltaOrder = { code: "TS1", qty: 1 }
    print "order children: " + store.order.getChildCount().toStr()
    printOrder(store.order)
    store.deltaOrder = { code: "TS1", qty: -3 }
    print "after remove: " + store.order.getChildCount().toStr()
    printOrder(store.order)
end sub

' An order carries one child per line item, and `action` on the top node is order metadata.
sub runOrderWithChildren()
    print "-- order children --"
    store = newStore(true)
    order = createObject("roSGNode", "ContentNode")
    order.addFields({ action: "Upgrade" })
    item = createObject("roSGNode", "ContentNode")
    item.addFields({ code: "TS1", qty: 1 })
    order.appendChild(item)
    store.order = order
    printOrderStatus(runCommand(store, "doOrder", "orderStatus"))
end sub

' Republishing the order after a deltaOrder write keeps the app's own node and its order-level
' `action`, and a cart emptied by a negative quantity cannot be ordered.
sub runOrderRepublish()
    print "-- order republish --"
    store = newStore(true)
    order = createObject("roSGNode", "ContentNode")
    order.addFields({ action: "Upgrade" })
    item = createObject("roSGNode", "ContentNode")
    item.addFields({ code: "TS1", qty: 1 })
    order.appendChild(item)
    store.order = order
    store.deltaOrder = { code: "TCSMS1", qty: 1 }
    print "same node: "; store.order.isSameNode(order)
    print "action kept: " + store.order.action
    printOrder(store.order)

    store.deltaOrder = { code: "TS1", qty: -1 }
    store.deltaOrder = { code: "TCSMS1", qty: -1 }
    status = runCommand(store, "doOrder", "orderStatus")
    print "empty cart children: " + store.order.getChildCount().toStr()
    print "empty cart order: " + status.status.toStr() + " " + status.message
    print "empty cart items: " + status.getChildCount().toStr()
end sub

sub runUserData()
    print "-- getUserData (all) --"
    store = newStore(true)
    data = runCommand(store, "getUserData", "userData")
    print "firstName: " + data.firstName
    print "email: " + data.email
    print "street1: " + data.street1
    print "gender: " + data.gender
    print "fields: " + joinKeys(data)

    print "-- getUserData (email,firstname) --"
    store.requestedUserData = "email,firstname"
    print "fields: " + joinKeys(runCommand(store, "getUserData", "userData"))

    print "-- getUserData (signin context) --"
    info = createObject("roSGNode", "ContentNode")
    info.addFields({ context: "signin" })
    store.requestedUserDataInfo = info
    print "fields: " + joinKeys(runCommand(store, "getUserData", "userData"))

    print "-- getUserRegionData --"
    region = runCommand(store, "getUserRegionData", "userRegionData")
    print "region: " + region.state + " " + region.zip + " " + region.country
end sub

sub runChannelCred()
    print "-- getChannelCred (nothing stored) --"
    fresh = newStore(true)
    freshJson = parseJson(runCommand(fresh, "getChannelCred", "channelCred").json)
    print "channel_data present: "; (freshJson.channel_data <> invalid)
    print "pucid present: "; (freshJson.roku_pucid <> invalid)

    print "-- storeChannelCredData --"
    store = newStore(true)
    store.channelCredData = "test app cred data"
    result = runCommand(store, "storeChannelCredData", "storeChannelCredDataStatus")
    print "status: " + result.status.toStr()
    response = parseJson(result.response)
    print "response.status: " + response.status
    print "response.error: " + response.error

    print "-- getChannelCred --"
    cred = runCommand(store, "getChannelCred", "channelCred")
    print "channelID: " + cred.channelID
    print "status: " + cred.status.toStr()
    print "errorCode is empty: "; (cred.errorCode = "")
    json = parseJson(cred.json)
    print "json parses: "; (json <> invalid)
    print "token_type: " + json.token_type
    print "channel_data: " + json.channel_data
    print "pucid present: "; (json.roku_pucid <> invalid and json.roku_pucid <> "")

    ' The credential lives in the Roku cloud, per app: a store created later still sees it.
    print "-- getChannelCred (another store) --"
    other = newStore(false)
    print "channel_data: " + parseJson(runCommand(other, "getChannelCred", "channelCred").json).channel_data
end sub

sub runPartnerOrder()
    print "-- requestPartnerOrder --"
    store = newStore(true)
    request = createObject("roSGNode", "ContentNode")
    request.addFields({ code: "TS1", priceDisplay: "3.99", price: "2.99", title: "Test Movie", couponCode: "SAVE1", contentKey: "sku-1" })
    store.requestPartnerOrder = request
    reqStatus = runCommand(store, "requestPartnerOrder", "requestPartnerOrderStatus")
    print "status: " + reqStatus.status
    print "tax: " + reqStatus.tax
    print "total matches price: "; (reqStatus.total = "2.99")
    print "orderId present: "; (reqStatus.orderId <> "")

    print "-- confirmPartnerOrder --"
    confirm = createObject("roSGNode", "ContentNode")
    confirm.addFields({ orderId: reqStatus.orderId, code: "TS1", price: "2.99", title: "Test Movie" })
    store.confirmPartnerOrder = confirm
    confirmStatus = runCommand(store, "confirmPartnerOrder", "confirmPartnerOrderStatus")
    print "status: " + confirmStatus.status
    print "purchaseId present: "; (confirmStatus.purchaseId <> "")

    ' Confirming without a preceding billing check must fail.
    print "-- confirmPartnerOrder without request --"
    fresh = newStore(true)
    fresh.confirmPartnerOrder = confirm
    failed = runCommand(fresh, "confirmPartnerOrder", "confirmPartnerOrderStatus")
    print "status: " + failed.status
    print "errorCode: " + failed.errorCode
end sub

' Without fakeServer the store-backed commands report their documented failure payload, but the
' credential store still works: it holds the app's own artifact rather than a mocked store
' response, so a production app (which never enables fakeServer) must still be able to use it.
sub runFakeServerOff()
    print "-- fakeServer off --"
    store = newStore(false)
    print "userData invalid: "; (runCommand(store, "getUserData", "userData") = invalid)
    store.channelCredData = "prod token"
    print "storeChannelCredDataStatus.status: " + runCommand(store, "storeChannelCredData", "storeChannelCredDataStatus").status.toStr()
    cred = runCommand(store, "getChannelCred", "channelCred")
    print "channelCred.status: " + cred.status.toStr()
    print "channelCred.channel_data: " + parseJson(cred.json).channel_data
    request = createObject("roSGNode", "ContentNode")
    request.addFields({ code: "TS1", price: "2.99" })
    store.requestPartnerOrder = request
    status = runCommand(store, "requestPartnerOrder", "requestPartnerOrderStatus")
    print "requestPartnerOrderStatus.status: " + status.status
    print "requestPartnerOrderStatus.errorCode: " + status.errorCode
end sub

' GetRokuCustomerId goes through the generic request framework: `request` in, `requestStatus` out,
' echoing the command and context. It works without fakeServer, and is stable across stores. The
' reply shape (always-present context/result, exact command match, requestid) is device-measured.
sub runCustomerId()
    print "-- GetRokuCustomerId --"
    store = newStore(false)
    status = runRequest(store, { command: "GetRokuCustomerId", context: { id: "cid-1" } })
    printRequestStatus(status)
    firstCustomerId = status.result.rokuCustomerId
    other = newStore(true)
    status = runRequest(other, { command: "GetRokuCustomerId" })
    print "stable across stores: "; (status.result.rokuCustomerId = firstCustomerId)
    print "context without one sent: " + status.context.count().toStr()
    print "requestid: " + status.requestid.toStr()
    status = runRequest(other, { command: "getrokucustomerid" })
    print "lowercase command: " + status.status.toStr() + " result keys=" + status.result.count().toStr()
    print "requestid: " + status.requestid.toStr()
    printRequestStatus(runRequest(store, { command: "NoSuchCommand", context: { id: "bad-1" } }))
end sub

sub printRequestStatus(status as object)
    print "requestStatus: " + status.status.toStr() + " " + status.statusMessage + " " + status.command + " " + status.context.id
    if status.status = 1
        id = status.result.rokuCustomerId
        print "rokuCustomerId length: " + len(id).toStr()
        print "rokuCustomerId is hex: "; (CreateObject("roRegex", "^[0-9a-f]{32}$", "").isMatch(id))
    else
        print "result keys: " + status.result.count().toStr()
    end if
end sub
