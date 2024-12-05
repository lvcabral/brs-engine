sub Main()
	thing = invalid
	try
		print thing.property
	catch e
		print "error"; e.number
	end try
	print thing?.property
 	print thing?@field
 	print thing?.functionCall2?()
 	print thing?[0]
 	print thing?[0]?.property
 	print thing?[0]?.functionCall2?()
  	print thing?.functionCall?(thing?[0]?.property, thing?[0]?.functionCall2?())
	print thing.toStr() + " as string"
	di = CreateObject("roDeviceInfo")
	try
		print di.action()
	catch e
		print "error"; e.number
	end try
end sub