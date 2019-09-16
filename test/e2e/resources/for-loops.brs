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

' make sure positive step works even if not a multiple of the target
steps = 0
for b = 0 to 255 step 2
    steps++
    if b > 255 then exit for
next
'it should result in 128
print steps

' make sure negative step works even if not a multiple of the target
steps = 0
for b = 255 to 3 step -3.9 'steps are always truncated to the integer part
    steps++
    if b < 3 then exit for
next
'it should result in 128
print steps



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

'ensure do not loop if final is lower than initial and step > 0
for a = 0 to -1
    print "this should not be printed"
    exit for
next

'ensure do not loop if final is higher than initial and step < 0
for a = 1.9 to 10.2 step -1.1
    print "this should not be printed"
    exit for
next