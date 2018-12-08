print WriteAsciiFile("x", "some test contents") ' write bad path
print WriteAsciiFile("tmp:///test.txt", "some test contents") ' write good path
print CopyFile("tmp:///test.txt", "tmp:///test_backup.txt") ' copy good path
print MoveFile("tmp:///test.txt", "tmp:///test1.txt") ' good move
print DeleteFile("tmp:///test1.txt") ' good delete
print CreateDirectory("tmp:///test_dir") ' good create
print DeleteDirectory("tmp:///test_dir/some_no_exist_sub") ' bad delete
print DeleteDirectory("tmp:///test_dir") ' good delete
print FormatDrive("does not matter", "will always fail") ' always fail
print ListDir("tmp:///") 'what's left?
