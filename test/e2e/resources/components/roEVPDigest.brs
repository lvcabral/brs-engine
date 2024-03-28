sub main()
    print "roEVPDigest tests"
    print "-----------------"
    print "Test Process method"
    print "Hashed password using md5: "; hashThePassword("password", "md5")
    print "Hashed password using sha1: "; hashThePassword("password", "sha1")
    print "Hashed password using sha256: "; hashThePassword("password", "sha256")
    print "Hashed password using sha512: "; hashThePassword("password", "sha512")
    print "Hashed password no setup: "; hashThePassword("password")
    print "Hashed password invalid algorithm:"; hashThePassword("password", "xxx")
    print "Test Process method with reusing digest"
    hashReusingDigest("abc", "def")
    print "Test Update and Final methods"
    hashUpdateFinal("password", "sha1")
    hashUpdateFinal("abc")
end sub

function hashThePassword(password, algorithm = "") as String
    ba = CreateObject("roByteArray")
    passWithSalt = password + "THESALT"
    ba.FromAsciiString(passWithSalt)
    digest = CreateObject("roEVPDigest")
    if algorithm <> ""
        digest.Setup(algorithm)
    end if
    result = digest.Process(ba)
    return result
end function

sub hashReusingDigest(text1, text2)
    digest = CreateObject("roEVPDigest")
    digest.Setup("sha256")
    ba1 = CreateObject("roByteArray")
    ba1.FromAsciiString(text1)
    print digest.Process(ba1)
    ba2 = CreateObject("roByteArray")
    ba2.FromAsciiString(text2)
    print digest.Process(ba2)
end sub

sub hashUpdateFinal(text, algorithm = "")
    digest = CreateObject("roEVPDigest")
    if algorithm <> ""
        digest.Setup(algorithm)
    end if
    ba = CreateObject("roByteArray")
    ba.FromAsciiString(text)
    digest.Update(ba)
    ba.FromAsciiString("THESALT")
    digest.Update(ba)
    print digest.Final()
end sub