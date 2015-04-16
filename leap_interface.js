var Cursor = function(isRightHand) {
    var el = $('<div class="cursor">').text(isRightHand ? 'R' : 'L');
    $('body').append(el);

    this.setPosition = function(newPos) {
        el.css({
            top: newPos.y,
            left: newPos.x,
            transform: 'scale(' + leapZToScale(newPos.z) + ')'
        });
    };

    this.hide = function() { el.hide(); };
    this.show = function() { el.show(); };
    this.setDominant = function(isDom) {
        el.toggleClass('dominant-cursor', isDom);
    };

    return this;
};

var leapZToSceneZ = function(leapZ) {
    return (leapZ - 320) * 0.02;
};
var leapZToScale = function(leapZ) {
    var result = leapZ + 400;
    result *= 0.005;
    return Math.max(result, 0.1);
};

// Get the average grab strength for the previous numSteps frames
var previousGrabStrength = function(controller, hand, numSteps) {
    var total = 0.0;
    for (var i = 1; i <= numSteps; i++) {
        var oldHand = controller.frame(i).hand(hand.id);
        if (!oldHand.valid) { break; }
        total += oldHand.grabStrength;
    }
    return total/numSteps;
};

// Detect grab state
var GRAB_THRESHOLD = 0.5;
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

// GUI
var binContainer = $('<div class="bin-container">');
var addCubeBtn = $('<button class="bin">Cube Bin</button>');
binContainer.append(addCubeBtn);

// indicate which (if any) of the controls are underneath the given
// position. Return false if no bin intersects POS, or the bin
// it intersects with
// TODO: does the handEntry plugin do this automatically?
var findIntersectingBin = function(pos) {
    var bins = $('.bin');
    for (var i = 0; i < bins.length; i++) {
        var bin = bins.eq(i);
        var xmin, xmax, ymin, ymax;
        xmin = bin.offset().left;
        xmax = xmin + bin.width();
        ymin = bin.offset().top;
        ymax = ymin + bin.height();

        if (pos.x >= xmin && pos.x <= xmax &&
                pos.y >= ymin && pos.y <= ymax) {
            return bin;
        }
    }
    return false;
};

var updateBinHighlights = function(intersecting) {
    $('.intersecting-hand').removeClass('intersecting-hand');
    if (intersecting) {
        intersecting.addClass('intersecting-hand');
    }
};

var LeapInterface = function(env) {
    // state
    var cursors = { 'left': new Cursor(false), 'right': new Cursor(true) };
    var grabStartProcessed = { 'left': false, 'right': false };
    var grabEndProcessed = { 'left': false, 'right': false };

    // GUI
    addCubeBtn.click(function(evt, handPos) {
        env.addCube(handPos.x, handPos.y, leapZToSceneZ(handPos.z));
        env.selectObject(handPos.x, handPos.y);
    });
    $('body').prepend(binContainer);

    // Leap control loop and options
    var controllerOptions = {};
    var controller = Leap.loop(controllerOptions, function(frame) {
        // var rhScope = this.plugins.riggedHand;
        cursors.left.hide();
        cursors.right.hide();

        for(var h in frame.hands) {
            if (h > 1) { break; }
            var hand = frame.hands[h];
            var handPosRaw = hand.screenPosition().map(Math.round);
            var handPos = { x: handPosRaw[0], y: handPosRaw[1], z: handPosRaw[2] };

            var prvGrabStr = previousGrabStrength(this, hand, 10);
            var grabState = getGrabState(hand.grabStrength, prvGrabStr);

            var intersectingBin = findIntersectingBin(handPos);

            // Move the interface cursors
            var c = cursors[hand.type];
            c.setPosition(handPos);
            c.show();

            // Move the scene cursor with one (and only one) hand
            if (h === '0') {
                env.cursorMove(handPos.x, handPos.y);
                c.setDominant(true);
                updateBinHighlights(intersectingBin);
            } else {
                c.setDominant(false);
            }

            // Process grab state
            if (grabState == 'grabStart' && !grabStartProcessed[hand.type]) {
                // grab started
                grabStartProcessed[hand.type] = true;
                if (intersectingBin) {
                    intersectingBin.trigger('click', handPos);
                }
                env.selectObject(handPos.x, handPos.y);
            }
            if (grabState == 'grabbing') {
                // grab active
            }
            if (grabState == 'grabEnd' && !grabEndProcessed[hand.type]) {
                // grab ended
                grabEndProcessed[hand.type] = true;
                env.deselectObject();
            }

            // reset grab start/end processing
            if (grabState != 'grabStart') {
                grabStartProcessed[hand.type] = false;
            }
            if (grabState != 'grabEnd') {
                grabEndProcessed[hand.type] = false;
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
