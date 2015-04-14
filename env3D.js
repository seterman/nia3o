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
    var controls = new THREE.TrackballControls( camera, document );
    controls.rotateSpeed = 1.5;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;

    // Render loop
    var render = function () {
	requestAnimationFrame( render );
	renderer.render(scene, camera);
        controls.update();
    };
    render();

    // Components for figuring out where the mouse is and how the objects should react
    var selectedObject, intersectedObject;
    var raycaster = new THREE.Raycaster();
    var mouse_vector = new THREE.Vector3();
    var offset = new THREE.Vector3();
    var plane = new THREE.Mesh(
	new THREE.PlaneBufferGeometry( 2000, 2000, 8, 8 ),
	new THREE.MeshBasicMaterial( { color: 0x000000, opacity: 0.25, transparent: true } )
    );
    plane.visible = false;
    scene.add(plane);
    
    // A wrapper for the objects that will be added by the user
    var objects = new THREE.Object3D();
    scene.add(objects);

    // Cast a ray from the camera to the cursor position.
    // The raycaster object can then be used to find intersecting objects.
    var castRay = function(clientX, clientY) {
	mouse_vector.x = 2 * (clientX / window.innerWidth) - 1;
	mouse_vector.y = 1 - 2 * (clientY / window.innerHeight);
	raycaster.setFromCamera(mouse_vector.clone(), camera); 
    };

    // Selects the first intersecting object, if one exists.
    var selectObject = function(clientX, clientY) {
	castRay(clientX, clientY);
	var intersect = raycaster.intersectObjects(objects.children)[0];
	if (intersect) {
	    // Don't move the camera while an object is selected
	    controls.enabled = false; 

	    selectedObject = intersect.object
	    // Move the placeholder plane to the object's position
	    plane.position.copy(selectedObject.position);
	    plane.lookAt(camera.position);
	    // Find the offset of the object using the plane
	    var planeIntersect = raycaster.intersectObject(plane)[0];
	    if (planeIntersect) {
		offset.copy(planeIntersect.point).sub(plane.position);
	    }
	}
    };

    // Deselect an object
    var deselectObject = function() {
	controls.enabled = true;
	selectedObject = null;
  };	

    var lastHighlighted, origColor;
    var HIGHLIGHT_COLOR = 0x0000ff;

    // Highlights the first intersecting object, if one exists
    var highlightObject = function(clientX, clientY) {
	// If an object is selected, it's already highlighted.
	if (!selectedObject) {
	    // Revert the last highlight
	    if (lastHighlighted) {
		lastHighlighted.material.color.set(origColor);
		lastHighlighted = null;
	    }
	    // Get the intersecting object and highlight it
	    castRay(clientX, clientY)
	    var intersect = raycaster.intersectObjects(objects.children)[0];
	    if (intersect) {
		lastHighlighted = intersect.object;
		origColor = lastHighlighted.material.color.getHex();
		intersect.object.material.color.set(HIGHLIGHT_COLOR);
	    }
	}
    };

    // Move the plane to the intersected object's position, so that it
    // can be used to move that object if desired.
    var updatePlane = function(clientX, clientY) {
	castRay(clientX, clientY);
	var intersect = raycaster.intersectObjects(objects.children)[0];
	if (intersect) {		
	    if (intersectedObject != intersect.object) {
		intersectedObject = intersect.object;
		plane.position.copy(intersectedObject.position);
		plane.lookAt(camera.position);
	    }
	}
    }

    // Moves the selected object according to the cursor's position
    var moveObject = function(clientX, clientY) {
	if (selectedObject) {
	    // Use the previously calculated offset and the intersection of the 
	    // cursor ray and the placeholder plane to figure out the object's new location
	    castRay(clientX, clientY);
	    var planeIntersect = raycaster.intersectObject(plane)[0];
	    if (planeIntersect) {
		selectedObject.position.copy(planeIntersect.point.sub(offset));
	    }
	}
    };

    var cursorMove = function(clientX, clientY) {
	highlightObject(clientX, clientY);
	if (selectedObject) {
	    moveObject(clientX, clientY);
	}
	else {
	    // I don't know why the plane has to be updated everytime the 
	    // cursor moves instead of just before an object is selected,
	    // but it does. Otherwise there are non-deterministic bugs
	    // with the object movement behavior.
	    updatePlane(clientX, clientY);
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
