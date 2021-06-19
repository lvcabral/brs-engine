Sub Main()
    m.files = CreateObject("roFileSystem")
    screen = CreateObject("roScreen")
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    CacheFile("https://raw.githubusercontent.com/lvcabral/brs-emu/master/docs/images/screenshots.png", "image.png")
    print GetString("https://raw.githubusercontent.com/lvcabral/brs-emu-app/master/.gitignore")
    bmp = CreateObject("roBitmap", "tmp:/image.png")
    CacheFile("https://raw.githubusercontent.com/lvcabral/Prince-of-Persia-Roku/master/assets/songs/main-theme.mp3", "music.mp3")
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
                utime = app.getUpTime()
                print "channel uptime:"; utime.TotalSeconds()
            else 
                audioPlayer.resume()
            end if
            play = not play
        else if key = 4
            print Tr("text to be translated %1").replace("%1", "later")
        else if key = 5
            print "device uptime:";  UpTime(0)
        else if key = 6
            RebootSystem()
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
