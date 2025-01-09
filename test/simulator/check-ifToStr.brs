sub main()
	obj = CreateObject("roBoolean")
	print obj
	print obj.toStr()
	print "fail in Roku: Member function not found"' obj.toStr("%s")
	obj = CreateObject("roDouble")
	print obj
	print obj.toStr()
	print obj.toStr("%.1f")
	obj = CreateObject("roFloat")
	print obj
	print obj.toStr()
	print obj.toStr("%.1f")
	obj = CreateObject("roFunction")
	print obj
	print obj.toStr()
	print main
	print main.toStr()
	print "fail in Roku: Member function not found"' obj.toStr("%s")
	obj = CreateObject("roInt")
	print obj
	print obj.toStr()
	print obj.toStr("%.1f")
	obj = CreateObject("roInvalid")
	print obj
	print obj.toStr()
	print "fail in Roku: Dot operator in invalid"' obj.toStr("%s")
	print invalid.toStr()
	obj = CreateObject("roLongInteger")
	print obj
	print obj.toStr()
	print obj.toStr("%.1f")
	obj = CreateObject("roString")
	obj.setString("test")
	print obj
	print obj.toStr()
	print obj.toStr("%.3s")
end sub