sub main()
    key = "176dc7bfc5d5322f8dea29fd557016f0"
    m.iv = generateHexString(32) ' 16 bytes for AES-128
    data = "Hello, World!"
    encrypted = encrypt(key, data)
    print "Encrypted: "; encrypted
    if encrypted = "error encrypting" then return
    decrypted = decrypt(key, encrypted)
    print "Decrypted: "; decrypted
end sub

function encrypt(key, data)
    cipher = CreateObject("roEVPCipher")
    if cipher.setup(true, "aes-128-cbc", key, m.iv, 1) = 0
        ba = CreateObject("roByteArray")
        ba.FromAsciiString(data)
        result = cipher.process(ba)
        return result.ToBase64String()
    end if
    return "error encrypting"
end function


function decrypt(key, data)
    cipher = CreateObject("roEVPCipher")
    cipher.setup(false, "aes-128-cbc", key, m.iv, 1)
    ba = CreateObject("roByteArray")
    ba.FromBase64String(data)
    result = cipher.update(ba)
    result.Append(cipher.final())
    return result.ToAsciiString()
end function

function generateHexString(length)
    hexChars = "0123456789abcdef"
    hexString = ""

    for i = 1 to length
        hexString = hexString + hexChars.Mid(Rnd(length / 2) - 1, 1)
    end for

    return hexString
end function

