sub Main()
    m.files = CreateObject("roFileSystem")
    port = CreateObject("roMessagePort")
    di = CreateObject("roDeviceInfo")
    di.enableLowGeneralMemoryEvent(true)
    di.SetMessagePort(port)
	mem = CreateObject("roAppMemoryMonitor")
	mem.SetMessagePort(port)
	mem.enableMemoryWarningEvent(true)
    m.screens = []
    m.screens.push(CreateObject("roScreen", true, 854, 480))
    m.screen = m.screens[0]
    m.screen.SetMessagePort(port)
    files = []
    files.push("https://raw.githubusercontent.com/lvcabral/Prince-of-Persia-Roku/master/assets/titles/intro-screen-mac.png")
    files.push("https://raw.githubusercontent.com/lvcabral/Prince-of-Persia-Roku/refs/heads/master/images/options_menu.jpg")
    files.push("https://colinbendell.github.io/webperf/animated-gif-decode/5.webp")
    files.push("https://brsfiddle.net/images/gif-example-file-500x500.gif")
    files.push("https://brsfiddle.net/images/bmp-example-file-download-1024x1024.bmp")
    fileIdx = 0
    bmp = CreateObject("roBitmap", CacheFile(files[fileIdx], "image.png"))
    m.screen.DrawObject(0, 0, bmp)
    m.screen.SwapBuffers()
	memEater = [bmp.getByteArray(0,0,bmp.getWidth(), bmp.getHeight())]
	print "Memory:"; mem.getMemoryLimitPercent(); "% "; di.getGeneralMemoryLevel()
	memLevel = di.getGeneralMemoryLevel()
    memPct = mem.getMemoryLimitPercent()
    while true
        msg = wait(100, port)
        if type(msg) = "roUniversalControlEvent"
            key = msg.getInt()
            if key = 0
                exit while
            else if key = 4
                fileIdx--
                if fileIdx < 0
                    fileIdx = files.count() - 1
                end if
                showImage(files[fileIdx])
            else if key = 5 or key = 6
                fileIdx++
                if fileIdx = files.count()
                    fileIdx = 0
                end if
                showImage(files[fileIdx])
            else if key = 10
                print "SetCaptionsMode successful: "; di.setCaptionsMode("On")
            else
                print key
            end if
            print FindMemberFunction(msg, "getChar")
            print FindMemberFunction(msg, "getInt")
        else if type(msg) = "roDeviceInfoEvent"
            print "isCaptionModeChanged = "; msg.isCaptionModeChanged()
            print "isStatusMessage = "; msg.isStatusMessage()
            print msg.getInfo()
            print FindMemberFunction(msg, "getInfo")
		else if type(msg) = "roAppMemoryNotificationEvent"
			print msg.getInfo()
			print FindMemberFunction(msg, "getInfo")
        else if msg <> invalid
            print msg
        end if
		memEater.push(bmp.getByteArray(0,0,bmp.getWidth(), bmp.getHeight()))
		if memLevel <> di.getGeneralMemoryLevel() or mem.getMemoryLimitPercent() <> memPct
			print "Memory:"; mem.getMemoryLimitPercent(); "% "; di.getGeneralMemoryLevel()
			memLevel = di.getGeneralMemoryLevel()
            memPct = mem.getMemoryLimitPercent()
		end if
    end while
end sub

function showImage(url)
    bmp = CreateObject("roBitmap", CacheFile(url))
    m.screen.DrawObject(0, 0, bmp)
    m.screen.SwapBuffers()
end function

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
