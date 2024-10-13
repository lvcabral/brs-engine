function main()
	a = ["Array A"]
	b = ["Array B"]
	c = ["Array C"]
	a.push(b)
	a.push(c)
	b.push(c)
	'Should print: ["Array A",["Array B",["Array C"]],["Array C"]]
	print formatJson(a)
	'Should fail : BRIGHTSCRIPT: ERROR: FormatJSON: Nested object reference
	c.push(a)
	print formatJson(a)
end function
