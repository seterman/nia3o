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

    controls.enabled = false; 

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
//	object.userData.origColor = object.material.color.getHex();
//	object.material.color.set(color);
    };
    
    // Reset the object's color back to its original value.
    var revertHighlight = function(object) {
//	object.material.color.set(object.userData.origColor);
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

    //TODO: need to take z into account
    var getObjectByIntersection = function(pos) {
	castRay(pos.x, pos.y);
	var intersect = raycaster.intersectObjects(objects.children)[0];
	if (intersect) {
	    return intersect.object;
	}
    };

    // Get the names of the objects that cross the plane
    var getCollidingObjectNames = function(plane) {
	var domain = objects.clone();
	// Remove planes from the domain
	// Loop backwards to avoid dynamic index problems
	for (var i = domain.children.length-1; i >= 0; i--) {
	    var obj = domain.children[i];
	    if (obj.userData.isPlane) {
		domain.remove(obj);
	    }
	}

	var w = plane.geometry.parameters.width;
	var h = plane.geometry.parameters.height;
	//TODO: make this dependent on plane angle
	var direction = new THREE.Vector3(0, 0, -1);
	var collisions = [];

	// Create raycasters that are 1/10 units apart, spanning across the
	// length of the plane.
	for (var x = -w/2; x < w/2; x+=1/10) {
	    // Don't keep searching if there are no objects left
	    if (domain.children.length == 0)  {
		break;
	    }
	    
	    var origin = new THREE.Vector3(x, 0, h/2);
	    origin = origin.add(plane.position);
	    direction = new THREE.Vector3(0, 0, -1).normalize();
	    var r = new THREE.Raycaster(origin, direction, 0, h);

	    // Visualize rays for debugging
	    //scene.add( new THREE.ArrowHelper(direction, origin, h, 0xffffff));
	    
	    // Get the objects that intersect with the raycaster
	    var intersects = r.intersectObjects(domain.children);
	    for (var i in intersects) {
		var obj = intersects[i].object;
		collisions.push(obj.name);
		domain.remove(obj);
	    }
	}
	return collisions;	
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
    var NULL_CLIENT_Z = Infinity;

    // Transform the cursor's screen position to a position in the scene
    var screenToScene = function(clientX, clientY, clientZ) {
	if (clientZ == NULL_CLIENT_Z) {
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

    var DEFAULT_DEPTH = -5;

    // Convert a coordinate value into scene units.
    // min - the min of the coordinate value range
    // max - the max of the coordinate value range
    // val - the actual coordinate value
    // dim - "x" or "y", the dimension the coordinate represents
    // depth - how far away from the camera the plane is, in scene units
    var convertToSceneUnits = function(min, max, val, dim, depth) {
	if ( depth == null) {
	    depth = DEFAULT_DEPTH;
	}
	depth = Math.abs(depth);
	var span = max-min;
	var relVal = val-min;
	
	// Calculate the camera range for a projection plane that's depth units
	// away by utilizing some equilateral triangle geometery.
	var fovRads = camera.fov*3.14159265/180;
	var camHeight = 2*depth*Math.tan(fovRads/2);
	var camVal;
	var camCoords = new THREE.Vector3(0, 0, depth);
	if (dim === "x") {
	    var camWidth = camHeight*camera.aspect;
	    camVal = (relVal/span - 1/2)*camWidth;
	    camCoords.x = camVal;
	}
	else if (dim === "y") {
	    camVal = -(relVal/span - 1/2)*camHeight;
	    camCoords.y = camVal;
	}

	// Transform the camera coordinates into the scene coordinates
	camCoords.applyMatrix4(camera.matrixWorld);
	
	if (dim === "x") {
	    return camCoords.x;
	}
	else if (dim === "y") {
	    return camCoords.y;
	}
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

    var insertObject = function(type, pos) {
	var obj = new THREE.Mesh({}, new THREE.MeshLambertMaterial({color: 0x009900}));
	switch(type) {
	    case 0: // plane
	        obj.geometry = new THREE.BoxGeometry(5, 5, 1/500);
	        obj.material.color.set(0xffffff);
	        obj.material.transparent = true; // this has to be true for the opacity to work
	        obj.material.opacity = 0.5;
	        obj.rotation.x = 3.14/2; // make the plane normal face upwards TODO: make this dependent on camera angle
	        obj.userData.isPlane = true;
	        break;
	    case 1: // cone
	        obj.geometry = new THREE.CylinderGeometry(0, 1/2, 1, 50, 0);
	        break;
	    default:
	        return;
	}
	var coords = screenToScene(pos.x, pos.y, pos.z);
	obj.position.x = coords.x;
	obj.position.y = coords.y;
	obj.position.z = coords.z;
	obj.updateMatrixWorld();
	// the object id is changed when a clone is made, so set the name to the
	// original id so it can be looked up when only clones are provided
	obj.name = obj.id;
	objects.add(obj);
	return obj;
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

    var splitObject = function(objectName, plane) {
	var object = objects.getObjectByName(objectName);
	// Remove the original object from the scene
	objects.remove(object);
	// Extend the plane downwards and reposition it so the top face is at the 
	// original plane position
	plane = plane.clone();
	var depth = 1000; // a large enough number to cover the entire object, hopefully
	plane.geometry = new THREE.BoxGeometry(5, 5, depth); //TODO: make height and width dependent on plane size when passed in.
	plane.position.y -= depth/2;
	var planeBSP = new ThreeBSP(plane);
	var objBSP = new ThreeBSP(object);
	// subtract the extended plane from the object to create the top half.
	var subtracted = objBSP.subtract(planeBSP);
	var mesh1 = subtracted.toMesh(new THREE.MeshLambertMaterial({color: 0x009900}));
	mesh1.material.side = THREE.DoubleSide;
	mesh1.geometry.computeVertexNormals();
	mesh1.name = objectName+"-0";
	objects.add(mesh1);
	// Reposition the extended plane so the bototm face is at the original
	// plane position
	plane.position.y += depth;
	planeBSP = new ThreeBSP(plane);
	// subtract again to create the bottom half
	subtracted = objBSP.subtract(planeBSP);
	var mesh2 = subtracted.toMesh(new THREE.MeshLambertMaterial({color: 0x009900}));
	mesh2.material.side = THREE.DoubleSide;
	mesh2.geometry.computeVertexNormals();
	mesh2.name = objectName+"-1";
	objects.add(mesh2);
	return [mesh1, mesh2];
    };

    // Transforms (rotates and translates) an object
    // deltaOri - THREE.Vector3, the change in rotation along each axis in radians
    // deltaPos - THREE.Vector3, the change in position along each axis in scene units
    var transformObject = function(object, deltaOri, deltaPos) {
	object.position.add(deltaPos);
	object.rotation.setFromVector3(deltaOri.add(object.rotation.toVector3()));
    };

    return {
	getRenderingComponents: getRenderingComponents,
	addCubes: addCubes,
	addCube: addCube,
	setMode: function(state) {
	    // camera control states
	    // -1: disabled, 0: rotate, 1: zoom, 2: pan
	    if (state == -1) {
		controls.disable();
	    }
	    else if (state >= 0 & state <= 2) { 
		controls.enabled = true;
		controls.changeState(state);
	    }
	}, 
	selectObject: selectObject,
	selectObjectByIntersection: selectObjectByIntersection,
	deselectObject: deselectObject,
	rotateObject: rotateObject,
	cursorMove: cursorMove,
	// new and improved env
	setObjectColor: function(object, color) { object.material.color.set(color); },
	insertObject: insertObject,
	getObjectByIntersection: getObjectByIntersection,
	splitObject: splitObject,
	getCollidingObjectNames: getCollidingObjectNames,
	transformObject: transformObject,
	convertToSceneUnits: convertToSceneUnits,
	removeByName: function(name) { objects.remove(objects.getObjectByName(name)); },
	addObject: function(obj) { objects.add(obj); },
	getObjectByName: function(name) { return objects.getObjectByName(name); }
    };
};
