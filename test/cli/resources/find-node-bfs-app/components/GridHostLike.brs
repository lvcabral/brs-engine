Function init()
  ' Roku findNode is breadth-first: the depth-1 sibling "RowList" must win over the
  ' depth-2 "rowList" inside the earlier AdRowLike child component.
  found = m.top.findNode("rowList")
  if found <> invalid
    m.top.result = found.id + ":" + found.subtype()
  else
    m.top.result = "invalid"
  end if
End Function
