sub main()
    print ListDir("common:/")
	print WriteAsciiFile("tmp:/main.brs", "function main(arg) : print arg : return type(m) : end function")
	print ListDir("tmp:/")
	print ReadAsciiFile("tmp:/main.brs")
	print Run("tmp:/main.brs", {msg: "hello!"})
end sub