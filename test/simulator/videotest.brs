sub main()
    print "starting video test"
	rect = { x: 249, y: 177, w: 391, h: 291 }
    port = CreateObject("roMessagePort")
    screen = CreateObject("roScreen", true, 1280, 720)
	screen.setMessagePort(port)
    screen.setAlphaEnable(false)
	player = CreateObject("roVideoPlayer")
    player.setMessagePort(port)
    player.setLoop(true)
    player.setPositionNotificationPeriod(1)
    player.setDestinationRect(rect)
    player.setContentList([{
        Stream: {url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}
        StreamFormat: "mp4"
    }])
    player.Play()
	position = 0
	paused = false
	muted = false
	screen.clear(&hFFFFFFFF)
    screen.drawRect(rect.x, rect.y, rect.w, rect.h, 1)
    screen.swapBuffers()
    while true
        msg = wait(0, port)
        if msg <> invalid
            if type(msg) = "roVideoPlayerEvent" and msg.isStatusMessage()
                print  msg.GetMessage(), msg.getIndex()
            else if type(msg) = "roVideoPlayerEvent" and msg.isPlaybackPosition()
				position = msg.GetIndex()
                print position
            else if type(msg) = "roUniversalControlEvent"
                index = msg.GetInt()
                print "Remote button pressed: " + index.tostr()
                if index = 0  '<BACK>
                    exit while
				else if index = 2 '<UP
					screen.drawRect(0, 0, screen.getWidth(), screen.getHeight(), 0)
    				screen.swapBuffers()
					player.SetDestinationRect(0, 0, 0, 0) 'fullscreen
				else if index = 3 'DOWN
					screen.clear(&hFFFFFFFF)
					screen.drawRect(rect.x, rect.y, rect.w, rect.h, 0)
    				screen.swapBuffers()
    				player.setDestinationRect(rect)
                else if index = 4 or index = 8  '<LEFT> or <REV>
					position = position - 60
					player.Seek(position * 1000)
                else if index = 5 or index = 9  '<RIGHT> or <FWD>
                    position = position + 60
                    player.Seek(position * 1000)
				else if index = 10 '<INFO>
					player.SetEnableAudio(muted)
					muted = not muted
                else if index = 13  '<PAUSE/PLAY>
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
