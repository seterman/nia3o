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

var cameraHandleRight = $('<div class="camera-handle camera-handle-right">');
var cameraHandleLeft = $('<div class="camera-handle camera-handle-left">');

// indicate which (if any) of the controls are underneath the given
// position. Return false if no element intersects POS, or the element
// if one does intersect
// TODO: does the handEntry plugin do this automatically?
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

// find intersecting shape bins
var findIntersectingBin = function(pos) {
    var bins = $('.bin');
    return findIntersecting(pos, bins);
};

var findIntersectingCameraHandle = function(pos) {
    var handles = $('.camera-handle');
    return findIntersecting(pos, handles);
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
// Post-load setup
///////////////////////////////////////////////////////////////////////////////

var LeapInterface = function(env) {
    ///////////////////////////////////////////////////////////////////////////
    // Helpers
    ///////////////////////////////////////////////////////////////////////////

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

    ///////////////////////////////////////////////////////////////////////////
    // Hand state
    ///////////////////////////////////////////////////////////////////////////
    
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


    var handleGrabStart = function(s) {
        s.handState.grabStartProcessed = true;
        s.handState.grabStartFrame = s.frame;
        s.handState.grabStartPos = s.handPos;
        s.handState.lastPos = s.handPos;
        s.handState.lastAngle = getAngle(s.leapHand);
        s.handState.residualRotation = new THREE.Vector3(0, 0, 0);

        // if an object is being highlighted, clear it so
        // that we can pick it up without weird state problems
        if (s.handState.currentHighlight !== null) {
            helpers.clearHighlight(s.handState.currentHighlight);
            s.handState.currentHighlight = null;
        }

        if (s.intersectingBin) {
            s.intersectingBin.trigger('click', [s.handType, s.handPos]);
        } else {
            var selection = helpers.selectObjectByPos(s.handPos);
            if (selection != s.handState.otherHand.currentSelection) {
                s.handState.currentSelection = selection;
            }
        }
    };

    // TODO!!!!!! figure out why moving is weird after an object is placed
    var handleGrabActive = function(s) {
        // transform the selected object
        if (s.handState.currentSelection) {
            // rotation since one frame ago
            // takes an exponentially weighted moving average
            // this needs tweaking, probably
            var currentAngle = getAngle(s.leapHand);
            var rotation = currentAngle.sub(s.handState.lastAngle);
            s.handState.lastAngle = currentAngle;
            rotation.multiplyScalar(1-EWMA_ROT_FRAC);
            rotation.add(s.handState.residualRotation.multiplyScalar(EWMA_ROT_FRAC));
            s.handState.residualRotation = rotation.clone();

            // planes do not rotate
            if (s.handState.currentSelection.userData.isPlane) {
                rotation = new THREE.Vector3(0, 0, 0);
            }

            // translation since one frame ago
            var lastXformPos = handPosToTransformPos(s.handState.lastPos);
            var currentXformPos = handPosToTransformPos(s.handPos);
            var translation = currentXformPos.sub(lastXformPos);
            s.handState.lastPos = s.handPos;

            // do the transform
            helpers.transformObject(
                s.handState.currentSelection,
                rotation,
                translation,
                s.handState.grabStartPos);
        }
    };

    var handleNoGrab = function(s) {
        s.handState.grabStartFrame = null;
        if (s.handState.currentSelection) {
            helpers.deselectObject(s.handState.currentSelection);
            s.handState.currentSelection = null;
        }

        // TODO: don't highlight an object being held by the other hand
        var newHighlight = helpers.highlightObjectByPos(s.handPos);
        if (newHighlight != s.handState.currentHighlight) {
            helpers.clearHighlight(s.handState.currentHighlight);
        }
        s.handState.currentHighlight = newHighlight;
    };

    ///////////////////////////////////////////////////////////////////////////
    // Setup GUI elements
    ///////////////////////////////////////////////////////////////////////////
    coneBin.click(function(evt, handType, handPos) {
        var pos = { x: handPos.x, y: handPos.y, z: leapZToSceneZ(handPos.z) };
        handState[handType].currentSelection = helpers.insertObject(OBJECT_TYPES.CONE, pos);
    });
    planeBin.click(function(evt, handType, handPos) {
        var pos = { x: handPos.x, y: handPos.y, z: leapZToSceneZ(handPos.z) };
        handState[handType].currentSelection = helpers.insertObject(OBJECT_TYPES.PLANE, pos);
    });
    $('body').prepend(binContainer);
    $('body').append(cameraHandleLeft, cameraHandleRight);

    ///////////////////////////////////////////////////////////////////////////
    // Leap controller
    ///////////////////////////////////////////////////////////////////////////
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
            var intersectingCam = findIntersectingCameraHandle(handPos);
            updateIntersectionHighlights(
                intersectingBin || intersectingCam, handType);

            // Move the interface cursors
            var c = thisHand.cursor;
            c.setPosition(handPos);
            c.show();

            var scopeInfo = {
                'handState': thisHand,
                'leapHand': hand,
                'handPos': handPos,
                'handType': handType,
                'intersectingBin': intersectingBin,
                'intersectingCam': intersectingCam,
            };

            // Process grab state
            if (grabState == 'grabStart' && !thisHand.grabStartProcessed) {
                handleGrabStart(scopeInfo);
            }
            if (grabState == 'grabbing') {
                handleGrabActive(scopeInfo);
            }
            if (grabState == 'grabEnd' && !thisHand.grabEndProcessed) {
                // grab ended
                // this is finicky. Does not always seem to run, so
                // all essential clearing should go in notGrabbing
                thisHand.grabEndProcessed = true;
                thisHand.grabStartFrame = null;
            }
            if (grabState == 'notGrabbing') {
                handleNoGrab(scopeInfo);
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
        verticalOffset: 300,
        scale: 0.5
    };
    controller.use('screenPosition', screenPositionOptions);
};
