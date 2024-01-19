sub main()
  myVar = invalid
  RightInvalid(myVar)
  LeftInvalid(myVar)
end sub

sub RightInvalid(param1 as object)
  if param1 <> invalid
     param1.id = 1
  else
     print "param invalid"
  end if
end sub

sub LeftInvalid(param1 as object)
  if invalid <> param1
     param1.id = 1
  else
     print "param invalid"
  end if
end sub