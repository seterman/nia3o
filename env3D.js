var Env3D = function() {
    // Add basic scene components.
    // TODO: handle window resizes
    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    var light = new THREE.PointLight(0xffffff);
    light.position.set(-100,200,100);
    scene.add(light);

    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x333333, 1);    
    document.body.appendChild(renderer.domElement);
    $(renderer.domElement).css("position", "absolute").css("top", "0px").css("left", "0px").css("z-index", "-5");
    
    // Camera controls
    var controls = new THREE.TrackballControls(camera, document);
    controls.rotateSpeed = 3;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;

    // Render loop
    var render = function () {
	requestAnimationFrame(render);
	renderer.render(scene, camera);
        controls.update();
    };
    render();

    // Needed to render the Leap hand in the scene with the objects
    var getRenderingComponents = function () {
        return {
            parent: scene,
            camera: camera,
            renderer: renderer,
            renderFn: function() {
                renderer.render(scene, camera);
                controls.update();
            }
        };
    };

    // A wrapper for the objects that will be added by the user
    var objects = new THREE.Object3D();
    scene.add(objects);
  
    // Components for figuring out where the cursor is and how the objects should react
    var raycaster = new THREE.Raycaster();
    var cursorVector = new THREE.Vector3();
    var selectedObject = null;
    var hoverObject = null;

    // Colors used to highlight objects 
    var HOVER_COLOR = 0x0000ff; 
    var SELECT_COLOR = 0xff0000;

    // Highlights an object
    var highlightObject = function(object, color) {
	// Store the original color so it can be reset later
	object.userData.origColor = hoverObject.material.color.getHex();
	object.material.color.set(color);
    };
    
    // Reset the object's color back to its original value.
    var revertHighlight = function(object) {
	object.material.color.set(object.userData.origColor);
    };
    
    // Cast a ray from the camera to the cursor position.
    // The raycaster object can then be used to find intersecting objects.
    var castRay = function(clientX, clientY) {
	cursorVector.x = 2 * (clientX / window.innerWidth) - 1;
	cursorVector.y = 1 - 2 * (clientY / window.innerHeight);
	raycaster.setFromCamera(cursorVector.clone(), camera); 
    };

    // Selects the given object
    var selectObject = function(object) {
	controls.enabled = false; // Don't move the camera while an object is selected
	selectedObject = object;
	if (hoverObject) {
	    revertHighlight(hoverObject); // Make sure origColor is set to actual origColor and not HOVER_COLOR 
	}
	highlightObject(selectedObject, SELECT_COLOR);
    };

    // Selects the first intersecting object, if one exists.
    var selectObjectByIntersection = function(clientX, clientY) {
	castRay(clientX, clientY);
	var intersect = raycaster.intersectObjects(objects.children)[0];
	if (intersect) {
	    selectObject(intersect.object);
	}
    };

    // Updates hoverObject, which is the object the cursor is hovering over.
    // The first intersecting object is taken if there are multiple.
    var updateHoverObject = function(clientX, clientY) {
	castRay(clientX, clientY);
	var intersect = raycaster.intersectObjects(objects.children)[0];
	if (intersect) {
	    hoverObject = intersect.object;
	}
	else {
	    hoverObject = null;
	}
    };

    // Deselect an object
    //TODO: it's a little sketchy that the mouse interface calls this even if there's not a selected object
    var deselectObject = function() {	
	controls.enabled = true;
	if (selectedObject) {
	    revertHighlight(selectedObject); //TODO: can we make selectedObject passed into most functions, instead of stored as a variable?
	    selectedObject = null;	
	}
    };	

    // clientZ is defined on the same axis as the camera's z-axis
    // If using the mouse, default to the working plane that's -DEFAULT_CLIENT_Z units in front of the camera.
    var DEFAULT_CLIENT_Z = -10;

    // Transform the cursor's screen position to a position in the scene
    var screenToScene = function(clientX, clientY, clientZ) {
	if (clientZ == null) {
	    clientZ = DEFAULT_CLIENT_Z;
	}
	if (clientZ > 0) {
	    // A positive clientZ means the user is interacting with things on the wrong side 
	    // of the camera.
	    console.log("WARNING: clientZ is greater than 0.");
	}

	var planeDist = -clientZ;

	// Calculate the camera range for a projection plane that's planeDist away by using 
	// some equilateral triangle geometery.
	var fovRads = camera.fov*3.14159265/180;
	var camHeight = 2*planeDist*Math.tan(fovRads/2);
	var camWidth = camHeight*camera.aspect;
	
	// Compute the cursor's position in camera coordinates
	// TODO: should potentially use width/height of renderer's dom element instead of window
	var xCam = (clientX/window.innerWidth - 1/2)*camWidth;
	var yCam = -(clientY/window.innerHeight - 1/2)*camHeight;
	var coords = new THREE.Vector3(xCam, yCam, -planeDist);

	// Transform the camera coordinates into the scene coordinates
	coords.applyMatrix4(camera.matrixWorld);
	return coords;
    };

    // Moves the selected object according to the cursor's position
    var moveObject = function(clientX, clientY, clientZ) {
	if (selectedObject) {
	    // Calculate the z distance (in cam coords) between the projection plane and the camera
	    // by projecting the object's position vector onto the camera's postion vector and
	    // subtracting the projection from the camera's position vector.
	    var objPosProj = selectedObject.position.clone().projectOnVector(camera.position);
	    var projDist = camera.position.clone().sub(objPosProj).length();

	    if (clientZ == null) {
		clientZ = -projDist;
	    }

	    // Transform the position into scene coordinates
	    var coords = screenToScene(clientX, clientY, clientZ);

	    // Move the object to the resulting position
	    selectedObject.position.x = coords.x;
	    selectedObject.position.y = coords.y;
	    selectedObject.position.z = coords.z;
	    
	}
    };

    // Perform appropriate behavior when the cursor moves
    var cursorMove = function(clientX, clientY, clientZ) {
	// Move an object, if an object is selected
	if (selectedObject) {
	    moveObject(clientX, clientY, clientZ);
	}	
	else{ // Remove/add hover highlights
	    if (hoverObject) { 
		revertHighlight(hoverObject);
	    }
	    updateHoverObject(clientX, clientY);
	    if (hoverObject) {
		highlightObject(hoverObject, HOVER_COLOR);
	    }
	}

    };

    // Add a mass of cubes for testing
    var addCubes = function() {
	for (var x=-10; x<=10; x+=2) {
	    for (var y=-3; y <= 3; y+=2) {
		var geometry = new THREE.BoxGeometry( 1, 1, 1 );
		var material = new THREE.MeshLambertMaterial( { color: 0x00ff00 } );
		material.side = THREE.DoubleSide;
		var cube = new THREE.Mesh( geometry, material );
		cube.position.x = x;
		cube.position.y = y;
		objects.add( cube );
	    }
	}
    };

    // Add an individual cube to the specified screen position
    var addCube = function(clientX, clientY, clientZ) {
	var geometry = new THREE.BoxGeometry(1, 1, 1);
	var material = new THREE.MeshLambertMaterial({color: 0x00ff00});
	material.side = THREE.DoubleSide;
	var cube = new THREE.Mesh(geometry, material);
	var coords = screenToScene(clientX, clientY, clientZ);
	cube.position.x = coords.x;
	cube.position.y = coords.y;
	cube.position.z = coords.z;
	objects.add(cube);
	return cube;
    };

    // Rotates an object based on p1 and p2, which are instances of THREE.Vector3 
    // and represent the before and after positions of the cursor respectively.
    var rotateObject = function(p1, p2) {
	if (selectedObject) { 
	    
	    // Get the object's position and the direction of the camera face
	    var objPos = selectedObject.position.clone();
	    var camZDir = new THREE.Vector3(0, 0, 1).applyMatrix4(camera.matrixWorld);
	    
	    // Transform p1 and p2 into scene coords and project them on the camera's projection plane
	    p1 = objPos.clone().sub(screenToScene(p1.x, p1.y)).projectOnPlane(camZDir);
	    p2 = objPos.clone().sub(screenToScene(p2.x, p2.y)).projectOnPlane(camZDir);
	    
	    // Use a quaternion method to get a rotation from p1 and p2 unit vectors
	    var q = new THREE.Quaternion().setFromUnitVectors(p1.normalize(), p2.normalize());

	    // Convert the quaternion into the same data type as object.rotation
	    var e = new THREE.Euler(0, 0, 0, "XYZ").setFromQuaternion(q);

	    // Add the calculated rotation to the object's current rotation
	    selectedObject.rotation.x += e.x;
	    selectedObject.rotation.y += e.y;
	    selectedObject.rotation.z += e.z;
	}
    };
    


    return {
	getRenderingComponents: getRenderingComponents,
	addCubes: addCubes,
	addCube: addCube,
	setMode: function(state) {
	    // camera control states
	    // 0: rotate, 1: zoom, 2: pan
	    if (state >= 0 & state <= 2) { 
		controls.changeState(state);
	    }
	}, 
	selectObject: selectObject,
	selectObjectByIntersection: selectObjectByIntersection,
	deselectObject: deselectObject,
	rotateObject: rotateObject,
	cursorMove: cursorMove
    };
};
