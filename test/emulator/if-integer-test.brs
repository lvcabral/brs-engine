sub main()
    a = { bolFalse: false, bolTrue: true, intFalse: 0, intTrue: 1 }
    print a
    print "Positive Test Bool"
    if a.bolFalse then print "True" else print "False"
    if a.bolTrue then print "True" else print "False"
    print "Positive Test Int"
    if a.intFalse then print "True" else print "False"
    if a.intTrue then print "True" else print "False"
    print "Negative Test Bool"
    if not a.bolFalse then print "True" else print "False"
    if not a.bolTrue then print "True" else print "False"
    print "Negative Test Int"
    if not a.intFalse then print "True" else print "False"
    if not a.intTrue then print "True" else print "False"
end sub

' ROKU device output
' <Component: roAssociativeArray> =
' {
'     bolfalse: false
'     boltrue: true
'     intfalse: 0
'     inttrue: 1
' }
' Positive Test Bool
' False
' True
' Positive Test Int
' False
' True
' Negative Test Bool
' True
' False
' Negative Test Int
' True
' True