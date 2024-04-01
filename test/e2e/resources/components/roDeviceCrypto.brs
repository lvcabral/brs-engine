sub Main()
    ' store plaintext to be encrypted in an roByteArray
    ba = CreateObject("roByteArray")
    ba.FromAsciiString("Hello, World!")

    ' create roDeviceCrypto object and specify a device key
    dc = CreateObject("roDeviceCrypto")
    encType = "channel"

    ' encrypt plaintext using the device key and store the encoded data in an roByteArray
    encrypted = dc.Encrypt(ba, encType)
    print "Encrypted: "; encrypted.toHexString();  " --> "; encrypted.count(); " bytes"
    ' decode the encrypted data and store the decrypted data in an roByteArray
    if encrypted <> invalid then
        decrypted = dc.Decrypt(encrypted, encType)
        print "Decrypted: "; decrypted.toHexString(); " --> "; decrypted.toAsciiString()
    end if
end sub