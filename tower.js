var FRAMES_PER_SECOND = 60.0;

// Simple structure to hold x and y coordinates.
function Coords(x, y) {
  this.x = x;
  this.y = y;
}

function GameCanvas(context, top, left, height, width) {
  this.context = context;
  this.top = top;
  this.left = left;
  this.height = height;
  this.width = width;
}

// Blank out the canvas between animation frames.
GameCanvas.prototype.clear = function() {
  this.context.clearRect(0, 0, this.width, this.height);
}

function TowerContext(world, canvas) {
  this.world = world;
  this.canvas = canvas;
}

// Remove all current objects from the physics simulation.
TowerContext.prototype.reset = function() {
  var b = this.world.m_bodyList;
  while (b) {
    var current = b;
    b = b.m_next;
    this.world.DestroyBody(current);
  }
  // ...but we should always have the ground. The loop above destroys it,
  // so we have to put it back.
  this.createGround();
};

// Add a rectangle to the simulation.
TowerContext.prototype.addBlock = function(x, y, height, width) {
	var boxSd = new b2BoxDef();
	boxSd.density = 1.0; 
	boxSd.restitution = 0.0;
	boxSd.friction = 1.0;
	boxSd.extents.Set(width, height);
	var boxBd = new b2BodyDef();
	boxBd.AddShape(boxSd);
	boxBd.position.Set(x, y);
	return this.world.CreateBody(boxBd)
};

// Add a rectangle wherever the user clicked. Left-click produces a
// vertical block, right-click produces a horizonal block.
TowerContext.prototype.handleClick = function(e) {
  // The click is ours, no-one else's.
  e.preventDefault();
  
  var height;
  var width;
  switch (e.button) {
    case 0:  // Left mouse button.
      height = 50;
      width = 15;
      break;
    case 1:  // Middle mouse button.
      return;
    case 2:  // Right mouse button.
      width = 50;
      height = 15;
      break;
  }

  var x = e.clientX;
  var y = e.clientY;
  
  this.addBlock(x, y, height, width);
};

TowerContext.prototype.handleScroll = function(e) {
  this.canvas.clear();
  var zoomSign = e.wheelDelta > 0 ? 1 : -1;
  var zoom = 1 + 0.05 * zoomSign;
  
  this.canvas.context.scale(zoom, zoom);
};

// We draw things exactly the same way real animation works: draw one
// frame, blank it out, draw one frame, blank it out, draw one frame, etc.
TowerContext.prototype.drawWorld = function() {
  this.canvas.clear();
  
  for (var b = this.world.m_bodyList; b; b = b.m_next) {
		for (var s = b.GetShapeList(); s != null; s = s.GetNext()) {
			this.drawShape(s);
		}
	}
};

TowerContext.prototype.getColor = function(shape) {
  var maxInertia = 250000.0;
  var rawVelocity = shape.GetBody().GetLinearVelocity().Length();
  var inertia = Math.min(Math.pow(rawVelocity, 2), maxInertia);

  // Faster-moving shapes are more red, slower-moving shapes are black.
  // This tries to provide a smooth gradient 
  var inertiaFrac = inertia / maxInertia;
  var colorVal = Math.floor(255 * inertiaFrac);
  return 'rgb(' + colorVal + ',0,0)';
};

