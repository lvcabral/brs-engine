' BrightScript Hello World
sub main()
	text = "Hello World!"
	purple = &h6F1AB1FF
	white = &hFFFFFFFF
	screen = createObject("roScreen")
	screen.clear(purple)
	font = createObject("roFontRegistry").getDefaultFont()
	w = font.getOneLineWidth(text, screen.getWidth())
	h = font.getOneLineHeight()
	x = cInt((screen.getWidth() - w) / 2)
	y = cInt((screen.getHeight() - h) / 2)
	screen.drawText(text, x, y, white, font)
	print text
	screen.swapBuffers()
	Sleep(3000)
end sub