sub main()
	purple = &h6F1AB1FF
	white = &hFFFFFFFF
	screen = createObject("roScreen")
	screen.clear(purple)
	fonts = createObject("roFontRegistry")
	size = fonts.getDefaultFontSize()
	font = fonts.getDefaultFont(size, false, false)
	screen.drawText("Default Font Regular: " + size.toStr(), 30, 40, white, font)
	font = fonts.getDefaultFont(size, true, false)
	screen.drawText("Default Font Bold: " + size.toStr(), 30, 80, white, font)
	font = fonts.getDefaultFont(size, false, true)
	screen.drawText("Default Font Italic: " + size.toStr(), 30, 120, white, font)
	font = fonts.getDefaultFont(size, true, true)
	screen.drawText("Default Font Bold+Italic: " + size.toStr(), 30, 160, white, font)
	font = fonts.getDefaultFont(size, false, false)
	letters = "abcdefghijklmnopqrstuvwxyz"
	numbers = "0123456789*&$@-+=/()[]{}"
	port = CreateObject("roMessagePort")
	screen.setMessagePort(port)
	screen.drawText(uCase(letters), 30, 260, white, font)
	screen.drawText(letters, 30, 300, white, font)
	screen.drawText(numbers, 30, 340, white, font)
	screen.swapBuffers()
	while true
		event = wait(0, port)
		return
	end while
end sub