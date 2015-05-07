var LeapCameraControls = function(env) {

    var self = {};

    var triggerEvent = function(type, x, y) {
	var e = jQuery.Event(type);
	e.pageX = x;
	e.pageY = y;
	$(document).trigger(e);
    };


    // Since rotate uses two hands, x and y should be proportional to the
    // x and y of the rightmost hand minus the x and y of the leftmost hand
    self.enableRotate = function(startX, startY) {
	triggerEvent("mousedown", startX, startY);
	env.setMode(0);
    };

    self.rotate = function(x, y) {
	triggerEvent("mousemove", x, y);
    };
    
    self.enableZoom = function(startZ) {
	triggerEvent("mousedown", 0, startZ);
	env.setMode(1);
    };

    self.zoom = function(z) {
	triggerEvent("mousemove", 0, z);
    };

    self.enablePan = function(startX, startY) {
	triggerEvent("mousedown", startX, startY);
	env.setMode(2);
    };
    
    self.pan = function(x, y) {
	triggerEvent("mousemove", x, y);
    };

    self.disable = function() {
	triggerEvent("mouseup");
	env.setMode(-1); //TODO: need to implement -1 as disable in env
    };
