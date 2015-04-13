$(document).ready(function() {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 0);

    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth - 20, window.innerHeight - 20);

    var geometry = new THREE.BoxGeometry( 1, 1, 1);
    var material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    var cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    camera.position.z = 15;
    camera.position.y = 5;
    camera.position.x = 0;
    // renderer.render(scene, camera);

    var render = function() {
        // requestAnimationFrame(render);

        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        renderer.render(scene, camera);
    };
    // render();

    var riggedHandOptions = {
        parent: scene,
        camera: camera,
        renderer: renderer,
        renderFn: render,
        positionScale: 1.5
    };

    var posDiv = $('<div>');

    var controllerOptions = {};
    var controller = Leap.loop(controllerOptions, function(frame) {
        // if (frame.hands.length >= 1) {
        //     var hand = frame.hands[0];
        //     var handMesh = hand.data('riggedHand.mesh');
        //     posDiv.text(handMesh.screenPosition(hand.fingers[1].tipPosition));
        // }
    });

    controller.use('screenPosition');
    controller.use('riggedHand', riggedHandOptions);
    $('body').append($(renderer.domElement));
    $('body').append(posDiv);
});