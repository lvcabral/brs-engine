ba=CreateObject("roByteArray")
ba.FromAsciiString("leasure.")
if ba.ToBase64String()<>"bGVhc3VyZS4=" then stop

ba=CreateObject("roByteArray")
ba.fromhexstring("00FF1001")
if ba[0]<>0 or ba[1]<>255 or ba[2]<>16 or ba[3]<>1 then stop

ba=CreateObject("roByteArray")
for x=0 to 4000
    ba.push(x)
end for

ba.WriteFile("tmp:/ByteArrayTestFile")
ba2=CreateObject("roByteArray")
ba2.ReadFile("tmp:/ByteArrayTestFile")
if ba.Count()<>ba2.Count() then stop
for x=0 to 4000
    if ba[x]<>ba2[x] then stop
end for

ba2.ReadFile("tmp:/ByteArrayTestFile", 10, 100)
if ba2.count()<>100 then stop
for x=10 to 100
    if ba2[x-10]<>x then stop
end for