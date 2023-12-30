sub main()
    text = "abcd1234"
    print text.len(), text.mid(4,4)
    print text.ifStringOps.len(), text.ifStringOps.mid(4,4)
    strText = GetInterface(text, "ifStringOps")
    print type(strText)
    print strText.len()
    objBool = GetInterface(true, "ifBoolean")
    print type(objBool)
    print objBool
end sub