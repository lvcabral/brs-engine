Function init()
  host = m.top.findNode("host")
  print "host findNode result = "; host.result

  ' A deep-only id is still found (the search does descend into child components)
  inner = host.findNode("innerLabel")
  if inner <> invalid
    print "deep findNode result = "; inner.id
  else
    print "deep findNode result = invalid"
  end if
End Function
