mixedCase = "Mixed Case"

print UCase(mixedCase)
print LCase(mixedCase)

print Asc("ぇ")
print Chr(12359) ' UTF-16 decimal for "ぇ"

print Left(mixedCase, 5)
print Right(mixedCase, 4) ' "Case"
print Len(mixedCase) ' 10
print Mid(mixedCase, 4, 2) ' "ed"
print Instr(0, mixedCase, "Case") ' 7
print Instr(6, mixedCase, "e") ' 10
print Str(3.4) ' " 3.4"
print Str(9.7#) ' " 9.7"
print StrI(-3) ' "-3"
print Val("12.34") ' 12.34
print Val("") ' 0
print Val("0xFF") ' 255
print Val("0xAA") ' 170
print Substitute("{0} and {1}", "Mary", "Bob")
print StrToI("252")
print String(4, "ab") ' abababab
print StringI(8, 33)  ' !!!!!!!!
