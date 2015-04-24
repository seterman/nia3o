/* 
This file contains some theoretical code that would help facilitate the operations in our case 
scenario. It would be useful to actually implement the functions that are called from this file,
but they're not yet.
*/

var insertObject, grabObject, transformObject, dropObject;

$(document).ready(function() {

    // Color constants
    var SELECT_COLOR = 0xff0000;
    var DEFAULT_COLOR = 0x00ff00;

    // Object type enumerables
    var OBJECT_TYPES = {
	PLANE: 0,
	CONE: 1
    };

    // Keeps track of what planes could potentially cut which objects.
    // Elements are of the form {plane: planeObj, objects: [array of objects intersected by the plane]}
    var toBeSplit = [];

    // Removes the first element from toBeSplit whose plane property equals the passed in plane.
    var removePotentialSplit(plane) {
	if (plane.type == OBJECT_TYPES.PLANE) {
            for (var i in toBeSplit) {
                if (plane == toBeSplit[i].plane) {
                    toBeSplit.splice(i, 1);
		    break;
                }
            }
        }
    };

    // Inserts an object and makes it appear selected.
    // Returns the object.
    insertObject = function(type, pos) {
	var selectedObj = Env.insertObject(type, pos);
	Env.setObjectColor(selectedObj, SELECTED_COLOR);
	return selectedObj;
    };

    // Figures out what object is being grabbed and makes it appear selected.
    // Returns the object.
    grabObject = function(pos) {
	var selectedObj = Env.getIntersectingObject(pos);
	if (selectedObj) {
	    Env.setObjectColor(selectedObj, SELECTED_COLOR);
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
    transformObject = function(obj, deltaOri, deltaPos, initPos) {

	var selectedObj = obj;

	// Check if the object is part of a potential split
	loop:
	for (var i in toBeSplit) {
	    var potentialSplit = toBeSplit[i];
	    for (var j in potentialSplit.objects) {
		if (obj == potentialSplit.objects[j]) {

		    // Split the object and grab the appropriate piece
		    Env.setObjectColor(obj, DEFAULT_COLOR);
		    Env.splitObject(obj, potentialSplit.plane);
		    selectedObj = grabObject(initPos);

		    // Remove the corresponding data from toBeSplit
		    potentialSplit.objects = Env.getCollidingObjects(potentialSplit.plane);
		    if (potentialSplit.objects.length == 0) {			
			toBeSplit.splice(i, 1);
		    }
		    break loop; // prevent problems with changing indicies and 
		                // keep semantics simple by only cutting one 
		                // object along one plane at a time.
		}
	    }
	}
	
	// Actually transform the object
	Env.transformObject(selectedObj, deltaOri, deltaPos); 

	// If the transformed object is a plane, update the potential split
	if (selectedObj.type == OBJECT_TYPES.PLANE) {
	    removePotentialSplit(selectedObj);
	    toBeSplit.push({plane: selectedObj, objects: Env.getCollidingObjects(obj)});
	}

	return selectedObj;
    };	
    
    // Make the object appear not selected.
    // Returns null for ease of assigning selected objects.
    dropObject = function(obj) {
	Env.setObjectColor(obj, DEFAULT_COLOR);
	return null; // Expliciyly return null, just in case.
    };

});
