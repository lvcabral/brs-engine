sub main()
    print "starting video tests"
    rect = {x: 249, y: 177, w: 391, h: 291}
    port = CreateObject("roMessagePort")
    screen = CreateObject("roScreen", true, 1280, 720)
    screen.setMessagePort(port)
    screen.setAlphaEnable(false)
    syslog = CreateObject("roSystemLog")
    syslog.SetMessagePort(port)
    syslog.enableType("http.connect")
    syslog.enableType("http.error")
    syslog.enableType("http.complete")
    syslog.EnableType("bandwidth.minute")
    player = CreateObject("roVideoPlayer")
    player.setMessagePort(port)
    player.setLoop(true)
    player.setPositionNotificationPeriod(1)
    player.setDestinationRect(rect)
    player.setContentList([{
        Stream: {url: "https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8"}
        StreamFormat: "hls"
    },{
        Stream: {url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}
        StreamFormat: "mp4"
    },{
        Stream: {url: "https://5b44cf20b0388.streamlock.net:8443/vod/smil:hls-maudios-prod.smil/playlist.m3u8"}
        StreamFormat: "hls"
    },{
        Stream: {url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"}
        StreamFormat: "mp4"
    },{
        Stream: {url: "http://devimages.apple.com/iphone/samples/bipbop/bipbopall.m3u8"}
        StreamFormat: "hls"
	}])
    player.Play()
    position = 0
    skip = 15
    tracks = []
    currAudioTrack = 0
    paused = false
    screen.clear(&hFFFFFFFF)
    screen.drawRect(rect.x, rect.y, rect.w, rect.h, 0)
    screen.swapBuffers()
    while true
        msg = wait(0, port)
        if msg <> invalid
            'If this is a startup progress status message, record progress
            'and update the UI accordingly:
            if type(msg) = "roVideoPlayerEvent" and msg.isStatusMessage()
                print msg.GetMessage(), msg.getIndex()
                'Playback progress (in seconds):
            else if type(msg) = "roVideoPlayerEvent" and msg.isPlaybackPosition()
                position = msg.GetIndex()
                print position
            else if type(msg) = "roVideoPlayerEvent" and msg.isStreamStarted()
                tracks = player.getAudioTracks()
                print tracks.count(); " audio tracks available.", tracks[currAudioTrack]
            else if type(msg) = "roVideoPlayerEvent" and msg.isRequestSucceeded()
                print "isRequestSucceeded", msg.getIndex()
            else if type(msg) = "roVideoPlayerEvent" and msg.isListItemSelected()
                print "isListItemSelected", msg.getIndex()
            else if type(msg) = "roSystemLogEvent"
                logEvent = msg.getInfo()
                if logEvent.logType = "bandwidth.minute"
                    print logEvent.logType, logEvent.dateTime.toISOString(), logEvent.bandwidth
                else
                    print "System Log event: "; logEvent
                end if
            else if type(msg) = "roUniversalControlEvent"
                index = msg.GetInt()
                print "Remote button pressed: " + index.tostr()
                if index = 0 '<BACK>
                    exit while
                else if index = 2 '<UP
                    screen.drawRect(0, 0, 1280, 720, 0)
                    player.SetDestinationRect(0, 0, 0, 0) 'fullscreen
                    screen.swapBuffers()
                else if index = 3 'DOWN
                    screen.clear(&hFFFFFFFF)
                    screen.drawRect(rect.x, rect.y, rect.w, rect.h, 0)
                    player.setDestinationRect(rect)
                    screen.swapBuffers()
                else if index = 4 or index = 8 '<LEFT> or <REV>
                    if position > skip
                        position = position - skip
                        player.Seek(position * 1000)
                    end if
                else if index = 5 or index = 9 '<RIGHT> or <FWD>
                    position = position + skip
                    player.Seek(position * 1000)
                else if index = 10 or index = 6 'INFO or OK
                    if tracks.count() > 0
                        currAudioTrack = (currAudioTrack + 1) mod tracks.count()
                        print "Switching to audio track: "; tracks[currAudioTrack].Language
                        player.ChangeAudioTrack(tracks[currAudioTrack].Track)
                    end if
                else if index = 13 '<PAUSE/PLAY>
                    if paused player.Resume() else player.Pause()
                end if
            else if msg.isPaused()
                paused = true
                print "video paused"
            else if msg.isResumed()
                paused = false
                print "video resumed"
            end if
        end if
    end while
end sub
