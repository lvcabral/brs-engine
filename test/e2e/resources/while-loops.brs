foo = 0

' count to five
while foo < 5
    print foo
    foo = foo + 1
end while

' count down to zero
while foo > 0
    print foo
    foo = foo - 1
    ' but stop at three
    if foo = 3 then exit while
end while

' nested while loops to compute 4 * 2
total = 0
i = 0
while i < 5
    j = 0

    while j < 3
        total++
        j++
    end while
    i++
end while
print total