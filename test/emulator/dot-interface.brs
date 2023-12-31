sub main()
    ' a = {}
    ' a.AddReplace("ifEnum", "text")
    ' print a.ifEnum.isEmpty()
    ' print a.ifEnum
    text = CreateObject("roString")
    text.SetString("abcd1234")
    print text.len(), text.mid(4,4)
    print text.ifStringOps.len(), text.ifStringOps.mid(4,4)
    text.ifString.setString("mlc7070")
    print text.getString()
    ar = [3, 4, 5]
    print type(ar)
    print ar
    print ar.getEntry(2)
    print ar.ifArrayGet.getEntry(1)
    ar.reverse()
    print ar
    strText = GetInterface(text, "ifStringOps")
    print type(strText)
    print strText
    objBool = GetInterface(true, "ifBoolean")
    print type(objBool)
    print objBool
end sub