var SCALE = 0.4;

var LeapCameraControls = function(env) {

    var triggerEvent = function(type, x, y) {
        var cx = Math.round(x * SCALE);
        var cy = Math.round(y * SCALE);
        var e = new MouseEvent(type, { clientX: cx, clientY: cy });
        document.dispatchEvent(e);
    };


    // Since rotate uses two hands, x and y should be proportional to the
    // x and y of the rightmost hand minus the x and y of the leftmost hand
    this.enableRotate = function(startX, startY) {
        triggerEvent("mousedown", startX, startY);
        env.setMode(0);
    };

    this.rotate = function(x, y) {
       triggerEvent("mousemove", x, y);
    };
    
    this.enableZoom = function(startZ) {
        triggerEvent("mousedown", 0, startZ);
        env.setMode(1);
    };

    this.zoom = function(z) {
       triggerEvent("mousemove", 0, z);
    };

    this.enablePan = function(startX, startY) {
        env.setMode(2);
        triggerEvent("mousedown", startX, startY);
    };
    
    this.pan = function(x, y) {
       triggerEvent("mousemove", x, y);
    };

    this.disable = function() {
        triggerEvent("mouseup");
        env.setMode(-1); //TODO: need to implement -1 as disable in env
    };

    return this;
};
