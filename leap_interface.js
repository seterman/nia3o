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

var camCtls;

///////////////////////////////////////////////////////////////////////////////
// Grabbing and rotation helpers
///////////////////////////////////////////////////////////////////////////////

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

var deltaPos = function(p1, p2) {
    return {
        x: p2.x - p1.x,
        y: p2.y - p1.y,
        z: p2.z - p1.z
    };
};

var smallestAxis = function(v) {
    var x = Math.abs(v.x);
    var y = Math.abs(v.y);
    var z = Math.abs(v.z);
    if (x < y && x < z) return 'x';
    if (y < x && y < z) return 'y';
    return 'z';
};

///////////////////////////////////////////////////////////////////////////////
// GUI
///////////////////////////////////////////////////////////////////////////////

var binContainer = $('<div class="bin-container">');
// var addCubeBtn = $('<div class="bin">Cube Bin</div>');
// binContainer.append(addCubeBtn);
var coneBin = $('<div class="bin">Cone Bin</div>');
var planeBin = $('<div class="bin">Plane Bin</div>');
var trash = $('<div class="trash">Trash</div>');
binContainer.append(coneBin, planeBin, trash);

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
    // camCtls = LeapCameraControls(env);

    // env.addCubes();

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
    var CAM_TRANSLATE_SCALE = 0.01;
    var CAM_ROTATE_SCALE = 0.002;
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
            grabbingCam: false,
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
            lastDifference: { x: 0, y: 0, z: 0 }, // NOTE this is different from left!
            grabEndProcessed: false,
            currentSelection: null,
            currentHighlight: null,
            grabbingCam: false,
        }
    };
    handState.left.otherHand = handState.right;
    handState.right.otherHand = handState.left;

    ///////////////////////////////////////////////////////////////////////////
    // Grab handling
    ///////////////////////////////////////////////////////////////////////////

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
        } else if (s.intersectingCam) {
            s.intersectingCam.addClass("held-by-"+s.handType);

            s.handState.grabbingCam = true;
            // console.log('grabbing cam with', s.handType,'hand');
            if (s.handState.otherHand.grabbingCam) {
                // console.log('enabling rotation');
                // camCtls.disable();

                var difference = deltaPos(s.handPos, s.handState.otherHand.lastPos);
                // camCtls.enableRotate(difference.x, difference.y);
                // Only the right hand tracks the difference in position between
                // hands
                handState.right.lastDifference = difference;
            } else {
                // console.log('enabling zoom/pan');
                // camCtls.enablePan(s.handPos.x, s.handPos.y);
            }
        } else {
            var selection = helpers.selectObjectByPos(s.handPos);
            if (selection != s.handState.otherHand.currentSelection) {
                s.handState.currentSelection = selection;
            }
        }
    };

    // TODO!!!!!! figure out why moving lags weirdly after an object is placed
    var handleGrabActive = function(s) {
        if (s.handState.grabbingCam) {
            // console.log('cam moving');
            // if (s.handType == 'right' && s.handState.otherHand.grabbingCam) {
            //     console.log('both hands grabbing cam');
            // }

            var d, delta;
            if (s.handState.otherHand.grabbingCam) {
                // Make sure we don't double count rotation
                if (s.handType == 'right') {
                    // Rotate
                    // console.log('current hand pos:', s.handPos);
                    // console.log('other hand pos:', s.handState.otherHand.lastPos);
                    var thisPos = s.handPos;
                    var otherPos = s.handState.otherHand.lastPos;
                    var currentDiff = deltaPos(thisPos, otherPos);
                    // console.log('current delta:', currentDiff);
                    var lastDiff = s.handState.lastDifference;

                    var movement = deltaPos(currentDiff, lastDiff);
                    var mag = new THREE.Vector3(movement.x, movement.y, movement.z).length();
                    if (mag > 2) {

                        // x and y changing more than z -> rotate around z axis
                        // x and z changing more than y -> rotate around y axis
                        // y and z changing more than x -> rotate around x axis
                        var f = function(a, b) {
                            if (Math.abs(a) > Math.abs(b)) return a;
                            return b;
                        };

                        var dx, dy, dz;
                        var z = thisPos.y < otherPos.y ? movement.z : -movement.z;
                        dx = f(z, -movement.y);
                        var x1 = thisPos.z > otherPos.z ? movement.x : -movement.x;
                        dy = f(x1, -movement.z);
                        var x2 = thisPos.y > otherPos.y ? movement.x : -movement.x;
                        dz = f(x2, -movement.y);

                        delta = new THREE.Vector3(dx, dy, dz);
                        delta.multiplyScalar(CAM_ROTATE_SCALE);

                        env.transformCamera(delta, new THREE.Vector3(0,0,0));

                        s.handState.lastDifference = currentDiff;
                    }
                }
            } else {
                // console.log('pan/zooming');
                // camCtls.pan(s.handPos.x, s.handPos.y);
                // camCtls.zoom(s.handPos.z - s.handState.lastPos.z);
                d = deltaPos(s.handPos, s.handState.lastPos);
                // vertical axis must be inverted
                delta = new THREE.Vector3(d.x, -d.y, d.z);
                delta.multiplyScalar(CAM_TRANSLATE_SCALE);
                env.transformCamera(new THREE.Vector3(0,0,0), delta);
            }

        } else if (s.handState.currentSelection) {
            // transform the selected object

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
            // s.handState.lastPos = s.handPos;

            // do the transform
            helpers.transformObject(
                s.handState.currentSelection,
                rotation,
                translation,
                s.handState.grabStartPos);
        }
        // update the last position
        s.handState.lastPos = s.handPos;
    };

    var handleNoGrab = function(s) {
        s.handState.grabStartFrame = null;
        $('.held-by-'+s.handType).removeClass('held-by-'+s.handType);

        // if we are letting go of the camera, reset camera controls
        // depending on what the other hand is doing
        // if (s.handState.grabbingCam) {
        //     camCtls.disable();
        //     if (s.handState.otherHand.grabbingCam) {
        //         var p = s.handState.otherHand.lastPos;
        //         camCtls.enablePan(p.x, p.y);
        //     }
        // }
        s.handState.grabbingCam = false;

        if (s.handState.currentSelection) {
            helpers.deselectObject(s.handState.currentSelection);
            if (s.intersectingTrash) {
                env.removeByName(s.handState.currentSelection.name);
            }
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
    cubeBin.click(function(evt, handType, handPos) {
        var pos = { x: handPos.x, y: handPos.y, z: leapZToSceneZ(handPos.z) };
        handState[handType].currentSelection = helpers.insertObject(OBJECT_TYPES.CUBE, pos);
    });
    cylBin.click(function(evt, handType, handPos) {
        var pos = { x: handPos.x, y: handPos.y, z: leapZToSceneZ(handPos.z) };
        handState[handType].currentSelection = helpers.insertObject(OBJECT_TYPES.CYLINDER, pos);
    });
    sphereBin.click(function(evt, handType, handPos) {
        var pos = { x: handPos.x, y: handPos.y, z: leapZToSceneZ(handPos.z) };
        handState[handType].currentSelection = helpers.insertObject(OBJECT_TYPES.SPHERE, pos);
    });
    $('body').prepend(binContainer);
    $('body').append(cameraHandleLeft, cameraHandleRight);

    var hideCamCtls = function() {
        cameraHandleRight.hide();
        cameraHandleLeft.hide();
    };
    var showCamCtls = function() {
        cameraHandleRight.show();
        cameraHandleLeft.show();
    };

    ///////////////////////////////////////////////////////////////////////////
    // Leap controller
    ///////////////////////////////////////////////////////////////////////////
    var controllerOptions = {};
    var controller = Leap.loop(controllerOptions, function(frame) {
        // var rhScope = this.plugins.riggedHand;
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
            var intersectingTrash = findIntersecting(handPos, $('.trash'));
            updateIntersectionHighlights(
                intersectingBin || intersectingCam || intersectingTrash,
                handType);

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
                'intersectingTrash': intersectingTrash,
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
        verticalOffset: 400,
        scale: 0.5
    };
    controller.use('screenPosition', screenPositionOptions);
};