// Draw a shape on the canvas. These are b2Shape objects from box2djs.
// This code shamelessly copied from the box2djs demos and then modified
// to suit my whim.
TowerContext.prototype.drawShape = function(shape) {
  var context = this.canvas.context;

  // Draw all shapes as solid, but with a white border so that each
  // shape is distinct.
  context.fillStyle = this.getColor(shape);
  context.strokeStyle = '#ffffff';
  context.beginPath();
	switch (shape.m_type) {
  	case b2Shape.e_circleShape:
		{
			var circle = shape;
			var pos = circle.m_position;
			var r = circle.m_radius;
			var segments = 16.0;
			var theta = 0.0;
			var dtheta = 2.0 * Math.PI / segments;
			// Draw the "circumference"; note that this isn't a true circle.
			// Try varying `segments` above to see the effect.
			context.moveTo(pos.x + r, pos.y);
			for (var i = 0; i < segments; i++) {
				var d = new b2Vec2(r * Math.cos(theta), r * Math.sin(theta));
				var v = b2Math.AddVV(pos, d);
				context.lineTo(v.x, v.y);
				theta += dtheta;
			}
			context.lineTo(pos.x + r, pos.y);

			// draw radius
			/*context.moveTo(pos.x, pos.y);
			var ax = circle.m_R.col1;
			var pos2 = new b2Vec2(pos.x + r * ax.x, pos.y + r * ax.y);
			context.lineTo(pos2.x, pos2.y);*/
		}
		break;
		
  	case b2Shape.e_polyShape:
		{
			var poly = shape;
			var tV = b2Math.AddVV(poly.m_position, b2Math.b2MulMV(poly.m_R, poly.m_vertices[0]));
			context.moveTo(tV.x, tV.y);
			for (var i = 0; i < poly.m_vertexCount; i++) {
				var v = b2Math.AddVV(poly.m_position, b2Math.b2MulMV(poly.m_R, poly.m_vertices[i]));
				context.lineTo(v.x, v.y);
			}
			context.lineTo(tV.x, tV.y);
		}
		break;
	}
	context.closePath();
	context.fill();
	context.stroke();
};

TowerContext.prototype.createGround = function() {
  var groundSd = new b2BoxDef();
	groundSd.extents.Set(300, 25);
	groundSd.restitution = 0.0;
	var groundBd = new b2BodyDef();
	groundBd.AddShape(groundSd);
	groundBd.position.Set(300, 575);
	return this.world.CreateBody(groundBd);
};

// Initialize both the drawing loops and the physics simulation loops.
// These are done independently in case we want to speed up the physics.
TowerContext.prototype.loop = function() {
  this.createGround();
  setInterval(this.simulationStep.bind(this), 1000 / FRAMES_PER_SECOND);
  setInterval(this.drawWorld.bind(this), 1000 / FRAMES_PER_SECOND);
};

TowerContext.prototype.simulationStep = function() {
  var timeStep = 1 / FRAMES_PER_SECOND;
	var iteration = 1;
	this.world.Step(timeStep, iteration);
};

// Start a little tower-defense + Jenga game.
var towerInit = function() {
  var world = initWorld();
  
  var canvas = $('tower-canvas');
  var canvasContext = getCanvas(canvas);

  var towerContext = new TowerContext(world, canvasContext);

  var clickHandler = towerContext.handleClick.bind(towerContext);
  canvas.observe('click', clickHandler);
  canvas.observe('dblclick', clickHandler);
  canvas.observe('contextmenu', clickHandler);
  //canvas.observe('mousewheel', towerContext.handleScroll.bind(towerContext));
  
  $('tower-reset').observe('click', towerContext.reset.bind(towerContext));
  $('deploy-attacker').observe('click', function() { deployAttacker(towerContext); });
  
  towerContext.loop();
};

// Initialize the "world" of the physics simulator.
var initWorld = function() {
	var worldAABB = new b2AABB();
	worldAABB.minVertex.Set(0, 0);
	worldAABB.maxVertex.Set(800, 800);
	var gravity = new b2Vec2(0, 300);
	var doSleep = true;
	return new b2World(worldAABB, gravity, doSleep);
};

// Obtain the canvas that we'll be drawing all shapes on.
var getCanvas = function(canvasElem) {
  var ctx = canvasElem.getContext('2d');
	canvasWidth = parseInt(canvasElem.width);
	canvasHeight = parseInt(canvasElem.height);
	canvasTop = parseInt(canvasElem.style.top);
	canvasLeft = parseInt(canvasElem.style.left);
	return new GameCanvas(ctx, canvasTop, canvasLeft, canvasHeight, canvasWidth);
};

var createShot = function(towerContext, start, radius) {
  var ballSd = new b2CircleDef();
	ballSd.density = 10.0;
	ballSd.radius = radius;
	ballSd.restitution = 0.5;
	ballSd.friction = 1.0;
	var ballBd = new b2BodyDef();
	ballBd.AddShape(ballSd);
	ballBd.position.Set(start.x, start.y - 15);
	ballBd.allowSleep = true;
	ballBd.bullet = true;
	return towerContext.world.CreateBody(ballBd);
};

