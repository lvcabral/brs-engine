sub main()
    list = createObject("roList")
    list.push(createObject("roList"))
    list.push(true)
    list.push("a string")
    list.push(-1)
    list.push(invalid)
    print list
end sub
