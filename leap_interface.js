var GRAB_THRESHOLD = 0.5;

var Cursor = function(isRightHand) {
    var el = $('<div class="cursor">').text(isRightHand ? 'R' : 'L');
    $('body').append(el);

    this.setPosition = function(newPos) {
        el.css({ top: newPos.y, left: newPos.x });
    };

    this.hide = function() { el.hide(); };
    this.show = function() { el.show(); };

    return this;
};

// var GrabState = function() {
//     var state = 'notGrabbing';
//     var prevState = 'notGrabbing';

//     this.update = function(currentGrabStr, prevGrabStr) {
//         var closed = currentGrabStr > GRAB_THRESHOLD;
//         var isClosing = currentGrabStr > prevGrabStr;

//         prevState = state;
//         state = 
//     };
// };

var previousGrabStrength = function(controller, hand, numSteps) {
    var total = 0.0;
    for (var i = 1; i <= numSteps; i++) {
        var oldHand = controller.frame(i).hand(hand.id);
        if (!oldHand.valid) { break; }
        total += oldHand.grabStrength;
    }
    return total/numSteps;
};

var getGrabState = function(currentGrabStr, prevGrabStr) {
    var isGrabbing = currentGrabStr >= GRAB_THRESHOLD;
    if (prevGrabStr < GRAB_THRESHOLD && isGrabbing) {
        return 'grabStart';
    }
    if (prevGrabStr > GRAB_THRESHOLD && !isGrabbing) {
        return 'grabEnd';
    }
    return isGrabbing ? 'grabbing' : 'notGrabbing';
};

var LeapInterface = function(env) {
    var lCursor = new Cursor(false);
    var rCursor = new Cursor(true);

    var grabStartProcessed = false;
    var grabEndProcessed = false;

    var controllerOptions = {};
    var controller = Leap.loop(controllerOptions, function(frame) {
        // var rhScope = this.plugins.riggedHand;
        lCursor.hide();
        rCursor.hide();

        for(var h in frame.hands) {
            if (h > 1) { break; }
            var hand = frame.hands[h];
            var handPos = hand.screenPosition().map(Math.round);

            var prvGrabStr = previousGrabStrength(this, hand, 10);
            var grabState = getGrabState(hand.grabStrength, prvGrabStr);
            // var isGrabbing = (hand.grabStrength >= GRAB_THRESHOLD);
            // var grabStarted = isGrabbing &&
            //                   (prvGrabStr < GRAB_THRESHOLD);


            // Move the interface cursors
            var c = (hand.type == 'right') ? rCursor: lCursor;
            c.setPosition({ x: handPos[0], y: handPos[1] });
            c.show();

            // Move the scene cursor with one hand
            if (h === '0') {
                env.cursorMove(handPos[0], handPos[1]);
            }

            if (grabState == 'grabStart' && !grabStartProcessed) {
                // console.log('grab started');
                grabStartProcessed = true;
                env.selectObject(handPos[0], handPos[1]);
            }
            if (grabState == 'grabbing') {
                // console.log('grabbing');
            }
            if (grabState == 'grabEnd' && !grabEndProcessed) {
                console.log('grab ended');
                grabEndProcessed = true;
                env.deselectObject();
            }

            if (grabState != 'grabStart') {
                grabStartProcessed = false;
            }
            if (grabState != 'grabEnd') {
                grabEndProcessed = false;
            }

            
        }
    });

    // var riggedHandOptions = $.extend({
    //     // targetEl: document.body
    // }, env.getRenderingComponents());
    // controller.use('boneHand', riggedHandOptions);
    var screenPositionOptions = {
        verticalOffset: 200,
        scale: 0.4
    };
    controller.use('screenPosition', screenPositionOptions);
};
