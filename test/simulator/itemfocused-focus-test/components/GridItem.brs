sub onContentSet()
    content = m.top.itemContent
    if content <> invalid
        m.top.findNode("label").text = content.title
    end if
end sub
