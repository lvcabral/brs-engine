sub main()
    boxed = createObject("roString")
    boxed.setString("lorem ipsum")
    print "type(boxed) = " type(boxed) " | boxed = " boxed

    unboxed = unboxing(boxed)
    print "type(unboxed) = " type(unboxed) " | unboxed = " unboxed

	' Signed Integer
	color = &HC0C0C0FF
	print color
end sub

sub unboxing(s as string) as string
    print "type(s) = " type(s) " | s = " s
    return s
end sub