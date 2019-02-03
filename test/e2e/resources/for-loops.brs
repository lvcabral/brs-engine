final = 3
' start with a simple count up, and make sure the final value
' doesn't change if `final` does.
for i = 0 to final * 2
    print i

    ' modify the loop counter; it's effectively `step 2`
    i = i + 1
    final = final - 3
next

' i should still exist, and should be (final * 2) + 1
print i

' make sure we can count down with a negative step
for d = 3 to 0 step -1
    print d
end for

' ensure for/to loops can be exited
for e = 0 to 10
    print "for loop exit"
    exit for
end for

' e should still exist, but shouldn't have been incremented
print e

' ensure body is executed when initial=final
for a = 0 to 0
    print "initial = final"
end for