var CallbackHelpers = function() {

    var helpers = {};
    
    // Color constants
    var SELECTED_COLOR = 0xff0000;
    var HIGHLIGHT_COLOR = 0x0000ff;
    var DEFAULT_COLOR = 0x009900;
    var PLANE_COLOR = 0xffffff;

    // Object type enumerables
    helpers.OBJECT_TYPES = {
	PLANE: 0,
	CONE: 1,
	CUBE: 2,
	SPHERE: 3,
	CYLINDER: 4
    };

    // Keeps track of splits so that they can be remerged if the plane moves.
    // Elements are of the form {
    //    planeName: the name of the plane, 
    //    pieceNames: an array of the names of the split pieces,
    //    wholeObject: a copy of the object before it was split
    // }
    var splits = [];

    // Finalizes a split given a piece name. Also removes the plane if all of
    // its colliding objects have been officially split.
    var removeSplitByPieceName = function(name) {
	var planeName;
	var removePlane = true;

	// remove the split from splits
	for (var i in splits) {
	    for (var j in splits[i].pieceNames) {
		if (name == splits[i].pieceNames[j]) {
		    planeName = splits[i].planeName;
		    splits.splice(i, 1);
		    break;
		}
	    }
	}
	
	// check if the plane should be removed
	if (planeName) {
	    for (var i in splits) {
		if (splits[i].planeName == planeName) {
		    removePlane = false;
		    break;
		}
	    }
	    // remove the plane
	    if (removePlane) {
		env.removeByName(planeName);
	    }
	}
    };
	    

    // Inserts an object and makes it appear selected.
    // Returns the object.
    helpers.insertObject = function(type, pos) {
	var selectedObj = env.insertObject(type, pos);
	env.setObjectColor(selectedObj, SELECTED_COLOR);
	return selectedObj;
    };

    // Figures out what object is being grabbed and makes it appear selected.
    // Returns the object.
    helpers.selectObjectByPos = function(pos) {
	var selectedObj = env.getObjectByIntersection(pos);
	if (selectedObj) {
	    env.setObjectColor(selectedObj, SELECTED_COLOR);
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
    helpers.transformObject = function(obj, deltaOri, deltaPos, initPos) {
	var selectedObj = obj;
	// If the object is a plane, remerge its split pieces.
	if (selectedObj.userData.isPlane) {
	    for (var i = splits.length-1; i >= 0; i--) {
		if (splits[i].planeName == selectedObj.name) {
		    // remove each piece
		    for (var j in splits[i].pieceNames) {
			env.removeByName(splits[i].pieceNames[j]);
		    }
		    // re-add the original object
		    env.addObject(splits[i].wholeObject);
		    splits.splice(i, 1);
		}
	    }
	}
	// If the object isn't a plane, finalize the split.
	else {
	    removeSplitByPieceName(selectedObj.name);
	}

	// Actually transform the object
	env.transformObject(selectedObj, deltaOri, deltaPos); 

	return selectedObj;
    };	

    // Make the object appear not selected.
    // Returns null for ease of assigning selected objects.
    helpers.deselectObject = function(obj) {
	// If the object is a plane, preliminarily split the 
	// objects it intersects
	if (obj.userData.isPlane) {
	    // Planes get a different color
	    env.setObjectColor(obj, PLANE_COLOR);

	    var collisions = env.getCollidingObjectNames(obj);
	    for (var i in collisions) {
		var split = {
		    planeName: obj.name,
		    pieceNames: [],
		    wholeObject: env.getObjectByName(collisions[i])
		};
		var pieces = env.splitObject(collisions[i], obj);
		for (var j in pieces) {
		    split.pieceNames.push(pieces[j].name);
		}
		splits.push(split);
	    }
	}
	else {
	    env.setObjectColor(obj, DEFAULT_COLOR);
	}
	return null; // Expliciyly return null, just in case.
    };

    helpers.highlightObjectByPos = function(pos) {
	var selectedObj = env.getObjectByIntersection(pos);
	if (selectedObj) {
            env.setObjectColor(selectedObj, HIGHLIGHT_COLOR);
	}
	return selectedObj;
    };

    helpers.clearHighlight = function(obj) {
	if (obj) {
            env.setObjectColor(obj, obj.userData.isPlane ? PLANE_COLOR : DEFAULT_COLOR);
	}
	return null;
    };

    return helpers;

};
