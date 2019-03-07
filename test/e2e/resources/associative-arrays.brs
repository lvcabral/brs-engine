empty = {}
oneDimensional = { isOneDimensional: true }
twoDimensional = {
    "has-second-layer": true,
    level: 1
    secondLayer: {
        level: 2
    }
}

for each key in twoDimensional
    print key
end for

print twoDimensional.secondLayer.level

' add third layer
twoDimensional.secondLayer.thirdLayer = { level: 3 }

print twoDimensional.secondLayer.thirdLayer.level

' modify the top for an as
twoDimensional.secondLayer.level *= 3
print twoDimensional.secondLayer.level
