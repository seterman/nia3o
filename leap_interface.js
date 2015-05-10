// The dot representing the cursor for each hand
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

// Rotation angle
var getAngle = function(hand) {
    return new THREE.Vector3(hand.pitch(), hand.yaw(), hand.roll());
};

///////////////////////////////////////////////////////////////////////////////
// GUI
///////////////////////////////////////////////////////////////////////////////

var binContainer = $('<div class="bin-container">');
// var addCubeBtn = $('<div class="bin">Cube Bin</div>');
// binContainer.append(addCubeBtn);
var coneBin = $('<div class="bin">Cone Bin</div>');
var planeBin = $('<div class="bin">Plane Bin</div>');
binContainer.append(coneBin, planeBin);

var findIntersecting = function(pos, elements) {
    for (var i = 0; i < elements.length; i++) {
        var element = elements.eq(i);
        var xmin, xmax, ymin, ymax;
        xmin = element.offset().left;
        xmax = xmin + element.width();
        ymin = element.offset().top;
        ymax = ymin + element.height();

        if (pos.x >= xmin && pos.x <= xmax &&
                pos.y >= ymin && pos.y <= ymax) {
            return element;
        }
    }
    return false;
};

// indicate which (if any) of the controls are underneath the given
// position. Return false if no bin intersects POS, or the bin
// it intersects with
// TODO: does the handEntry plugin do this automatically?
var findIntersectingBin = function(pos) {
    var bins = $('.bin');
    return findIntersecting(pos, bins);
};

// Set or clear the highlights on anything intersecting the cursor
// separated by hand so that two hands can select different things
var updateIntersectionHighlights = function(intersecting, type) {
    $('.intersecting-hand-'+type).removeClass('intersecting-hand-'+type);
    if (intersecting) {
        intersecting.addClass('intersecting-hand-'+type);
    }
};

///////////////////////////////////////////////////////////////////////////////
// Leap controller
///////////////////////////////////////////////////////////////////////////////

// setup after document loads
var LeapInterface = function(env) {
    // functions from callback_helpers.js, put in an object and sometimes
    // renamed to help with consistency
    var helpers = {
        insertObject: insertObject,
        selectObjectByPos: grabObject,
        transformObject: transformObject,
        deselectObject: dropObject,
        highlightObjectByPos: highlightObject,
        clearHighlight: unhighlightObject,
    };

    // env-dependent helpers
    var handPosToTransformPos = function(oldPos) {
        var newZ = leapZToSceneZ(oldPos.z);
        var newX = env.convertToSceneUnits(0, window.innerWidth, oldPos.x, 'x', newZ);
        var newY = env.convertToSceneUnits(0, window.innerHeight, oldPos.y, 'y', newZ);
        return new THREE.Vector3(newX, newY, newZ);
    };

    // TESTING ONLY
    // env.addCubes();
    
    // TODO: add a 'seenThisFrame' attribute and if not seen, hide cursor and clear
    // highlights/selections/etc
    var EWMA_FRAC = 0.1;
    var EWMA_ROT_FRAC = 0.2;
    var handState = {
        left: {
            cursor: new Cursor(false),
            residualPos: { x: 0, y: 0, z: 0 },
            residualRotation: new THREE.Vector3(0, 0, 0),
            grabStartProcessed: false,
            grabStartFrame: null,
            grabStartPos: { x: 0, y: 0, z: 0 },
            lastPos: { x: 0, y: 0, z: 0 },
            lastAngle: new THREE.Vector3(0, 0, 0),
            grabEndProcessed: false,
            currentSelection: null,
            currentHighlight: null,
        },
        right: {
            cursor: new Cursor(true),
            residualPos: { x: 0, y: 0, z: 0 },
            residualRotation: new THREE.Vector3(0, 0, 0),
            grabStartProcessed: false,
            grabStartFrame: null,
            grabStartPos: { x: 0, y: 0, z: 0 },
            lastPos: { x: 0, y: 0, z: 0 },
            lastAngle: new THREE.Vector3(0, 0, 0),
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
            var handType = hand.type;
            var thisHand = handState[handType];
            var handPosRaw = hand.screenPosition().map(Math.round);
            var handPos = {
                x: handPosRaw[0] * (1-EWMA_FRAC) + thisHand.residualPos.x * EWMA_FRAC,
                y: handPosRaw[1] * (1-EWMA_FRAC) + thisHand.residualPos.y * EWMA_FRAC,
                z: handPosRaw[2] * (1-EWMA_FRAC) + thisHand.residualPos.z * EWMA_FRAC
            };
            thisHand.residualPos = handPos;

            var prvGrabStr = previousGrabStrength(this, hand, 10);
            var grabState = getGrabState(hand.grabStrength, prvGrabStr);

            var intersectingBin = findIntersectingBin(handPos);
            updateIntersectionHighlights(intersectingBin, handType);

            // Move the interface cursors
            var c = thisHand.cursor;
            c.setPosition(handPos);
            c.show();

            // Process grab state
            if (grabState == 'grabStart' && !thisHand.grabStartProcessed) {
                // grab started
                thisHand.grabStartProcessed = true;
                thisHand.grabStartFrame = frame;
                thisHand.grabStartPos = handPos;
                thisHand.lastPos = handPos;
                thisHand.lastAngle = getAngle(hand);
                thisHand.residualRotation = new THREE.Vector3(0, 0, 0);

                // if an object is being highlighted, clear it so
                // that we can pick it up without weird state problems
                if (thisHand.currentHighlight !== null) {
                    helpers.clearHighlight(thisHand.currentHighlight);
                    thisHand.currentHighlight = null;
                }

                if (intersectingBin) {
                    intersectingBin.trigger('click', [handType, handPos]);
                } else {
                    var selection = helpers.selectObjectByPos(handPos);
                    if (selection != thisHand.otherHand.currentSelection) {
                        thisHand.currentSelection = selection;
                    }
                }
            }
            if (grabState == 'grabbing') {
                // grab active
                if (thisHand.currentSelection) {
                    // rotation since one frame ago
                    // var rotation = getAngle(hand, thisHand.grabStartFrame, this.frame(1));
                    // c.setRotation(rotation.x, rotation.y, rotation.z);

                    var currentAngle = getAngle(hand);
                    var rotation = currentAngle.sub(thisHand.lastAngle);
                    thisHand.lastAngle = currentAngle;
                    rotation.multiplyScalar(1-EWMA_ROT_FRAC);
                    rotation.add(thisHand.residualRotation.multiplyScalar(EWMA_ROT_FRAC));
                    thisHand.residualRotation = rotation.clone();

                    // planes do not rotate
                    if (thisHand.currentSelection.userData.isPlane) {
                        rotation = new THREE.Vector3(0, 0, 0);
                    }

                    // translation since one frame ago
                    var lastXformPos = handPosToTransformPos(thisHand.lastPos);
                    var currentXformPos = handPosToTransformPos(handPos);
                    var translation = currentXformPos.sub(lastXformPos);
                    thisHand.lastPos = handPos;
                    // obj, deltaori, deltapos, initpos
                    helpers.transformObject(
                        thisHand.currentSelection,
                        rotation,
                        translation,
                        thisHand.grabStartPos);
                }
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
                if (thisHand.currentSelection) {
                    helpers.deselectObject(thisHand.currentSelection);
                    thisHand.currentSelection = null;
                }

                // TODO: don't highlight an object being held by the other hand
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
        verticalOffset: 250,
        scale: 0.5
    };
    controller.use('screenPosition', screenPositionOptions);
};
