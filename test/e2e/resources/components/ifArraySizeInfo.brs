sub main()
	' Check the capacity of the array types
    ba = CreateObject("roByteArray")
	ba.setResize(4000, false)
	testCapacity(ba)
    ba = CreateObject("roByteArray")
	testCapacity(ba)
	ax = CreateObject("roArray", 4000, false)
	testCapacity(ax)
	ar = []
	ar = CreateObject("roArray",1, true)
	testCapacity(ar)
	' Roku OS 15 new methods
	print ax.reserve(300)
	print ax.capacity()
	print ax.shrinkToFit()
	print ax.capacity()
	print ax.reserve(5000)
	print ax.capacity()
	print ar.reserve(300)
	print ar.capacity()
	print ar.reserve(9000)
	print ar.capacity()
end sub

sub testCapacity(ba as object)
    cap = ba.capacity()
	print type(ba); " -------> isResizable = "; ba.isResizable()
    print "start count: " + ba.count().toStr() + " capacity: " + cap.toStr()
    for x = 0 to 4000
        ba.unshift(x)
        if ba.capacity() <> cap
            print "count: " + ba.count().toStr() + " capacity: " + ba.capacity().toStr() + " diff: " + (ba.capacity() - cap).toStr()
            cap = ba.capacity()
        end if
    end for
    print "end count: " + ba.count().toStr() + " capacity: " + cap.toStr()
end sub