var fireCannon = function(towerContext, start, maxShots) {
  var shot = createShot(towerContext, start, 5);
  var velocity = new b2Vec2(600, -300);
  velocity.Multiply(shot.GetMass());
  // Vary the exact trajectory of the shot to make it more interesting.
  velocity.x *= 0.5 + (Math.random() * 0.8);
  velocity.y *= 0.5 + (Math.random() * 0.8);
  shot.ApplyImpulse(velocity, shot.GetWorldPoint(new b2Vec2(0, 0)));
  
  // Destroy the cannon shots after a timeout so that we don't end up with hundreds
  // of them.
  setTimeout(function() { towerContext.world.DestroyBody(shot); }, 4000);
  
  // Fire the next shot after a 500ms delay.
  if (maxShots > 0) {
    setTimeout(function() { fireCannon(towerContext, start, maxShots - 1) }, 500);
  }
};

// Create a small square at the given coordinates to "fire" the cannon shots.
var createTurret = function(towerContext, start) {
  var turretSd = new b2BoxDef();
	turretSd.extents.Set(15, 15);
	turretSd.restitution = 0.0;
	var turretBd = new b2BodyDef();
	turretBd.AddShape(turretSd);
	turretBd.position.Set(start.x, start.y);
	return towerContext.world.CreateBody(turretBd);
};

// Create a little turret that will shoot 20 times at a tower to its right.
var deployAttacker = function(towerContext) {
  var start = new Coords(100, 500);
  var turret = createTurret(towerContext, start);
  var maxShots = 20;
  // Fire the first shot after a 250 ms delay; this is less startling to the user.
  setTimeout(function() { fireCannon(towerContext, start, maxShots) }, 250);
};

// FlowerContext inherits from TowerContext;
function FlowerContext(world, canvas) {
  TowerContext.call(this, world, canvas);
}
FlowerContext.prototype = Object.create(TowerContext.prototype);

// Pad out a string to a given length with leading zeros.
function zfill(str, len) {
  while (str.length < len) {
    str = "0" + str
  }
  return str;
}

// Get a color for the given shape based on its moment of inertia.
FlowerContext.prototype.getColor = function(shape) {
  var maxInertia = 250000.0;
  var rawVelocity = shape.GetBody().GetLinearVelocity().Length();
  var inertia = Math.min(Math.pow(rawVelocity, 2), maxInertia);

  // In practice, this will yield colors between cyan and navy blue.
  var inertiaFrac = inertia / maxInertia;
  var colorVal = Math.floor(65000 * inertiaFrac);
  return '#' + zfill(colorVal.toString(16), 6);
}

// Initialize the colorful flower display.
var flowerInit = function() {
  var world = initWorld();
  
  var canvas = $('tower-canvas');
  var canvasContext = getCanvas(canvas);
  var flowerContext = new FlowerContext(world, canvasContext);

  // Get rid of the tower game-specific chunks of text.
  $('tower-controls').hide();

  // Start the process of shooting flares into the sky, and loop to both run the
  // physics simulation and to draw the animation frames.
  setTimeout(function(){ startFlower(flowerContext) }, 0);
  flowerContext.loop();
};

// Fire a flare straight up from the starting point, with some random side-to-side
// variation. Flares will be deleted after 5 seconds.
// Args:
//   flowerContext: FlowerContext object.
//   start: Coords object.
var shootFlare = function(flowerContext, start) {
  var radius = 3 + Math.random() * 5;
  var shot = createShot(flowerContext, start, radius);
  
  // Vary the horizonal impulse to make it more visually interesting.
  var horzRange = 60;
  var horzImpulse = -(horzRange / 2) + Math.random() * horzRange;
  var velocity = new b2Vec2(horzImpulse, -550);
  velocity.Multiply(shot.GetMass());
  shot.ApplyImpulse(velocity, shot.GetWorldPoint(new b2Vec2(0, 0)));
  
  // Destroy this flare after five seconds. We don't want to grind the display
  // to a halt.
  setTimeout(function() { flowerContext.world.DestroyBody(shot); }, 5000);
  
  // Create a new flare every 50 milliseconds.
  setTimeout(function() { shootFlare(flowerContext, start) }, 50);
};

// Begin the process of shooting colored flares up from the middle of the
// display.
var startFlower = function(flowerContext) {
  var start = new Coords(300, 570);
  
  // Use setTimeout(x, 0) so that we don't block this thread of execution.
  setTimeout(function() { shootFlare(flowerContext, start)}, 0);
};