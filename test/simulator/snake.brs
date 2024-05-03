sub main()
    resetGame()
    port = createObject("roMessagePort")
    screen = createObject("roScreen", true, m.rect.w, m.rect.h)
    screen.setMessagePort(port)
    colors = [&hFF0000FF, &h00FF00FF, &h0000FFFF, &hFFFF00FF, &hFF00FFFF, &h00FFFFFF, &hFFFFFFFF]
    keys = ["exit", "", "up", "down", "left", "right"]
    clock = createObject("roTimespan")
    clock.mark()
    eatSound = createObject("roAudioResource", "navmulti")
    dieSound = createObject("roAudioResource", "deadend")
    snakeBmp = createObject("roBitmap", {width: m.snake[0].s, height: m.snake[0].s})
    snakeBmp.clear(&h6F1AB1FF)
    foodBmp = createObject("roBitmap", {width: m.food.s, height: m.food.s})
    foodBmp.clear(colors[Rnd(colors.count()-1)])
    while true
        event = port.getMessage()
        if type(event) = "roUniversalControlEvent"
            key = keys[event.getInt()]
            if key = "exit"
                exit while
            else if key <> invalid and key <> ""
                m.move = key
            end if
        else
            ticks = clock.totalMilliseconds()
            if ticks > m.speed
                clock.mark()
                head = {x: m.snake[0].x, y: m.snake[0].y, s: m.snake[0].s}
                moveSnake(head)
                checkBoundaries(head)
                m.snake.unshift(head)
                if checkDeath(head)
                    dieSound.trigger(50)
                    print "Game Over!"
                    resetGame()
                else if checkCollision(head, m.food)
                    eatSound.trigger(50)
                    m.score++
                    print "Score: "; m.score
                    newFood()
                    foodBmp.clear(colors[Rnd(colors.count()-1)])
                    if m.score mod 10 = 0 and m.speed > 30
                        m.speed -= 10
                    end if
                else
                    m.snake.pop()
                end if
                screen.clear(&h000000FF)
                for each part in m.snake
                    screen.drawObject(part.x, part.y, snakeBmp)
                end for
                screen.drawObject(m.food.x, m.food.y, foodBmp)
                screen.swapBuffers()
            end if
        end if
    end while
end sub

sub resetGame()
	m.rect = {w: 854, h: 480}
    m.snake = [{x: m.rect.w / 2, y: m.rect.h / 2, s: 15}]
    m.move = "up"
    m.score = 0
    m.speed = 100
    newFood()
end sub

sub moveSnake(head as object)
    if m.move = "up"
        head.y -= head.s
    else if m.move = "down"
        head.y += head.s
    else if m.move = "left"
        head.x -= head.s
    else if m.move = "right"
        head.x += head.s
    end if
end sub

sub newFood()
    foodSize = 10
    collided = true
    while collided
        m.food = {x: Rnd(m.rect.w - foodSize), y: Rnd(m.rect.h - foodSize), s: foodSize}
        collided = false
        for each bodyPart in m.snake
            if checkCollision(bodyPart, m.food)
                collided = true
                exit for
            end if
        end for
    end while
end sub

sub checkBoundaries(head as object)
    if head.x < 0
        head.x = m.rect.w - head.s
    else if head.x > m.rect.w - head.s
        head.x = 0
    end if
    if head.y < 0
        head.y = m.rect.h - head.s
    else if head.y > m.rect.h - head.s
        head.y = 0
    end if
end sub

function checkDeath(head as object) as boolean
    index = 0
    for each bodyPart in m.snake
        if index > 0 and checkCollision(head, bodyPart)
            return true
        end if
        index++
    end for
    return false
end function

function checkCollision(head as object, obj as object) as boolean
    return head.x < obj.x + obj.s and head.x + head.s > obj.x and head.y < obj.y + obj.s and head.y + head.s > obj.y
end function