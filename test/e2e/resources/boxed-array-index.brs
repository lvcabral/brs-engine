sub main()
    x = box(1.9)
    y = ["a", "b", "c"]
    z = {}
    z["a"] = 0
    z["b"] = 1
    z["c"] = 2
    print "the letter is "; y[x]
    print "the number is"; z[box(y[x])]
    print type(x); " "; type(y); " "; type(box(y[x]))
end sub
