sub Main()
    ' Create a parent ContentNode
    parent = CreateObject("roSGNode", "ContentNode")
    parent.title = "Parent Node"
    
    ' Create data structure with children
    data = {
        title: "Updated Parent"
        description: "This is the parent"
        children: [
            {
                title: "Child 1"
                description: "First child"
                url: "http://example.com/video1.mp4"
            }
            {
                title: "Child 2"
                description: "Second child"
                url: "http://example.com/video2.mp4"
                children: [
                    {
                        title: "Grandchild 1"
                        description: "Nested child"
                    }
                ]
            }
            {
                title: "Child 3"
                description: "Third child"
            }
        ]
    }
    
    ' Update the parent node with the data
    parent.update(data, true)
    
    ' Verify the parent fields
    print "Parent title: " + parent.title
    print "Parent description: " + parent.description
    print "Parent child count: " + parent.getChildCount().toStr()
    
    ' Verify children
    if parent.getChildCount() > 0 then
        child1 = parent.getChild(0)
        print "Child 1 title: " + child1.title
        print "Child 1 description: " + child1.description
        
        child2 = parent.getChild(1)
        print "Child 2 title: " + child2.title
        print "Child 2 child count: " + child2.getChildCount().toStr()
        
        if child2.getChildCount() > 0 then
            grandchild = child2.getChild(0)
            print "Grandchild title: " + grandchild.title
        end if
        
        child3 = parent.getChild(2)
        print "Child 3 title: " + child3.title
    end if
    
    print "Test completed successfully!"
end sub
