' initialize foo to some base value
dim array[3,4]

' NOTE: Roku's dim implementation creates a resizeable, empty array for the
'   bottom children. Resizeable arrays aren't implemented yet (issue #530), 
'   so when that's added this code should be updated so the final array size
'   matches the index of what it expanded to after assignment
print array.count()
print array[0].count()
print array[3].count()

array[3][4] = "hello"
print array[3][4]

print array[4]
print array[3][5]

