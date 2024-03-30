sub main()
    strPath = "pkg:/source/appMain.brs"
    myPath = CreateObject("roPath", strPath)
    printPath(myPath)
    ' Concatenation
    prefixPath = "prefix:"
    prefixPath += myPath
    print prefixPath
    print mypath + ":suffix"
    ' Cross-comparison with String
    strPathG = "pkg:/source/appMain.brs1"
    strPathL = "pkg:/source/appMain.br"
    print myPath < strPathG
    print myPath > strPathL
    print myPath <= strPathL
    print myPath >= strPathG
    ' Windows Path
    strPath = "c:\windows\system32\calc.exe"
    myPath.setString(strPath)
    printPath(myPath)
    ' URL Path
    strPath = "http://www.google.com/baby.zip"
    myPath.setString(strPath)
    printPath(myPath)
    ' URL Path (no file) - Using change()
    strPath = "http://www.google.com/"
    print myPath.change(strPath)
    printPath(myPath)
    ' Invalid Path - Using change()
    print myPath.change("&***#&$&$(%(%))")
    printPath(myPath)
    ' Using =+ operator
    myPath += "appMain.brs"
    print type(myPath)
end sub

sub printPath(path)
    aa = path.split()
    print aa.basename
    print aa.extension
    print aa.filename
    print aa.parent
    print aa.phy
end sub