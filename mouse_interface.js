// Adds functionality for the mouse
var MouseInterface = function(env) {
    var STATES = { NONE: -1, PLACE_PLANE: 0, PLACE_CONE: 1, PREP_ROTATE_OBJ: 2, ROTATE_OBJ: 3, PREP_ROTATE_CAM: 4, ROTATE_CAM: 5, PREP_PAN_CAM: 6, PAN_CAM: 7, PREP_ZOOM_CAM: 8, ZOOM_CAM: 9, CAM_CONTROL: 10 };
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
	    selectedObject = grabObject(pos);
	    if (selectedObject) {
		initPos = pos.clone();
		storedScenePos.x = env.convertToSceneUnits(0, window.innerWidth, e.clientX, "x");
		storedScenePos.y = env.convertToSceneUnits(0, window.innerHeight, e.clientY, "y");
		storedScenePos.z = 0;
		state = STATES.ROTATE_OBJ;
	    }
	    break;
	case STATES.PREP_ROTATE_CAM:
	    initPos = pos.clone();
	    storedScenePos.x = env.convertToSceneUnits(0, window.innerWidth, e.clientX, "x");
	    storedScenePos.y = env.convertToSceneUnits(0, window.innerHeight, e.clientY, "y");
	    storedScenePos.z = 0;
	    state = STATES.ROTATE_CAM;
	    break;
	case STATES.PREP_PAN_CAM:
	    initPos = pos.clone();
	    storedScenePos.x = env.convertToSceneUnits(0, window.innerWidth, e.clientX, "x");
	    storedScenePos.y = env.convertToSceneUnits(0, window.innerHeight, e.clientY, "y");
	    storedScenePos.z = 0;
	    state = STATES.PAN_CAM;
	    break;
	case STATES.PREP_ZOOM_CAM:
	    initPos = pos.clone();
	    storedScenePos.x = env.convertToSceneUnits(0, window.innerWidth, e.clientX, "x");
	    storedScenePos.y = env.convertToSceneUnits(0, window.innerHeight, e.clientY, "y");
	    storedScenePos.z = 0;
	    state = STATES.ZOOM_CAM;
	    break;
	case STATES.CAM_CONTROL:
	    selectedObject = grabObject(pos);
	    if (selectedObject) {
		env.setMode(-1);
		state = STATES.NONE
		initPos = pos.clone();
	    }
	    break;
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
	case STATES.ROTATE_CAM: // Rotate camera //TODO: less copy paste?
	    var currPos = new THREE.Vector3(e.clientX, e.clientY, NULL_CLIENT_Z);
	    var dO = new THREE.Vector3(0, 0, 0);
	    var dP = new THREE.Vector3(0, 0, 0);
	    var radsPerPx = 0.01;
	    dO.x = (e.clientY-storedScreenPos.y)*radsPerPx;
	    dO.y = (e.clientX-storedScreenPos.x)*radsPerPx;
	    env.transformCamera(dO, dP);
	    storedScreenPos = currPos.clone();
	    break;
	case STATES.PAN_CAM:
	    var currPos = new THREE.Vector3(e.clientX, e.clientY, NULL_CLIENT_Z);
	    var dO = new THREE.Vector3(0, 0, 0);
	    var dP = new THREE.Vector3(0, 0, 0);
	    var coordsPerPx = 0.01;
	    dP.x = (-e.clientX+storedScreenPos.x)*coordsPerPx;
	    dP.y = (e.clientY-storedScreenPos.y)*coordsPerPx;
	    env.transformCamera(dO, dP);
	    storedScreenPos = currPos.clone();
	    break;
	case STATES.ZOOM_CAM:
	    var currPos = new THREE.Vector3(e.clientX, e.clientY, NULL_CLIENT_Z);
	    var dO = new THREE.Vector3(0, 0, 0);
	    var dP = new THREE.Vector3(0, 0, 0);
	    var radsPerPx = 0.01;
	    dP.z = (e.clientY-storedScreenPos.y);
	    env.transformCamera(dO, dP);
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
	case STATES.ROTATE_CAM:
	    state = STATES.PREP_ROTATE_CAM;
	    break;
	case STATES.ZOOM_CAM:
	    state = STATES.PREP_ZOOM_CAM;
	    break;
	case STATES.PAN_CAM:
	    state = STATES.PREP_PAN_CAM;
	    break;
	default:
	    break;
	}
    });

    // Stores the labels and onClick events for each GUI button
    var buttons = {
	Modes: [
	    {label: "Camera Rotate", onClick: function() { env.setMode(-1); state = STATES.PREP_ROTATE_CAM; }},
	    {label: "Camera Zoom", onClick: function() { env.setMode(-1); state = STATES.PREP_ZOOM_CAM; }},
	    {label: "Camera Pan", onClick: function() { env.setMode(-1); state = STATES.PREP_PAN_CAM; }},
	    {label: "Rotate Object", onClick: function() { env.setMode(-1); state = STATES.PREP_ROTATE_OBJ; }},
	    {label: "Pan Object", onClick: function() { env.setMode(-1); state = STATES.NONE; }}
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
	
