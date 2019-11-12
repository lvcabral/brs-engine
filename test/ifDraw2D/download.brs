Sub Main()
    m.files = CreateObject("roFileSystem")
    screen = CreateObject("roScreen")
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    CacheFile("https://diariodebordo.blog.br/feed/", "feed.xml")
    Print ReadAsciiFile("tmp:/feed.xml")
    CacheFile("https://diariodebordo.blog.br/wp-content/uploads/sites/5/2015/12/IMG_6489-1024x768.jpg", "image.jpg")
    CacheFile("https://raw.githubusercontent.com/lvcabral/brs-emu/master/docs/images/screenshots.png", "image.png")
    CacheFile("https://diariodebordo.blog.br/marcelo/images/star.gif", "image.gif")
    print GetString("https://raw.githubusercontent.com/lvcabral/brs-emu-app/master/.gitignore")
    bmp = CreateObject("roBitmap", "tmp:/image.png")
    CacheFile("https://file-examples.com/wp-content/uploads/2017/11/file_example_MP3_5MG.mp3", "music.mp3")
    audioPlayer = CreateObject("roAudioPlayer")
    port2 = CreateObject("roMessagePort")
    audioPlayer.SetMessagePort(port2)
    song = CreateObject("roAssociativeArray")
    song.url = "tmp:/music.mp3"
    audioplayer.addcontent(song)
    audioplayer.setloop(false)
    audioPlayer.play()
    play = true
    screen.DrawObject(0,0, bmp)
    screen.finish()
    screen.swapbuffers()
    app = CreateObject("roAppManager")
    while true
        key = wait(0, port).getInt()
        if key = 0
            exit while
        else if key = 13
            if play 
                audioPlayer.pause()
                uptime = app.getUpTime()
                print "uptime:"; uptime.TotalSeconds()
            else 
                audioPlayer.resume()
            end if
            play = not play
        else
            print key
        end if
    end while
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

Function GetString(url as string) as string
    http = CreateObject("roUrlTransfer")
    http.SetUrl(url)
    ret = http.GetToString()
    return ret
End Function
