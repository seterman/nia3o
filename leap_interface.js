var Cursor = function(isRightHand) {
    var el = $('<div class="cursor">').text(isRightHand ? 'R' : 'L');
    var scale = 1;
    $('body').append(el);

    this.setPosition = function(newPos) {
        scale = leapZToScale(newPos.z);
        el.css({
            top: newPos.y,
            left: newPos.x,
            transform: 'scale(' + scale + ')'
        });
    };
    this.setRotation = function(x, y, z) {
        if (x == y == z === 0) {
            this.clearRotation();
            return;
        }
        el.css({
            transform: 'scale('+scale+') rotateX('+x+'rad) rotateY('+y+'rad) rotateZ('+z+'rad)'
        }).addClass('rotating');
    };
    this.clearRotation = function() {
        el.css({
            transform: 'scale('+scale+')'
        }).removeClass('rotating');
    };

    this.hide = function() { el.hide(); };
    this.show = function() { el.show(); };
    this.setDominant = function(isDom) {
        el.toggleClass('dominant-cursor', isDom);
    };

    return this;
};

// empirically determined values to convert from leap coordinates to THREE
// coordinates and size of cursor
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
// var addCubeBtn = $('<div class="bin">Cube Bin</div>');
// binContainer.append(addCubeBtn);
var coneBin = $('<div class="bin">Cone Bin</div>');
var planeBin = $('<div class="bin">Plane Bin</div>');
binContainer.append(coneBin, planeBin);

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

// setup after document loads
var ROTATE_THRESHOLD = 0.5;
var getRotation = function(hand, startFrame) {
    var xRot, yRot, zRot, total;
    xRot = hand.rotationAngle(start, [1, 0, 0]);
    yRot = hand.rotationAngle(start, [0, 1, 0]);
    zRot = hand.rotationAngle(start, [0, 0, 1]);
    total = hand.rotationAngle(start);
    if (Math.abs(total) < ROTATE_THRESHOLD) {
        xRot = 0;
        yRot = 0;
        zRot = 0;
    }
    return { x: xRot, y: yRot, z: zRot };
};

var LeapInterface = function(env, helpers) {
    // env-dependent helpers
    var handPosToTransformPos = function(x, y, z) {
        var newZ = leapZToSceneZ(z);
        var newX = env.convertToSceneUnits(0, window.innerWidth, x, 'x', z);
        var newY = env.convertToSceneUnits(0, window.innerHeight, y, 'y', z);
    };

    // TESTING ONLY
    env.addCubes();
    
    // TODO: add a 'seenThisFrame' attribute and if not seen, hide cursor and clear
    // highlights/selections/etc
    var handState = {
        left: {
            cursor: new Cursor(false),
            grabStartProcessed: false,
            grabStartFrame: null,
            grabEndProcessed: false,
            currentSelection: null,
            currentHighlight: null,
        },
        right: {
            cursor: new Cursor(true),
            grabStartProcessed: false,
            grabStartFrame: null,
            grabEndProcessed: false,
            currentSelection: null,
            currentHighlight: null,
        }
    };
    handState.left.otherHand = handState.right;
    handState.right.otherHand = handState.left;

    // GUI
    // addCubeBtn.click(function(evt, handPos) {
    //     var cube = env.addCube(handPos.x, handPos.y, leapZToSceneZ(handPos.z));
    //     env.selectObject(cube);
    // });
    coneBin.click(function(evt, handType, handPos) {
        var pos = { x: handPos.x, y: handPos.y, z: leapZToSceneZ(handPos.z) };
        handState[handType].currentSelection = helpers.insertObject(OBJECT_TYPES.CONE, pos);
    });
    planeBin.click(function(evt, handType, handPos) {
        var pos = { x: handPos.x, y: handPos.y, z: leapZToSceneZ(handPos.z) };
        handState[handType].currentSelection = helpers.insertObject(OBJECT_TYPES.PLANE, pos);
    });
    $('body').prepend(binContainer);

    // Leap control loop and options
    var controllerOptions = {};
    var controller = Leap.loop(controllerOptions, function(frame) {
        // var rhScope = this.plugins.riggedHand;
        // cursors.left.hide();
        // cursors.right.hide();
        handState.left.cursor.hide();
        handState.right.cursor.hide();

        for(var h in frame.hands) {
            if (h > 1) { break; }
            var hand = frame.hands[h];
            var handPosRaw = hand.screenPosition().map(Math.round);
            var handPos = { x: handPosRaw[0], y: handPosRaw[1], z: handPosRaw[2] };
            var handType = hand.type;
            var thisHand = handState[handType];

            var prvGrabStr = previousGrabStrength(this, hand, 10);
            var grabState = getGrabState(hand.grabStrength, prvGrabStr);

            var intersectingBin = findIntersectingBin(handPos);
            updateBinHighlights(intersectingBin);

            // Move the interface cursors
            var c = thisHand.cursor;
            c.setPosition(handPos);
            c.show();

            // Process grab state
            if (grabState == 'grabStart' && !thisHand.grabStartProcessed) {
                // grab started
                thisHand.grabStartProcessed = true;
                thisHand.grabStartFrame = frame;
                if (intersectingBin) {
                    intersectingBin.trigger('click', [handType, handPos]);
                } else {
                    var selection = helpers.selectObjectByPos(handPos);
                    if (thisHand.otherHand.currentSelection != selection) {
                        thisHand.currentSeletion = selection;
                    }
                    // env.selectObjectByIntersection(handPos.x, handPos.y);
                }
            }
            if (grabState == 'grabbing') {
                // grab active
                // *******************************************
                // var xRot, yRot, zRot, total;
                var start = thisHand.grabStartFrame;
                var rotation = getRotation(hand, start);
                c.setRotation(rotation.x, rotation.y, rotation.z);
                var translation = handPosToTransformPos(hand.translation(start));
                // TODO: split and transform here!!

                // xRot = hand.rotationAngle(start, [1, 0, 0]);
                // yRot = hand.rotationAngle(start, [0, 1, 0]);
                // zRot = hand.rotationAngle(start, [0, 0, 1]);
                // total = hand.rotationAngle(start);
                // if (Math.abs(total) > ROTATE_THRESHOLD) {
                //     c.setRotation(xRot, yRot, zRot);
                // } else {
                //     c.clearRotation();
                // }
                // console.log('axis:', hand.rotationAxis(grabStartFrame[handType]));
            }
            if (grabState == 'grabEnd' && !thisHand.grabEndProcessed) {
                // grab ended
                // this is finicky. Does not always seem to run, so
                // all essential clearing should go in notGrabbing
                thisHand.grabEndProcessed = true;
                thisHand.grabStartFrame = null;
            }
            if (grabState == 'notGrabbing') {
                thisHand.grabStartFrame = null;
                c.clearRotation();
                helpers.deselectObject(thisHand.currentSelection);
                thisHand.currentSelection = null;

                var newHighlight = helpers.highlightObjectByPos(handPos);
                if (newHighlight != thisHand.currentHighlight) {
                    helpers.clearHighlight(thisHand.currentHighlight);
                }
                thisHand.currentHighlight = newHighlight;

            }

            // reset grab start/end processing
            if (grabState != 'grabStart') {
                thisHand.grabStartProcessed = false;
            }
            if (grabState != 'grabEnd') {
                thisHand.grabEndProcessed = false;
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
