sub main()
    repeat = 10000
    m.drawFpsTarget = 30
    m.screenW = 1280
    m.screenH = 720
    m.maxTestTimeMs = 30000
    fontRegistry = CreateObject("roFontRegistry")
    m.defaultFont = fontRegistry.GetDefaultFont()
    m.smallFontSize = fontRegistry.GetDefaultFontSize() / 3
    m.smallFont = fontRegistry.GetDefaultFont(m.smallFontSize, false, false)
    m.screen = CreateObject("roScreen", true, m.screenW, m.screenH)
    m.screen.setAlphaEnable(true)
    m.functionPerfCount = 50
    m.suite = "RegionCreation"
    runBenchmark("CreateTempBitmap", createTempBitmap, repeat)

end sub

sub createTempBitmap(testCount as integer, testData as object)
    halfW = m.screenW / 2
    halfH = m.screenH / 2
    tempBitmap = CreateObject("roBitmap", {width: halfW, height: halfH, AlphaEnable: true})
    color = getColor()
    tempBitmap.drawRect(10, 10, halfW - 20, halfH - 20, color)

    x1 = rnd(m.screenW)
    y1 = rnd(m.screenH)
    m.screen.drawObject(x1, y1, tempBitmap)
end sub

function getColor(r = 255 as integer, g = 255 as integer, b = 255 as integer, a = 255 as integer) as integer
    red% = rnd(r)
    green% = rnd(g)
    blue% = rnd(b)
    color% = (red% << 24) + (green% << 16) + (blue% << 8) + a
    return color%
end function

sub runBenchmark(benchmarkName, testFunction, repeat, dynamicallyScale = true)
    i = 0
    msPerSwapTarget = cint(1000 / m.drawFpsTarget)
    frameCount = 0
    totalSwapTime = 0
    m.screen.clear(255)
    frameTimer = CreateObject("roTimeSpan")
    totalTimer = CreateObject("roTimeSpan")
    opsPerSwap = 100
    firstFrame = true
    opsSinceSwap = 0
    testData = {}
    timeForFrame = 0
    totalLastFrameTime = 0
    totalTime = 0
    testNotSupported = false
    while (i < repeat and totalTime < m.maxTestTimeMs)
        testResult = testFunction(i, testData)
        if testResult <> invalid and not testResult
            testNotSupported = true
            exit while
        end if

        timeForFrame = frameTimer.totalMilliseconds()
        if timeForFrame > msPerSwapTarget or (dynamicallyScale and not firstFrame and opsSinceSwap >= opsPerSwap)

            frameTimer.mark()
            if opsPerSwap < opsSinceSwap and firstFrame
                opsPerSwap = opsSinceSwap
            end if
            firstFrame = false
            drawTextWithBackground(opsSinceSwap.toStr(), m.screenW - 300, m.screenH - 100, 250)
            drawTextWithBackground(m.suite + ":" + benchmarkName, 50, 50, m.screenW - 100)
            m.screen.swapBuffers()
            m.screen.clear(255)
            frameCount++
            swapTime = frameTimer.totalMilliseconds()
            if dynamicallyScale
                totalLastFrameTime = timeForFrame + swapTime
                opsPerSwap = intScaleIfNeeded(opsPerSwap, totalLastFrameTime, msPerSwapTarget)
            end if
            totalSwapTime += swapTime
            frameTimer.mark()
            opsSinceSwap = 0

            totalTime = totalTimer.totalMilliseconds()
        end if
        i += 1
        opsSinceSwap += 1
    end while
    if opsPerSwap < 0
        opsPerSwap = opsSinceSwap
    end if
    if frameCount = 0
        m.screen.swapBuffers()
        frameCount = 1
    end if
    totalTime = totalTimer.totalMilliseconds()
    m.screen.swapBuffers()
    benchmarkResult = buildBenchmarkResult(benchmarkName, not testNotSupported, totalTime, frameCount, i, totalSwapTime, opsPerSwap)
    ? benchmarkResult
end sub

function max(a, b)
    if a > b
        return a
    end if
    return b
end function

function min(a, b)
    if a < b
        return a
    end if
    return b
end function


function scaleDown(value, factor = 0.9)
    if value <= 1
        return value
    end if
    factor = max(0.9, factor)
    return min(factor * value, value - 1)
end function


function scaleUp(value, factor = 1.1)
    factor = min(1.1, factor)
    return max(factor * value, value + 1)
end function

function intScaleIfNeeded(value, testVal, target, buffer = 0.5)
    if testVal = 0
        value = cint(scaleUp(value))
        return value
    end if
    factor = target / testVal
    lowerBound = target '* (1 - buffer)
    upperBound = target * (1 + buffer)
    if testVal > upperBound
        value = cint(scaleDown(value, factor))
    else if testVal < lowerBound
        value = cint(scaleUp(value, factor))
    end if
    return value
end function

sub drawTextWithBackground(text, x, y, width)
    height = 50
    offset = 5
    m.screen.drawRect(x - offset, y - offset, width + 2 * offset, height, &hFF)
    m.screen.drawText(text, x, y, &hFFFFFFFF, m.defaultFont)
end sub

function buildBenchmarkResult(name as string, didRun = false as boolean, totalTime = -1 as integer, frameCount = -1 as integer, actualOps = -1 as integer, totalSwapTime = -1 as integer, opsPerSwap = -1 as integer)
    actualFrameTime = cint(totalTime / frameCount)
    opsPerFrame = cint(actualOps / frameCount)
    opsPerSecond = cint(actualOps / (totalTime / 1000))
    avgSwapTime = cint(totalSwapTime / frameCount)
    avgOpsToReachTarget = min(opsPerSwap, opsPerFrame)
    result = {
        name: name,
        didRun: didRun,
        totalTime: totalTime
        frameCount: frameCount,
        actualOps: actualOps,
        totalSwapTime: totalSwapTime,
        actualFrameTime: actualFrameTime,
        opsPerFrame: opsPerFrame,
        opsPerSecond: opsPerSecond,
        avgSwapTime: avgSwapTime,
        avgOpsToReachTarget: avgOpsToReachTarget
    }
    return result
end function
