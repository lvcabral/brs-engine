' write bad path
success = WriteAsciiFile("x", "some test contents")
print(success)

' write good path
success = WriteAsciiFile("tmp:///test.txt", "some test contents")
print(success)
