Sub Main()
    screen = CreateObject("roScreen", true, 854, 480)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    m.files = CreateObject("roFileSystem")
	m.http = CreateObject("roUrlTransfer")
    CacheFile("https://colinbendell.github.io/webperf/animated-gif-decode/5.webp", "image.webp")
    bmp = CreateObject("roBitmap", "tmp:/image.webp")
    screen.DrawObject(0,0, bmp)
    screen.swapbuffers()
    app = CreateObject("roAppManager")
    while true
        msg = wait(0, port)
		if type(msg) = "roAudioPlayerEvent" and msg.isStatusMessage()
			print  msg.GetMessage(), msg.getIndex()
		else if type(msg) = "roUniversalControlEvent"
			key = msg.getInt()
			if key = 0 '<BACK>
				exit while
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
