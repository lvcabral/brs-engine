sub main()
    hmac = CreateObject("roHMAC")
    signature_key = CreateObject("roByteArray")
    signature_key.fromAsciiString(getKey())
    if hmac.setup("sha1", signature_key) = 0
        message = CreateObject("roByteArray")
        message.fromAsciiString(getMessage())
        result = hmac.process(message)
        print result.toBase64String()
    end if

    if hmac.reinit() = 0
        message1 = CreateObject("roByteArray")
        message1.fromAsciiString(getMessage1())
        hmac.update(message1)
        message2 = CreateObject("roByteArray")
        message2.fromAsciiString(getMessage2())
        hmac.update(message2)
        result = hmac.final()
        print result.toBase64String()
    end if
    'Expected result is: bUECzeqlDqGOejOHnO/9W6bttN8=
end sub

function getKey() as string
    return "176dc7bfc5d5322f8dea29fd557016f0"
end function

function getMessage() as string
    return "The quick brown fox jumps over the lazy dog"
end function

function getMessage1() as string
    return "The quick brown fox jumps"
end function

function getMessage2() as string
    return " over the lazy dog"
end function