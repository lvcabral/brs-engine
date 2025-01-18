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
		if type(msg) = "roAudioPlayerEvent"
			print "isStatusMessage: "; msg.isStatusMessage()
			print "getMessage: "; msg.GetMessage()
			print "getIndex: "; msg.getIndex()
			print "getInfo: "; msg.getInfo()
			print "isListItemSelected: "; msg.isListItemSelected()
			print "isPaused: "; msg.isPaused()
			print "isResumed: "; msg.isResumed()
			print "isRequestFailed: "; msg.isRequestFailed()
			print "isRequestSucceeded: "; msg.isRequestSucceeded()
			print "isFullResult: "; msg.isFullResult()
			print "isPartialResult: "; msg.isPartialResult()
			print "isTimedMetadata: "; msg.isTimedMetadata()
 			print FindMemberFunction(msg, "getIndex")
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

function CacheFile(url as string, file = "", overwrite = false) as string
    if file = ""
        dot = Right(url, 5).inStr(".")
        file = "image" + Mid(Right(url, 5), dot)
        print "Downloading "; url; " to "; file
    end if
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

Function GetString(url as string) as string
    m.http.SetUrl(url)
    return m.http.GetToString()
End Function
