sub main()
    rs = CreateObject("roRegistrySection", "Emulator")
    opt = rs.read("option1")
    print opt
    print rs.write("option1",opt + ".value")
    print rs.read("option1")
    print rs.write("option2","other")
    print rs.GetKeyList()
    print rs.exists("option1")
    print rs.exists("option2")
    print rs.exists("option3")
    print rs.readMulti(["option1", "option2", "option3"])
end sub