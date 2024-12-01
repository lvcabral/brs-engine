Sub Main()
    m.files = CreateObject("roFileSystem")
    screen = CreateObject("roScreen", true, 854, 480)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    files = []
    files.push(CacheFile("https://raw.githubusercontent.com/lvcabral/Prince-of-Persia-Roku/master/assets/titles/intro-screen-mac.png", "image.png"))
    files.push(CacheFile("https://raw.githubusercontent.com/lvcabral/Prince-of-Persia-Roku/refs/heads/master/images/options_menu.jpg", "image.jpg"))
    files.push(CacheFile("https://colinbendell.github.io/webperf/animated-gif-decode/5.webp", "image.webp"))
    files.push(CacheFile("https://brsfiddle.net/images/gif-example-file-500x500.gif", "image.gif"))
    files.push(CacheFile("https://brsfiddle.net/images/bmp-example-file-download-1024x1024.bmp", "image.bmp"))
    fileIdx = 0
    bmp = CreateObject("roBitmap", files[fileIdx])
    screen.DrawObject(0,0, bmp)
    screen.SwapBuffers()
    while true
        key = wait(0, port).getInt()
        if key = 0
            exit while
        else if key = 4
            fileIdx--
            if fileIdx < 0
                fileIdx = files.count() - 1
            end if
        else if key = 5 or key = 6
            fileIdx++
            if fileIdx = files.count()
                fileIdx = 0
            end if
        else
            print key
        end if
        bmp = CreateObject("roBitmap", files[fileIdx])
        screen.DrawObject(0,0, bmp)
        screen.SwapBuffers()
    end while
End Sub

function CacheFile(url as string, file as string, overwrite = false as boolean) as string
    tmpFile = "tmp:/" + file
    if overwrite or not m.files.Exists(tmpFile)
        http = CreateObject("roUrlTransfer")
        http.SetCertificatesFile("common:/certs/ca-bundle.crt")
        if LCase(Right(file, 4)) = "json"
            http.AddHeader("Content-Type", "application/json")
        end if
        http.EnableEncodings(true)
        http.EnablePeerVerification(false)
        http.SetUrl(url)
        ret = http.GetToFile(tmpFile)
        if ret <> 200
            print "File not cached! http return code: "; ret
            tmpFile = ""
        end if
    end if
    return tmpFile
end function
