var buttons;

// Gets the screen position of the given Leap position
// also flips the y value to correspond to browser coordinates
var roundedPos = function(handMesh, pos) {
    var newPos = handMesh.screenPosition(pos);
    newPos.y = window.innerHeight - newPos.y;
    return { x: Math.round(newPos.x), y: Math.round(newPos.y) };
};

var intersectingButton = function(pos) {
    var intersecting = false;
    for (var i = 0; i < buttons.length; i++) {
        var button = buttons.eq(i);
        var xmin, xmax, ymin, ymax;
        xmin = button.offset().left;
        xmax = xmin + button.width();
        ymin = button.offset().top;
        ymax = ymin + button.height();

        if (pos.x >= xmin && pos.x <= xmax &&
                pos.y >= ymin && pos.y <= ymax) {
            button.addClass('intersecting-hand');
            intersecting = button;
        } else {
            button.removeClass('intersecting-hand');
        }
    }
    return intersecting;
};

var screenPositionOptions = {
    // positioning: 'absolute',
    // function(vec3) {
    //     console.log(vec3);
    //     return vec3;
    // }
    // verticalOffset: 100,
    // scale: 0.6
};

var riggedHandOptions = {
    // parent: scene,
    // camera: camera,
    // renderer: renderer,
    // renderFn: render,
    // positionScale: 1.5
    // offset: new THREE.Vector3(0, -1000, 0)
};

$(document).ready(function() {

    // For debugging purposes:
    var posDiv = $('<div>0').css({color: 'white', position:'absolute', top: 50, left:10});
    var posDiv2 = $('<div>0').css({color: 'orange', position:'absolute', top:100, left:10});
    var otherDiv = $('<div>0').css('color', 'white');

    var controllerOptions = {};
    var controller = Leap.loop(controllerOptions, function(frame) {
        var rhScope = this.plugins.riggedHand;
        if (frame.hands.length >= 1) {
            var hand = frame.hands[0];
            var handMesh = hand.data('riggedHand.mesh');

            var handPos = roundedPos(handMesh, hand.palmPosition);
            // posDiv.text(hand.screenPosition(hand.palmPosition).map(Math.round));
            posDiv.text([handPos.x, handPos.y]);

            var btn = intersectingButton(handPos);


            // var btnPos = hand.screenPosition([buttons[0].position().left, buttons[0].position().top, 0]);
            // posDiv2.text(btnPos);
            // posDiv2.text(hand.screenPosition([0, 0, 0]))
            // throw new Error('stop');
        }
    });

    controller.use('screenPosition', screenPositionOptions);

    // controller.use('boneHand', boneHandOptions);
    controller.use('riggedHand', riggedHandOptions);
    $('body').append(posDiv, posDiv2, otherDiv);

    buttons = $('.buttons').children();

    // $('body').append(buttons);
    // $('.bigBtn').css({ width: 100, height: 100, opacity: 0.5 });

    // $('body').append($('<div>').css({
    //     width: 10,
    //     height: 10,
    //     'background-color': 'red',
    //     position: 'absolute',
    //     left: window.innerWidth/2,
    //     top: 0
    // }));
    // console.log(buttons[0].position())
});
