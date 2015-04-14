// Adds functionality for the mouse
var MouseInterface = function(env) {
    
    // Select an object when the mouse presses down on it
    $(document).mousedown(function(e) {
	env.selectObject(e.clientX, e.clientY);
    });
    
    // Do all the associated cursor move events when the mouse moves
    $(document).mousemove(function(e) {
	env.cursorMove(e.clientX, e.clientY);
    });

    // Deselect an object when the mouse lifts up
    $(document).mouseup(function(e) {
	env.deselectObject(e.clientX, e.clientY);
    });

    // Stores the labels and onClick events for each GUI button
    var buttons = {
	Modes: [
	    {label: "Camera Rotate", onClick: function() { env.setMode(0); }},
	    {label: "Camera Zoom", onClick: function() { env.setMode(1); }},
	    {label: "Camera Pan", onClick: function() { env.setMode(2); }}
	],

	Actions: [
	    {label: "Add Cube", onClick: function() { env.addCube(); }}
	]
    };

    // Populates the GUI with the info stored in the buttons object
    for (var key in buttons) {
	var group = buttons[key];
	var elem = document.createElement("div");
	$(elem).append(key);
	for (var i in group) {
	    $(elem).append("</br>");
	    var b = document.createElement("button");
	    $(b).text(group[i].label);
	    $(b).click(group[i].onClick);
	    $(elem).append(b);
	}
	$('body').append(elem);
    }

};
	
