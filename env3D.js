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

    // Selects the first intersecting object, if one exists.
    var selectObject = function(clientX, clientY) {
	castRay(clientX, clientY);
	var intersect = raycaster.intersectObjects(objects.children)[0];
	if (intersect) {
	    controls.enabled = false; // Don't move the camera while an object is selected
	    selectedObject = intersect.object
	    if (hoverObject) { 
		revertHighlight(hoverObject); // Make sure origColor is set to actual origColor and not HOVER_COLOR 
	    }
	    highlightObject(selectedObject, SELECT_COLOR);
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

    // Moves the selected object according to the cursor's position
    var moveObject = function(clientX, clientY) {
	if (selectedObject) {
	    // Calculate the z distance (in cam coords) between the projection plane and the camera
	    // by projecting the object's position vector onto the camera's postion vector and
	    // subtracting the projection from the camera's position vector.
	    var objPosProj = selectedObject.position.clone().projectOnVector(camera.position);
	    var projDist = camera.position.clone().sub(objPosProj).length();

	    // Calculate the camera range at that distance by using some equilateral triangle geometery.
	    var fovRads = camera.fov*3.14159265/180;
	    var camHeight = 2*projDist*Math.tan(fovRads/2);
	    var camWidth = camHeight*camera.aspect;
	    
	    // Compute the cursor's position in camera coordinates
	    // TODO: should potentially use width/height of renderer's dom element instead of window
	    var xCam = (clientX/window.innerWidth - 1/2)*camWidth;
	    var yCam = -(clientY/window.innerHeight - 1/2)*camHeight;
	    var coords = new THREE.Vector3(xCam, yCam, -projDist);

	    // Transform the camera coordinates into the scene coordinates
	    coords.applyMatrix4(camera.matrixWorld);

	    // Move the object to the resulting position
	    selectedObject.position.x = coords.x;
	    selectedObject.position.y = coords.y;
	    selectedObject.position.z = coords.z;
	    
	}
    };

    // Perform appropriate behavior when the cursor moves
    var cursorMove = function(clientX, clientY) {
	// Move an object, if an object is selected
	if (selectedObject) {
	    moveObject(clientX, clientY);
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

    // Currently adds a bunch of cubes, eventually will add one cube at a specified location
    var addCube = function() {
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


    return {
	getRenderingComponents: getRenderingComponents,
	addCube: addCube,
	setMode: function(state) {
	    // camera control states
	    // 0: rotate, 1: zoom, 2: pan
	    if (state >= 0 & state <= 2) { 
		controls.changeState(state);
	    }
	}, 
	selectObject: selectObject,
	deselectObject: deselectObject,
	cursorMove: cursorMove
    };
};
