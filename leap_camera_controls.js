var SCALE = 0.4;
var ZOOM_SCALE = -1.5;

var LeapCameraControls = function(env) {

    var triggerEvent = function(type, x, y) {
        var cx = Math.round(x * SCALE);
        var cy = Math.round(y * SCALE);
        var e = new MouseEvent(type, { clientX: cx, clientY: cy });
        document.dispatchEvent(e);
    };

    var triggerScrollEvent = function(amt) {
        var e = new WheelEvent('wheel', { deltaY: Math.round(amt) });
        document.dispatchEvent(e);
    };

    // Since rotate uses two hands, x and y should be proportional to the
    // x and y of the rightmost hand minus the x and y of the leftmost hand
    this.enableRotate = function(startX, startY) {
        env.setMode(0);
        triggerEvent("mousedown", startX, startY);
    };

    this.rotate = function(x, y) {
       triggerEvent("mousemove", x, y);
    };
    
    // unneeded since zoom was switched to use the mousewheel
    // this.enableZoom = function(startZ) {
    //     env.setMode(1);
    //     triggerEvent("mousedown", 0, startZ);
    // };

    this.zoom = function(z) {
        triggerScrollEvent(z * ZOOM_SCALE);
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
