/* 
This file contains some theoretical code that would help facilitate the operations in our case 
scenario. It would be useful to actually implement the functions that are called from this file,
but they're not yet.
*/

var insertObject, highlightObjectByPos, selectObjectByPos, splitAndTransformObject, deselectObject;

// Color constants
var SELECT_COLOR = 0xff0000;
var HOVER_COLOR = 0x0000ff;
var DEFAULT_COLOR = 0x00ff00;

// Object type enumerables
var OBJECT_TYPES = {
    PLANE: 0,
    CONE: 1
};

// Keeps track of what planes could potentially cut which objects.
// Elements are of the form {plane: planeObj, objects: [array of objects intersected by the plane]}
// var toBeSplit = [];
var planesToSplitees = {};
// // Removes the first element from planesToSplitees whose plane property equals the passed in plane.
// var removePotentialSplit = function(plane) {
//     if (plane.type == OBJECT_TYPES.PLANE) {
//         for (var i in planesToSplitees) {
//             if (plane == planesToSplitees[i].plane) {
//                 planesToSplitees.splice(i, 1);
//                 break;
//             }
//         }
//     }
// };

var prepareHelpers = function(Env) {
    var helpers = {};

    // Inserts an object and makes it appear selected.
    // Returns the object.
    helpers.insertObject = function(type, pos) {
        var newObj = Env.insertObject(type, pos);
        Env.setObjectColor(newObj, SELECT_COLOR);
        return newObj;
    };

    helpers.highlightObjectByPos = function(pos) {
        var highlightedObj = Env.getObjectByIntersection(pos);
        if (highlightedObj) {
            Env.setObjectColor(highlightedObj, HOVER_COLOR);
        }
        return highlightedObj;
    };

    helpers.clearHighlight = function(obj) {
        if (obj) {
            Env.setObjectColor(obj, DEFAULT_COLOR);
        }
        return null;
    };

    // Figures out what object is being grabbed and makes it appear selected.
    // Returns the object.
    helpers.selectObjectByPos = function(pos) {
        var selectedObj = Env.getObjectByIntersection(pos);
        if (selectedObj) {
            Env.setObjectColor(selectedObj, SELECT_COLOR);
        }
        return selectedObj;
    };

    // Transforms (translates and rotates) an object and returns it.
    // If the object is part of a potential split, split the object and
    // transform/return the piece the user is grabbing. 
    //
    // obj      - the object to transform
    // deltaOri - the change in orientation since the last call
    // deltaPos - the change in position since the last call
    // initPos  - the position when the user first grabbed the object,
    //            used to select the proper piece if an object is split
    //
    // To only translate or only rotate an object, simply set the 
    // undesired delta parameter to be all zeros. 
    helpers.splitAndTransformObject = function(obj, deltaOri, deltaPos, initPos) {
        var selectedObj = obj;

        // Check if the object is part of a potential split
        for (var plane in planesToSplitees) {
            if (obj in planesToSplitees[plane]) {
                Env.setObjectColor(obj, DEFAULT_COLOR);
                Env.splitObject(obj, plane);
                selectedObj = selectObjectByPos(initPos);

                var newCollisions = Env.getCollidingObjects(plane);
                if (newCollisions.length === 0) {
                    // TODO: actually remove the plane
                    delete planesToSplitees[plane];
                } else {
                    planesToSplitees[plane] = newCollisions;
                }
                // prevent problems with changing indicies and 
                // keep semantics simple by only cutting one 
                // object along one plane at a time.
                break;
            }
        }
    
        // Actually transform the object
        Env.transformObject(selectedObj, deltaOri, deltaPos);

        // If the transformed object is a plane, update the potential split
        if (selectedObj.type == OBJECT_TYPES.PLANE) {
            planesToSplitees[selectedObj] = Env.getCollidingObjects(selectedObj);
        }

        return selectedObj;
    };
    
    // Make the object appear not selected.
    // Returns null for ease of assigning selected objects.
    helpers.deselectObject = function(obj) {
        if (obj) {
            Env.setObjectColor(obj, DEFAULT_COLOR);
        }
        return null; // Explicitly return null, just in case.
    };

    return helpers;

};
