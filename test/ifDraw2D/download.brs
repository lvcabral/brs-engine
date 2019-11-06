Sub Main()
    m.files = CreateObject("roFileSystem")
    screen = CreateObject("roScreen")
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    CacheFile("https://raw.githubusercontent.com/lvcabral/brs-emu/master/docs/images/screenshots.png", "image.png")
    bmp = CreateObject("roBitmap", "tmp:/image.png")
    screen.DrawObject(0,0, bmp)
    screen.finish()
    screen.swapbuffers()
    wait(0, port)
End Sub

Function CacheFile(url as string, file as string, overwrite = false as boolean) as string
    tmpFile = "tmp:/" + file
    if overwrite or not m.files.Exists(tmpFile)
        http = CreateObject("roUrlTransfer")
        http.SetUrl(url)
        ret = http.GetToFile(tmpFile)
        if ret = 200
            print "CacheFile: "; url; " to "; tmpFile
        else
            print "File not cached! http return code: "; ret
            tmpFile = ""
        end if
    end if
    return tmpFile
End Function
