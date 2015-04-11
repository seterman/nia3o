var Env3D = function() {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );

    var renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );
    $(renderer.domElement).css("position", "absolute").css("top", "0px").css("left", "0px").css("z-index", "-5");
    


    var controls = new THREE.TrackballControls( camera, document );
    controls.keys = [ 65, 83, 68 ];

/*    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;

    controls.noZoom = false;
    controls.noPan = false;

    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0.3;

    
    controls.addEventListener( 'change', render );
*/
    //var projector = new THREE.Projector();
    var raycaster = new THREE.Raycaster();
    var mouse_vector = new THREE.Vector3();

    var objects = new THREE.Object3D();
    scene.add(objects);

    var plane = new THREE.Mesh(
	new THREE.PlaneBufferGeometry( 2000, 2000, 8, 8 ),
	new THREE.MeshBasicMaterial( { color: 0x000000, opacity: 0.25, transparent: true } )
    );
    plane.visible = false;
    scene.add(plane);

    var selectedObject, intersectedObject;
    var offset = new THREE.Vector3();
    
    $(document).mousedown(function(e) {
	mouse_vector.x = 2 * (e.clientX / window.innerWidth) - 1;
	mouse_vector.y = 1 - 2 * (e.clientY / window.innerHeight);
	raycaster.setFromCamera(mouse_vector.clone(), camera); 
	var intersects = raycaster.intersectObjects(objects.children);
	if (intersects.length > 0) {
	    controls.enabled = false;
	    selectedObject = intersects[0].object
	    var planeIntersects = raycaster.intersectObject(plane);
	    offset.copy(planeIntersects[0].point).sub(plane.position);
	}
    });

    $(document).mousemove(function(e) {
	for (var i = 0; i < objects.children.length; i++) {
	    //TODO: instead of brute forcing all colors back to normal,
	    // could just keep track of highlighted object and change it
	    // back to normal individually.
	    objects.children[i].material.color.setRGB(0, 1, 0);
	}
	mouse_vector.x = 2 * (e.clientX / window.innerWidth) - 1;
	mouse_vector.y = 1 - 2 * ( e.clientY / window.innerHeight );
	raycaster.setFromCamera(mouse_vector.clone(), camera); 
	if (selectedObject) {
	    var intersects = raycaster.intersectObject( plane );
	    selectedObject.position.copy( intersects[ 0 ].point.sub( offset ) );
	}
	else {
	    var intersects = raycaster.intersectObjects( objects.children );
	    if (intersects.length > 0) {
		intersects[0].object.material.color.set(0x0000ff);

		
		if (intersectedObject != intersects[0].object) {
		    intersectedObject = intersects[0].object;

		    plane.position.copy(intersectedObject.position);
		    plane.lookAt(camera.position);
		}
	    }
	}
    });

    $(document).mouseup(function(e) {
	controls.enabled = true;
	selectedObject = null;
	if (intersectedObject) {
	    plane.position.copy(intersectedObject.position);
	}
    });


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

    camera.position.z = 5;
    
    renderer.setClearColor(0x333F47, 1);
    
    // Create a light, set its position, and add it to the scene.
    var light = new THREE.PointLight(0xffffff);
    light.position.set(-100,200,100);
    scene.add(light);

    var render = function () {
	requestAnimationFrame( render );

	//cube.rotation.x += 0.1;
	//cube.rotation.y += 0.1;

	renderer.render(scene, camera);
        controls.update();
    };

    render();

    var STATES = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM_PAN: 4 };
    return {
	addCube: addCube,
	panCamera: function() {
	    controls.changeState(STATES.PAN);
	},
	rotateCamera: function() {
	    controls.changeState(STATES.ROTATE);
	},
	zoomCamera: function() {
	    controls.changeState(STATES.ZOOM);
	}
    };
};
