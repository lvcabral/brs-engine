sub main()
    strPath = "pkg:/source/appMain.brs"
    strPathG = "pkg:/source/appMain.brs1"
    strPathL = "pkg:/source/appMain.br"
    myPath = CreateObject("roPath", strPath)
    print myPath.split()
    x = "mypath = "
    x += myPath
    print x
    y = mypath + " suffix"
    print y
    print strPath = myPath.getString()
    print myPath < strPathG
    print myPath > strPathL
    print myPath <= strPathL
    print myPath >= strPathG
    myPath.setString("c:\windows\system32\calc.exe")
    print "new path = " ; myPath.split()
    myPath.setString("http://www.google.com/baby.zip")
    print "new path = " ; myPath.split()
    myPath.change("http://www.google.com/")
    print "changed path = " ; myPath.split()
    print strPath = myPath
    print myPath = strPath
    print myPath < strPath
    print myPath > strPath
    print "change to invalid: "; myPath.change("&***#&$&$(%(%))")
    print myPath.split()
    myPath += "appMain.brs"
    print myPath
    print type(myPath)
end sub
