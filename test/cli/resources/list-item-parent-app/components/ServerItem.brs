sub init()
    ' A custom list item commonly sizes itself from the parent list's itemSize, read via
    ' getParent() in init(). This only works if the item is already attached to its list when
    ' init() runs (as on a real device) - otherwise getParent() is invalid and the size stays 0.
    m.focusBorder = m.top.findNode("focusBorder")
    parentList = m.top.getParent()
    if parentList <> invalid and parentList.hasField("itemSize")
        itemSize = parentList.itemSize
        if itemSize <> invalid and itemSize.Count() = 2
            m.focusBorder.width = itemSize[0]
            m.focusBorder.height = itemSize[1]
        end if
    end if
    print "ServerItem init: focusBorder ="; m.focusBorder.width; "x"; m.focusBorder.height
end sub
