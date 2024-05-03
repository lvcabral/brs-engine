sub main()
	' Mixed
	'* example of mixed parameters
	s = "Roku" + " " + "rocks!"
	print "The length of '%s' is %d.".Format(s, s.Len())
	'=> "The length of 'Roku rocks!' is 11."

	' Integer (Decimal)
	'* example of decimal integers
	print "%d * %d = %d".Format(-13, 21, -13 * 21)
	'=> "-13 * 21 = -273"

	'* example of decimal integers with left-side 0-padding
	print "%04d-%02d-%02d".Format(17, 3, 99)
	'=> "0017-03-99"

	' Integer (Hexadecimal)
	'* example of hexadecimal integer with left-side 0-padding
	print "%07x".Format(&hFACE1)
	'=> "00face1"

    ' Next 3 tests fails with Type Mismatch error

	'* example of using a dynamic field width parameter
	'* (left-side blank padding by default)
	print "%*X".Format(6, &hFACE1)
	'=> " FACE1"

	'* example of using a dynamic field width parameter,
	'* left-aligned to put the blank padding on the right
	print "%-*X".Format(6, &hFACE1)
	'=> "FACE1 "

	'* example of using a dynamic field width parameter,
	'* with left-side 0-padding
	print "%0*x".Format(8, &hFACE1)
	'=> "000face1"

	' Floating Point
	'* example of floating point formatting
	pi = 3.1415 : r = 2.5
	print "r=%4.2f => c=%4.2f".Format(r, 2 * pi * r)
	'=> "r=2.50 => c=15.71"

	' String
	'* example plain string formatting
	print "%s, %s".Format("Fields", "Sally")
	'=> "Fields, Sally"

	'* example of string formatting with field widths
	'* first is left-aligned / right-padded, second is left-padded by default
	print "[%-3s:%3s]".Format("A", "B")
	'=> "[A  :  B]"

	' Character
	'* example of character formatting
	print "(%c%c%c)".Format(&h7B, 64, &h7D)
	'=> "({@})"
end sub