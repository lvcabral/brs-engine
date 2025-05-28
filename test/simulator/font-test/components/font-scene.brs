function init()
    letters = "abcdefghijklmnopqrstuvwxyz"
	numbers = "0123456789*&$?"

    m.top.setFocus(true)
    x = 40
    y = 40
    for each item in m.top.getChildren(-1, 0)
        if item.subtype() <> "Label"
            continue for
        end if
        item.setField("translation", [x, y])
        item.text = item.text + ": " + letters + " " + UCase(letters) + " " + numbers
        y += 70
    end for
end function
