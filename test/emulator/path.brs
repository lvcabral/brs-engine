Sub Main()
    path = CreateObject("roPath", "pkg:/assets/anims/prince.json")
    print path
    print path.split()
    print path.Change(".dsds..sd[]sdsd3323+++")
    print path
    print path.split()
    print path.Change("*")
    print path
    print path.split()
    print path.Change("pkg:/images/splash_hd.png")
    print path.split()
    print type(path)
    print "final path=" + path
End Sub
