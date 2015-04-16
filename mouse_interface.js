// Adds functionality for the mouse
var MouseInterface = function(env) {
    var STATES = { NONE: -1, PLACE_CUBE: 0, PREP_ROTATE_OBJ: 1, ROTATE_OBJ: 2 };
    var state = STATES.NONE;

    var storedPos = new THREE.Vector3(); // Used to keep track of cursor position when needed

    $(document).mousedown(function(e) {
	switch (state) {
	case STATES.NONE: // Select the object
	    env.selectObject(e.clientX, e.clientY);
	    break;
	case STATES.PLACE_CUBE: // Insert a cube
	    env.addCube(e.clientX, e.clientY);
	    state = STATES.NONE;
	    break;
	case STATES.PREP_ROTATE_OBJ: // Start rotating an object
	    env.selectObject(e.clientX, e.clientY);
	    storedPos.x = e.clientX;
	    storedPos.y = e.clientY;
	    storedPos.z = 0;
	    state = STATES.ROTATE_OBJ;
	default:
	    break;
	}
    });
    
    $(document).mousemove(function(e) {
	switch (state) {
	case STATES.NONE: // Do the typical cursor move actions
	    env.cursorMove(e.clientX, e.clientY);
	    break;
	case STATES.ROTATE_OBJ: // Rotate an object
	    var currPos = new THREE.Vector3(e.clientX, e.clientY, 0);
	    env.rotateObject(storedPos.clone(), currPos.clone());
	    storedPos = currPos.clone();
	    break;
	default:
	    env.cursorMove(e.clientX, e.clientY);
	    break;
	}
    });


    $(document).mouseup(function(e) {
	switch (state) {
	case STATES.NONE: // Deselect the object
	    env.deselectObject();
	    break;
	case STATES.ROTATE_OBJ: 
	    // Stop the current rotation and prep for another rotation
	    state = STATES.PREP_ROTATE_OBJ;
	    env.deselectObject();
	    break;
	default:
	    break;
	}
    });

    // Stores the labels and onClick events for each GUI button
    var buttons = {
	Modes: [
	    {label: "Camera Rotate", onClick: function() { env.setMode(0); }},
	    {label: "Camera Zoom", onClick: function() { env.setMode(1); }},
	    {label: "Camera Pan", onClick: function() { env.setMode(2); }},
	    {label: "Rotate Object", onClick: function() { state = STATES.PREP_ROTATE_OBJ; }}
	],

	Actions: [
	    {label: "Add Cubes", onClick: function() { env.addCubes(); }},
	    {label: "Add Cube", onClick: function() { state = STATES.PLACE_CUBE; }}
	]
    };

    // Populates the GUI with the info stored in the buttons object
    for (var key in buttons) {
	var group = buttons[key];
	var elem = document.createElement("div");
	$(elem).append(key);
	for (var i in group) {
	    $(elem).append("</br>");
	    var b = document.createElement("button");
	    $(b).text(group[i].label);
	    $(b).click(group[i].onClick);
	    $(elem).append(b);
	}
	$('body').append(elem);
    }

};
	
