sub Main()
	thing = invalid
	print thing?.property
 	print thing?@field
 	print thing?.functionCall2?()
 	print thing?[0]
 	print thing?[0]?.property
 	print thing?[0]?.functionCall2?()
  	print thing?.functionCall?(thing?[0]?.property, thing?[0]?.functionCall2?())
	print thing.toStr() + " as string"
end sub