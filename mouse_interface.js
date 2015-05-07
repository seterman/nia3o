// Adds functionality for the mouse
var MouseInterface = function(env) {
    var STATES = { NONE: -1, PLACE_PLANE: 0, PLACE_CONE: 1, PREP_ROTATE_OBJ: 2, ROTATE_OBJ: 3, CAM_CONTROL: 4 };
    var state = STATES.NONE;

    // Used to keep track of cursor position when needed
    var storedScenePos = new THREE.Vector3(); 
    var storedScreenPos = new THREE.Vector3();

    var NULL_CLIENT_Z = Infinity;

    var selectedObject;
    var initPos;

    var PI = 3.14159265;

    // TODO: make depth param in calls to converToSceneUnits robust to camera angle

    $(document).mousedown(function(e) {
	var pos = new THREE.Vector3(e.clientX, e.clientY, NULL_CLIENT_Z);
	storedScreenPos = pos.clone();
	if (selectedObject) {
	    storedScenePos.x = env.convertToSceneUnits(0, window.innerWidth, e.clientX, "x", selectedObject.position.z-5);
	    storedScenePos.y = env.convertToSceneUnits(0, window.innerHeight, e.clientY, "y", selectedObject.position.z-5);
	    storedScenePos.z = 0;
	}
	switch (state) {
	case STATES.NONE: // Select the object
	    selectedObject = grabObject(pos);
	    initPos = pos.clone();
	    break;
	case STATES.PLACE_PLANE: // Insert a plane
	    selectedObject = insertObject(0, pos);
	    state = STATES.NONE;
	    break;
	case STATES.PLACE_CONE: // Insert a cone
	    selectedObject = insertObject(1, pos);
	    state = STATES.NONE;
	    break;
	case STATES.PREP_ROTATE_OBJ: // Start rotating an object
	    initPos = pos.clone();
	    selectedObject = grabObject(pos);
	    storedScenePos.x = env.convertToSceneUnits(0, window.innerWidth, e.clientX, "x");
	    storedScenePos.y = env.convertToSceneUnits(0, window.innerHeight, e.clientY, "y");
	    storedScenePos.z = 0;
	    state = STATES.ROTATE_OBJ;
	case STATES.CAM_CONTROL:
	    selectedObject = grabObject(pos);
	    if (selectedObject) {
		state = STATES.NONE
		env.setMode(-1);
		initPos = pos.clone();
	    }
	default:
	    break;
	}
	if (selectedObject) {
	    storedScenePos.x = env.convertToSceneUnits(0, window.innerWidth, e.clientX, "x", selectedObject.position.z-5);
	    storedScenePos.y = env.convertToSceneUnits(0, window.innerHeight, e.clientY, "y", selectedObject.position.z-5);
	    storedScenePos.z = 0;
	}
    });
    
    $(document).mousemove(function(e) {
	switch (state) {
	case STATES.NONE: // Do the typical cursor move actions
	    if (selectedObject) { //TODO: sould have an OBJECT_SELECTED state instead
		var x = env.convertToSceneUnits(0, window.innerWidth, e.clientX, "x", selectedObject.position.z-5);
		var y = env.convertToSceneUnits(0, window.innerHeight, e.clientY, "y", selectedObject.position.z-5);
		var dO = new THREE.Vector3(0, 0, 0);
		var dP = new THREE.Vector3(x, y, 0).sub(storedScenePos);
		storedScenePos = new THREE.Vector3(x, y, 0);
		transformObject(selectedObject, dO, dP, initPos);
	    }
	    break;
	case STATES.ROTATE_OBJ: // Rotate an object
	    var currPos = new THREE.Vector3(e.clientX, e.clientY, NULL_CLIENT_Z);
	    var dP = new THREE.Vector3(0, 0, 0);
	    var dO = new THREE.Vector3(0, 0, 0);
	    var radsPerPx = 0.01;
	    dO.x = (e.clientY-storedScreenPos.y)*radsPerPx;
	    dO.y = (e.clientX-storedScreenPos.x)*radsPerPx;
	    transformObject(selectedObject, dO, dP, initPos);
	    storedScreenPos = currPos.clone();
	    break;
	default:
	    break;
	}
    });


    $(document).mouseup(function(e) {
	switch (state) {
	case STATES.NONE:
	    if (selectedObject) {
		selectedObject = dropObject(selectedObject); //TODO: again, OBJECT_SELECTED state
	    }
	    break;
	case STATES.ROTATE_OBJ: 
	    selectedObject = dropObject(selectedObject);
	    // Stop the current rotation and prep for another rotation
	    state = STATES.PREP_ROTATE_OBJ;
	    break;
	default:
	    break;
	}
    });

    // Stores the labels and onClick events for each GUI button
    var buttons = {
	Modes: [
	    {label: "Camera Rotate", onClick: function() { env.setMode(0); state = STATES.CAM_CONTROL; }},
	    {label: "Camera Zoom", onClick: function() { env.setMode(1); state = STATES.CAM_CONTROL; }},
	    {label: "Camera Pan", onClick: function() { env.setMode(2); state = STATES.CAM_CONTROL; }},
	    {label: "Rotate Object", onClick: function() { state = STATES.PREP_ROTATE_OBJ; }}
	],

	Actions: [
	    {label: "Add Cubes", onClick: function() { env.addCubes(); }},
	    {label: "Add Plane", onClick: function() { state = STATES.PLACE_PLANE; }},
	    {label: "Add Cone", onClick: function() { state = STATES.PLACE_CONE; }}
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
	
