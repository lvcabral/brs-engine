sub main()

    empty = []
	oneDimensional = ["foo", 1, false, invalid]
	twoDimensional = [
		[ 1, 1, 1 ],  ' n^0
		[ 1, 2, 3 ],  ' n^1
		[ 1, 4, 9 ],  ' n^2
		[ 1, 8, 27 ], ' n^3
	]

	for each square in twoDimensional[2]
		print square
	end for

	print twoDimensional[3][2]

	' add n^4
	twoDimensional[4] = [ 1, 16, 81 ]

	print twoDimensional[4].[1]

	' modify oneDimensional[0]
	oneDimensional[0] += " bar"
	print oneDimensional[0]

	' three dimensional array
	a = [[1,2,["a","b","c"]], [4,5,["d","e","f"]], [7,8,["g","h","i"]]]
	print a[1][2][2]'==> f
	print a[1,2][2] '==> f
	print a[1][2,2] '==> f
	print a[1,2,2]  '==> f
	print a[1,2,3]  '==> invalid

	'Assign with multi-index
	a[2, 1] = true
	print a[2, 1]
end sub
