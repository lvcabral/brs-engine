Sub Main()
    screen = CreateObject("roScreen", true, 854, 480)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    m.files = CreateObject("roFileSystem")
	m.http = CreateObject("roUrlTransfer")
    CacheFile("https://raw.githubusercontent.com/lvcabral/Prince-of-Persia-Roku/master/assets/titles/intro-screen-mac.png", "image.png")
    bmp = CreateObject("roBitmap", "tmp:/image.png")
    screen.DrawObject(0,0, bmp)
    screen.swapbuffers()
	print "Manifest File"
    print GetString("https://raw.githubusercontent.com/lvcabral/Prince-of-Persia-Roku/master/manifest")
    CacheFile("https://raw.githubusercontent.com/lvcabral/Prince-of-Persia-Roku/master/assets/songs/main-theme.mp3", "music.mp3")
    audioPlayer = CreateObject("roAudioPlayer")
    audioPlayer.SetMessagePort(port)
    audioplayer.addcontent({ url: "tmp:/music.mp3" })
    audioplayer.setloop(false)
    audioPlayer.play()
    play = true
    app = CreateObject("roAppManager")
    while true
        msg = wait(0, port)
		if type(msg) = "roAudioPlayerEvent" and msg.isStatusMessage()
			print  msg.GetMessage(), msg.getIndex()
		else if type(msg) = "roUniversalControlEvent"
			key = msg.getInt()
			if key = 0 '<BACK>
				exit while
			else if key = 13 '<PLAY/PAUSE>
				if play
					audioPlayer.pause()
					utime = app.getUpTime()
					print "channel uptime:"; utime.TotalSeconds()
				else
					audioPlayer.resume()
				end if
				play = not play
			else if key = 5 '<RIGHT>
				print "device uptime:"; UpTime(0)
			end if
		end if
    end while
End Sub

Function CacheFile(url as string, file as string) as string
    tmpFile = "tmp:/" + file
	m.http.SetUrl(url)
	ret = m.http.GetToFile(tmpFile)
	if ret = 200
		print "CacheFile: "; url; " to "; tmpFile
	else
		print "File not cached! http return code: "; ret
		tmpFile = ""
	end if
    return tmpFile
End Function

Function GetString(url as string) as string
    m.http.SetUrl(url)
    return m.http.GetToString()
End Function
