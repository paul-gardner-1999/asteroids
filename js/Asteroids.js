class GameObject {
    constructor(game, style, coordinates, velocity, radius) {
        this.game = game;
        this.style = style;
        this.coordinates = coordinates;
        this.radius = radius;
        this.velocity = velocity;
    }
    get graphics() { return this.game.graphics; }

    move() {
        let width = this.graphics.width;
        let height = this.graphics.height;
        this.coordinates.x += this.velocity.x;
        if (this.coordinates.x <= 0) {
            this.coordinates.x += width;
        } else if (this.coordinates.x >= width) {
            this.coordinates.x -= width;
        }

        this.coordinates.y += this.velocity.y;
        if (this.coordinates.y <= 0) {
            this.coordinates.y += height
        } else if (this.coordinates.y >= height) {
            this.coordinates.y -= height
        }
    }

    calcPoint(coords, radius, angleDegrees) {
        let angle = Math.PI * angleDegrees / 180.0;
        let x = coords.x + radius * Math.cos(angle);
        let y = coords.y + radius * Math.sin(angle + Math.PI);
        return {x: x, y: y};
    }

    draw() {
        // No-Op
    }
}

class Polygon extends GameObject {
    constructor(game, poly, style, coordinates, velocity, radius) {
        super(game, style, coordinates, velocity, radius);
        this.poly = poly;
        this.points = [];
        this.magnification = 1;
    }

    move() {
        super.move();

        for (let i = 0; i < (this.poly.length / 2); i++) {
            let angle = this.angle + this.poly[i * 2];
            let distance = this.poly[i * 2 + 1] * this.magnification;
            this.points[i] = this.calcPoint(this.coordinates, distance, angle)
        }
    }


    draw() {
        if (this.points.length === 0) return;
        if (this.style) {
            this.graphics.polyfill(this.style, this.points);
        } else {
            this.graphics.drawPolyline(this.points);
        }
    }
    /*
     * Calculate the distance from the center of 'this' object to the x,y coordinates.
     */
    distanceFrom(x,y)    {
        let square = function (x) {
            return x * x;
        }
        let distance = Math.sqrt(square(this.coordinates.x - x) + square(this.coordinates.y - y));
        return distance;
    }

    pointCollision(x, y) {
        let crossed = false;
        let points = this.points;
        if (this.distanceFrom(x,y) > this.radius) {
            return false;
        }
        for (let iA = 0, iB = this.points.length - 1; iA < this.points.length; iB = iA++) {
            let A = points[iA];
            let B = points[iB];
            if (B.y === y || Math.max(A.y, B.y) <= y || Math.min(A.y, B.y) >= y) {
                continue;
            }
            if (A.y === B.y) {
                if (x <= Math.max(A.x, B.x)) {
                    crossed = !crossed;
                }
                continue;
            }
            let xPointOnLine = (B.x - A.x) * (y - A.y) / (B.y - A.y) + A.x;
            if (x <= xPointOnLine) {
                crossed = !crossed;
            }
        }
        return crossed;
    }


    //function linesIntersect( Ax, Ay, Bx, By, Cx, Cy, Dx, Dy) {
    //	var r = ((Ay-Cy)*(Dx-Cx)-(Ax-Cx)*(Dy-Cy)) /
    //		 ((Bx-Ax)*(Dy-Cy)-By-Ay)*(Dx-Cx));
    //	var s = ((Ay-Cy)*(Bx-Ax)-(Ax-Cx)(By-Ay)) /
    //		((Bx-Ax)*(Dy-Cy)-(By-Ay)(Dx-Cx));
    //	return ((0 <= r) && (r <= 1) && (0 <= s) && (s <= 1));
    //}

    polygonCollision(poly) {
        if (this.distanceFrom(poly.coordinates.x, poly.coordinates.y) > (this.radius + poly.radius)) {
            return false;
        }
        // if Point inside polygon, then poly is either intersecting or
        // fully inside 'this'
        if (this.pointCollision(poly.points[0].x, poly.points[0].y)) {
            return true;
        }

        for (let iA = poly.points.length - 1, iB = 0; iA >= 0; iB = iA--) {
            let A = poly.points[iA];
            let B = poly.points[iB];
            for (let iC = this.points.length - 1, iD = 0; iC >= 0; iD = iC--) {
                let C = this.points[iC];
                let D = this.points[iD];
                let r = ((A.y - C.y) * (D.x - C.x) - (A.x - C.x) * (D.y - C.y)) /
                    ((B.x - A.x) * (D.y - C.y) - (B.y - A.y) * (D.x - C.x));
                let s = ((A.y - C.y) * (B.x - A.x) - (A.x - C.x) * (B.y - A.y)) /
                    ((B.x - A.x) * (D.y - C.y) - (B.y - A.y) * (D.x - C.x));
                if ((0 <= r) && (r <= 1) && (0 <= s) && (s <= 1)) {
                    return true;
                }
            }
        }
        return false;
    }
}

// ---------------
// Crystal lighting
//
// Destructible objects are rendered as flat-shaded facets (one triangle per
// perimeter edge, fanned from the object's center). Each facet's color is
// the object's base color dimmed to an ambient floor, then additively
// tinted by any nearby point lights it faces toward - this is what makes
// asteroids read as cut crystal catching the colored light of the ship's
// thrust and gunfire, rather than a flat silhouette.

function hexToRgb(hex) {
    let value = parseInt(hex.replace('#', ''), 16);
    return {r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255};
}

function clampChannel(value) {
    return Math.max(0, Math.min(255, value));
}

const AMBIENT_LIGHT_ANGLE = 235;
const AMBIENT_LIGHT_COLOR = {r: 150, g: 180, b: 255};
const AMBIENT_LIGHT_INTENSITY = 0.45;
const AMBIENT_FACTOR = 0.3;

const THRUST_LIGHT_RADIUS = 170;
const THRUST_LIGHT_INTENSITY = 1.5;
const BULLET_LIGHT_RADIUS = 130;
const BULLET_LIGHT_INTENSITY = 1.2;
const BULLET_LIGHT_COLOR = {r: 255, g: 200, b: 60};

function facetNormal(coordinates, midpoint) {
    let nx = midpoint.x - coordinates.x;
    let ny = midpoint.y - coordinates.y;
    let len = Math.sqrt(nx * nx + ny * ny) || 1;
    return {x: nx / len, y: ny / len};
}

function shadeFacetColor(baseColor, midpoint, normal, lights) {
    let r = baseColor.r * AMBIENT_FACTOR;
    let g = baseColor.g * AMBIENT_FACTOR;
    let b = baseColor.b * AMBIENT_FACTOR;
    for (const light of lights) {
        let nx, ny, atten;
        if (light.directional) {
            nx = light.dx;
            ny = light.dy;
            atten = light.intensity;
        } else {
            let dx = light.x - midpoint.x;
            let dy = light.y - midpoint.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= light.radius) continue;
            nx = dx / dist;
            ny = dy / dist;
            atten = light.intensity * (1 - dist / light.radius);
        }
        let diffuse = Math.max(0, normal.x * nx + normal.y * ny) * atten;
        if (diffuse <= 0) continue;
        r += light.color.r * diffuse;
        g += light.color.g * diffuse;
        b += light.color.b * diffuse;
    }
    return {r: clampChannel(r), g: clampChannel(g), b: clampChannel(b)};
}

function facetSpecular(midpoint, normal, lights) {
    let strongest = 0;
    for (const light of lights) {
        if (light.directional) continue;
        let dx = light.x - midpoint.x;
        let dy = light.y - midpoint.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= light.radius) continue;
        let nx = dx / dist;
        let ny = dy / dist;
        let dot = Math.max(0, normal.x * nx + normal.y * ny);
        let value = Math.pow(dot, 6) * light.intensity * (1 - dist / light.radius);
        if (value > strongest) strongest = value;
    }
    return Math.min(0.85, strongest);
}

const STAR_COUNT = 50;
const MAX_STAR_SIZE = 2.5;
const STAR_STYLE = {
    strokeStyle: "white",
    fillStyle: "white",
    shadowColor: 'yellow',
    shadowBlur: 10,
    lineWidth: 1
};

class Stars {
    constructor(game) {
        this.game = game;
        this.frame = 0;
        let width = game.graphics.width;
        let height = game.graphics.height;
        let stars = []
        for(let i = 0; i < STAR_COUNT; i++) {
            let x = width * Math.random();
            let y = height * Math.random();
            let radius = MAX_STAR_SIZE * Math.random();
            let opacity = Math.random();
            let opacityOffset = 100 * Math.random();
            stars[i] = {
                coordinates: {x:x,y:y},
                radius:radius,
                opacity: opacity,
                opacityOffset: opacityOffset
            };
        }
        this.stars = stars;
    }
    draw() {
        for(let i = 0; i < STAR_COUNT; i++) {
            let star = this.stars[i];
            let opacity = star.opacity * Math.sin(Math.PI * ((star.opacityOffset + this.frame) % 100) / 100);
            this.game.graphics.arcWithStyle({...STAR_STYLE, globalAlpha: opacity}, star.coordinates, star.radius, 0, 360);
        }
        this.frame++;
    }
}

// ---------------
// Explosion
//
// Purely decorative: the exploding object's outline is cut into one
// shard per edge, each tumbling away from the object's center. Shards
// take no part in any collision check, so once an object has exploded it
// can no longer affect other objects even while its shards are still
// animating.

const EXPLOSION_MIN_LIFE = 50;  // ~1s at the game's 20ms frame interval
const EXPLOSION_MAX_LIFE = 100; // ~2s
const EXPLOSION_BURST_SPEED_MIN = 0.6;
const EXPLOSION_BURST_SPEED_MAX = 2.8;
const EXPLOSION_ROTATION_SPEED = 14;

class Explosion {
    constructor(game, points, coordinates, velocity, color) {
        this.game = game;
        this.color = color;
        this.alive = true;
        this.shards = [];
        let n = points.length;
        for (let i = 0; i < n; i++) {
            let A = points[i];
            let B = points[(i + 1) % n];
            let mid = {x: (A.x + B.x) / 2, y: (A.y + B.y) / 2};
            let outward = facetNormal(coordinates, mid);
            let burst = EXPLOSION_BURST_SPEED_MIN + Math.random() * (EXPLOSION_BURST_SPEED_MAX - EXPLOSION_BURST_SPEED_MIN);
            let life = EXPLOSION_MIN_LIFE + Math.floor(Math.random() * (EXPLOSION_MAX_LIFE - EXPLOSION_MIN_LIFE));
            this.shards.push({
                localA: {x: A.x - mid.x, y: A.y - mid.y},
                localB: {x: B.x - mid.x, y: B.y - mid.y},
                center: {x: mid.x, y: mid.y},
                // Shards keep the velocity the object was already travelling
                // at, plus an outward burst so the outline visibly separates.
                velocity: {
                    x: velocity.x + outward.x * burst,
                    y: velocity.y + outward.y * burst
                },
                angle: 0,
                rotationSpeed: (Math.random() - 0.5) * 2 * EXPLOSION_ROTATION_SPEED,
                life: life,
                maxLife: life
            });
        }
    }

    isActive() {
        return this.alive;
    }

    move() {
        let width = this.game.graphics.width;
        let height = this.game.graphics.height;
        let alive = false;
        for (const shard of this.shards) {
            if (shard.life <= 0) continue;
            shard.center.x += shard.velocity.x;
            if (shard.center.x < 0) shard.center.x += width;
            else if (shard.center.x > width) shard.center.x -= width;
            shard.center.y += shard.velocity.y;
            if (shard.center.y < 0) shard.center.y += height;
            else if (shard.center.y > height) shard.center.y -= height;
            shard.angle += shard.rotationSpeed;
            shard.life--;
            if (shard.life > 0) alive = true;
        }
        this.alive = alive;
    }

    draw() {
        for (const shard of this.shards) {
            if (shard.life <= 0) continue;
            let alpha = shard.life / shard.maxLife;
            let rad = Math.PI * shard.angle / 180;
            let cos = Math.cos(rad);
            let sin = Math.sin(rad);
            let A = {
                x: shard.center.x + shard.localA.x * cos - shard.localA.y * sin,
                y: shard.center.y + shard.localA.x * sin + shard.localA.y * cos
            };
            let B = {
                x: shard.center.x + shard.localB.x * cos - shard.localB.y * sin,
                y: shard.center.y + shard.localB.x * sin + shard.localB.y * cos
            };
            this.game.graphics.drawPolylineWithStyle({
                strokeStyle: `rgba(${this.color.r},${this.color.g},${this.color.b},${alpha})`,
                lineWidth: 1.5,
                shadowColor: `rgba(${this.color.r},${this.color.g},${this.color.b},${alpha})`,
                shadowBlur: 6
            }, [A, B]);
        }
    }
}

class DestructibleObject extends Polygon {

    constructor(...args) {
        super(...args);
        this.exploded = false;

    }

    isActive() {
        return !this.exploded;
    }

    /*
     * Marks the object dead (it's already excluded from every collision
     * check once isActive() is false, and gets dropped from its owning
     * array the same frame) and spawns a purely decorative Explosion in
     * its place - the explosion never takes part in collisions.
     */
    explode(newShootables) {
        if (this.exploded) {
            return;
        }
        this.exploded = true;
        if (this.points.length > 0) {
            let color = this.baseColor || hexToRgb(this.style.fillStyle);
            this.game.explosions.push(new Explosion(this.game, this.points, this.coordinates, this.velocity, color));
        }
    };

    /*
     * Additive highlight pass: tints facets facing a nearby point light
     * (thrust flame, bullets) with that light's color, without altering
     * the object's normal silhouette/fill.
     */
    drawFacetGlow() {
        let lights = this.game.lights;
        if (this.points.length === 0 || !lights || lights.length === 0) return;
        let n = this.points.length;
        for (let i = 0; i < n; i++) {
            let A = this.points[i];
            let B = this.points[(i + 1) % n];
            let mid = {x: (A.x + B.x) / 2, y: (A.y + B.y) / 2};
            let normal = facetNormal(this.coordinates, mid);
            let r = 0, g = 0, b = 0, total = 0;
            for (const light of lights) {
                if (light.directional) continue;
                let dx = light.x - mid.x;
                let dy = light.y - mid.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist >= light.radius) continue;
                let nx = dx / dist;
                let ny = dy / dist;
                let w = Math.max(0, normal.x * nx + normal.y * ny) * light.intensity * (1 - dist / light.radius);
                if (w <= 0) continue;
                total += w;
                r += light.color.r * w;
                g += light.color.g * w;
                b += light.color.b * w;
            }
            if (total <= 0.03) continue;
            let alpha = Math.min(0.6, total * 0.5);
            this.graphics.polyfill({
                fillStyle: `rgba(${Math.round(clampChannel(r))},${Math.round(clampChannel(g))},${Math.round(clampChannel(b))},${alpha})`,
                strokeStyle: "rgba(0,0,0,0)",
                lineWidth: 0,
                globalCompositeOperation: "lighter"
            }, [this.coordinates, A, B]);
        }
    }

}


// ---------------
// Ship

const SHIP_STYLE = {
    strokeStyle: "white",
    lineWidth: 1,
    fillStyle: "#008080",
    globalAlpha: 0.5
};
const SHIP_POLY = [
    0, 15,
    150, 15,
    180, 5,
    210, 15];
const SHIP_RADIUS = 15;
const THRUST_POLY = [170, 20, 180, 30, 190, 20];
const THRUST_COLORS = ["#00CFCF", "#8FD9FF", "#39FF88", "#3C7BFF"];

class Ship extends DestructibleObject {

    constructor(game) {
        let width = game.graphics.width;
        let height = game.graphics.height;
        let coordinates = {x: width / 2, y: height / 2};
        let velocity = {x: 0, y: 0};
        super(game, SHIP_POLY, SHIP_STYLE, coordinates, velocity, SHIP_RADIUS);

        this.angle = 90;
        this.rotation = 0;
    }

    setRotation(rotation) {
        this.rotation = rotation
    }

    draw() {
        super.draw();
        if (this.isActive() && this.thrust) {
            let points = [];
            for (let i = 0; i < (THRUST_POLY.length / 2); i++) {
                let angle = (this.angle + THRUST_POLY[i * 2]);
                let distance = THRUST_POLY[i * 2 + 1];
                points[i] = this.calcPoint(this.coordinates, distance, angle);
            }
            this.graphics.drawPolylineWithStyle({
                    strokeStyle: this.thrustColor,
                    lineWidth: 2,
                    shadowColor: "#DDDDFF",
                    shadowBlur: 10

                },
                points);
        }
        this.drawFacetGlow();
    };


    move() {
        this.angle += this.rotation;
        this.thrustColor = THRUST_COLORS[Math.floor(Math.random() * THRUST_COLORS.length)];
        if (this.thrust) {
            this.velocity = this.calcPoint(this.velocity, 0.3, this.angle);
        }
        super.move();
    }

    setThrust(ok) {
        this.thrust = ok;
    }

    fire() {
        for (let i in this.game.bulletArray) {
            let b = this.game.bulletArray[i];
            if (b.isActive()) {
                continue;
            }
            let coordinates = this.calcPoint(this.coordinates, this.radius, this.angle);
            let velocity = this.calcPoint(this.velocity, BULLET_VELOCITY, this.angle);
            b.fire(coordinates,velocity);
            return;
        }
    }
}

const UFO_STYLE = {
    strokeStyle: "#0FF9FB",
    lineWidth: 1,
    fillStyle: "#356070",
    globalAlpha: 0.8
};
const UFO_POLY = [
    90, 15,
    270, 15,
    225, 10,
    135, 10,
    90, 15,
    45, 8,
    15, 12,
    345, 12,
    315, 8,
    270, 15
];
const UFO_RADIUS = 15;
const UFO_ROTATION = 10;
const UFO_VELOCITY = 2;
const UFO_SCORE = 500;
class Ufo extends DestructibleObject {
    constructor(game) {
        let width = game.graphics.width;
        let height = game.graphics.height;
        let x = (Math.random() > 0.5)? 20 : width - 20;
        let y = (Math.random() > 0.5)? 20 : height - 20;
        let coordinates = {x: x, y: y};
        let velocity = {x: 0, y: 0};
        super(game, UFO_POLY, UFO_STYLE, coordinates, velocity, UFO_RADIUS);
        this.magnification = 0.75 + Math.random()*1.25;
        this.angle = 90;
        this.rotation = 0;
    }

    move() {
        this.rotation += UFO_ROTATION * 2 * Math.random() - UFO_ROTATION;
        this.velocity = this.calcPoint({x:0, y:0},  UFO_VELOCITY, this.rotation);
        super.move();
        if (Math.random() > 0.995) { this.fire() }
    }

    draw() {
        super.draw();
        this.drawFacetGlow();
    }

    fire() {
        for (let i in this.game.bulletArray) {
            let b = this.game.bulletArray[i];
            if (b.isActive()) {
                continue;
            }
            let angle = 360 * Math.random();
            let coordinates = this.calcPoint(this.coordinates, this.radius, angle);
            let velocity = this.calcPoint(this.velocity, BULLET_VELOCITY, angle);
            b.fire(coordinates,velocity);
            return;
        }
    }

    explode(newShootables) {
        super.explode(newShootables);
        this.game.increaseScore(UFO_SCORE);
    }


}


//-------------
// Bullet
const BULLET_STYLE = {
    strokeStyle: "red",
    fillStyle: "yellow",
    shadowColor: 'yellow',
    shadowBlur: 10,
    lineWidth: 2
}
const BULLET_VELOCITY = 10;
const BULLET_TTL = 40;

class Bullet extends GameObject {
    constructor(game) {
        super(game, BULLET_STYLE, {x: 0, y: 0}, {x: 0, y: 0}, 1)
        this.active = 0;
    }

    isActive() {
        return this.active > 0;
    }

    die() {
        this.active = 0;
    }

    fire(coordinates, velocity) {
        this.coordinates = coordinates;
        this.velocity = velocity;
        this.active = BULLET_TTL;
    }

    move() {
        if (--this.active > 0) {
            super.move();
        }
    }


    draw() {
        if (this.isActive()) {
            this.graphics.arcWithStyle(BULLET_STYLE, this.coordinates,
                2,
                0,
                2 * Math.PI
            );
        }
    }

}


// -------------
// Asteroid

const ASTEROID_CONFIGURATIONS = {
    1: {category: 1, radius: 50, complexity: 15, score: 100, velocity: 1, children: 3},
    2: {category: 2, radius: 25, complexity: 10, score: 150, velocity: 2, children: 2},
    3: {category: 3, radius: 15, complexity: 6, score: 250, velocity: 3, children: 0}
};
const ASTEROID_STYLE = {
    strokeStyle: "#808080",
    lineWidth: 1,
    fillStyle: "#505050",
    globalAlpha: 0.88
};
const ASTEROID_COLORS = ["#8E2DE2", "#00C9A7", "#2979FF", "#FF3D68", "#FFC400", "#00E5FF", "#C724B1"];

class Asteroid extends DestructibleObject {

    constructor(game, category, coordinates, baseVelocity) {
        let config = ASTEROID_CONFIGURATIONS[category];
        let radius = config.radius;
        let poly = []
        let step = 360 / config.complexity;
        for (let i = 0; i < config.complexity; i++) {
            let jitter = (Math.random() - 0.5) * step * 0.7;
            poly[i * 2] = step * i + jitter;
            poly[i * 2 + 1] = radius - Math.random() * radius * 0.5;
        }
        let style = {...ASTEROID_STYLE, fillStyle: ASTEROID_COLORS[Math.floor(Math.random() * ASTEROID_COLORS.length)]};
        super(game, poly, style, {...coordinates}, baseVelocity, radius);
        this.baseColor = hexToRgb(style.fillStyle);
        // adjust velocity to account for explosion.
        let explodeDegrees = 360 * Math.random();
        this.velocity = this.calcPoint(this.velocity, config.velocity, explodeDegrees);
        this.config = config;
        this.angle = Math.random() * 360;
        this.rotation = Math.random() * 10 - 5;
        this.exploded = false;
    }

    move() {
        this.angle += this.rotation;
        super.move();
    };

    /*
     * Renders the asteroid as flat-shaded crystal facets (one triangle per
     * perimeter edge, fanned from the center) instead of a single flat
     * fill, so each face can catch light independently.
     */
    draw() {
        if (this.points.length === 0) return;
        let lights = this.game.lights || [];
        let n = this.points.length;
        let alpha = this.style.globalAlpha ?? 0.88;
        for (let i = 0; i < n; i++) {
            let A = this.points[i];
            let B = this.points[(i + 1) % n];
            let mid = {x: (A.x + B.x) / 2, y: (A.y + B.y) / 2};
            let normal = facetNormal(this.coordinates, mid);
            let shaded = shadeFacetColor(this.baseColor, mid, normal, lights);
            this.graphics.polyfill({
                fillStyle: `rgba(${Math.round(shaded.r)},${Math.round(shaded.g)},${Math.round(shaded.b)},${alpha})`,
                strokeStyle: "rgba(0,0,0,0)",
                lineWidth: 0
            }, [this.coordinates, A, B]);

            let spark = facetSpecular(mid, normal, lights);
            if (spark > 0.03) {
                this.graphics.polyfill({
                    fillStyle: `rgba(255,255,255,${spark})`,
                    strokeStyle: "rgba(0,0,0,0)",
                    lineWidth: 0,
                    globalCompositeOperation: "lighter"
                }, [this.coordinates, A, B]);
            }
        }

        // Single outline around the true perimeter only - the facet fills
        // above are deliberately unstroked so no spokes radiate from the
        // center (that read as umbrella ribs rather than a rock edge).
        let edge = {r: this.baseColor.r * 0.35, g: this.baseColor.g * 0.35, b: this.baseColor.b * 0.35};
        this.graphics.drawPolylineWithStyle({
            strokeStyle: `rgba(${Math.round(edge.r)},${Math.round(edge.g)},${Math.round(edge.b)},0.9)`,
            lineWidth: 1.5
        }, this.points);
    }


    explode(asteroidList) {
        if (this.exploded) {
            return;
        }
        super.explode(asteroidList);
        this.game.increaseScore(this.config.score);
        for (let i = 0; i < this.config.children; i++) {
            let fragment = new Asteroid(this.game, this.config.category + 1, this.coordinates, this.velocity);
            fragment.move();
            asteroidList.push(fragment);
        }
    };
}

const MAX_BULLETS = 10;
const DEMO_LEVEL = 10;
const GAME_LIVES = 3;
const GAME_START_LEVEL = 3;
const UFO_FREQUENCY = 0.001;
class Asteroids {
    constructor(graphics) {
        this.graphics = graphics;
        this.ship = null;
        this.destructibleObjects = [];
        this.bulletArray = [];
        this.explosions = [];
        this.stars = null;
        this.level = 1;
        this.score = 0;
        this.lives = 0;
    }

    newGame() {
        this.ship = new Ship(this);
        this.stars = new Stars(this);
        this.bulletArray = [];
        this.explosions = [];
        for (let i = 0; i < MAX_BULLETS; i++) {
            this.bulletArray[i] = new Bullet(this);
        }
        this.level = GAME_START_LEVEL;
        this.lives = GAME_LIVES;
        this.score = 0;
        this.nextLevel();
    };

    increaseScore(increment) {
        if (this.ship) {
            this.score += increment;
        }
    }

    nextLevel() {
        let width = this.graphics.width;
        let height = this.graphics.height;
        this.destructibleObjects = [];
        for (let i = 0; i < this.level; i++) {
            this.destructibleObjects[i] = new Asteroid(this, 1,
                {x: width * Math.random(), y: height * Math.random()},
                {x: 0, y: 0});
        }
        this.level++;
    }

    demoMode() {
        // explosions (e.g. the ship's own death burst, happening this same
        // frame) are left alone so they can keep animating into demo mode
        this.ship = null;
        this.stars = new Stars(this);
        this.bulletArray = [];
        for (let i = 0; i < MAX_BULLETS; i++) {
            this.bulletArray[i] = new Bullet(this);
        }
        this.level = DEMO_LEVEL;
        this.nextLevel();
    }

    move() {
        this.ship?.move();
        for (let ai in this.destructibleObjects) {
            let destructible = this.destructibleObjects[ai];
            destructible.move();
            if (this.ship && this.ship.points.length > 0 && destructible.polygonCollision(this.ship)) {
                this.ship.explode();
            }
        }
        let cleanup = false;
        let newDestructibleObjects = [];
        for (let i in this.bulletArray) {
            if (!this.bulletArray[i].isActive()) {
                continue;
            }
            this.bulletArray[i].move();

            for (let j in this.destructibleObjects) {
                if (this.ship && this.ship.pointCollision(this.bulletArray[i].coordinates.x, this.bulletArray[i].coordinates.y)) {
                    this.ship.explode();
                }
                if (this.destructibleObjects[j].pointCollision(this.bulletArray[i].coordinates.x, this.bulletArray[i].coordinates.y)) {
                    this.bulletArray[i].die();
                    this.destructibleObjects[j].explode(newDestructibleObjects);
                    cleanup = true;
                }
            }
        }
        if (Math.random() < UFO_FREQUENCY) {
            let ufo = new Ufo(game);
            newDestructibleObjects.push(ufo);
            ufo.move();
        }

        if (cleanup) {
            this.destructibleObjects = this.destructibleObjects.filter(function (shootable, _a, _b) {
                return shootable.isActive();
            });
        }
        this.destructibleObjects.push(...newDestructibleObjects);
        if (this.ship && !this.ship.isActive()) {
            if (--this.lives > 0) {
                this.ship = new Ship(this);
            } else {
                this.demoMode();
            }
        }


        if (this.destructibleObjects.length === 0) {
            this.nextLevel();
        }

        this.explosions.forEach(explosion => explosion.move());
        this.explosions = this.explosions.filter(explosion => explosion.isActive());
    }

    /*
     * Builds this frame's light sources: a fixed dim ambient light (so
     * facets are never fully black) plus the ship's thrust flame and any
     * in-flight bullets, which asteroids/ship/UFO facets react to in draw().
     */
    computeLights() {
        let angleRad = Math.PI * AMBIENT_LIGHT_ANGLE / 180;
        let lights = [{
            directional: true,
            dx: Math.cos(angleRad),
            dy: Math.sin(angleRad),
            color: AMBIENT_LIGHT_COLOR,
            intensity: AMBIENT_LIGHT_INTENSITY
        }];
        if (this.ship && this.ship.isActive() && this.ship.thrust) {
            let flame = this.ship.calcPoint(this.ship.coordinates, 25, this.ship.angle + 180);
            lights.push({
                x: flame.x,
                y: flame.y,
                color: hexToRgb(this.ship.thrustColor),
                intensity: THRUST_LIGHT_INTENSITY,
                radius: THRUST_LIGHT_RADIUS
            });
        }
        for (const bullet of this.bulletArray) {
            if (!bullet.isActive()) continue;
            lights.push({
                x: bullet.coordinates.x,
                y: bullet.coordinates.y,
                color: BULLET_LIGHT_COLOR,
                intensity: BULLET_LIGHT_INTENSITY * Math.min(1, bullet.active / 10),
                radius: BULLET_LIGHT_RADIUS
            });
        }
        this.lights = lights;
    }

    draw() {
        this.computeLights();
        this.graphics.clear();
        this.stars?.draw();
        this.bulletArray.forEach(function (bullet) {
            if (bullet.isActive()) {
                bullet.draw();
            }
        });
        this.destructibleObjects.forEach(function (asteroid) {
            asteroid.draw();
        });
        this.ship?.draw();
        this.explosions.forEach(explosion => explosion.draw());

        this.graphics.drawText({
                fillStyle: "yellow",
                font: "20px Righteous, Serif",
                textAlign: "left",
                shadowColor: 'red',
                shadowBlur: 15

            },
            "Score: " + this.score,
            20, 40, 100,
        );
        this.graphics.drawText({
                fillStyle: "yellow",
                shadowColor: 'red',
                shadowBlur: 15,
            font: "20px Righteous, Serif",
                textAlign: "right"
            },
            "Lives: " + this.lives, this.graphics.width - 20, 40, 60,
        );

        if (this.ship === null) {
            this.graphics.drawText({
                    fillStyle: "green",
                    font: "30px Righteous, Serif",
                    textAlign: "center"
                },
                "Game Over", this.graphics.width / 2, this.graphics.height / 2, 200,
            );
            this.graphics.drawText({
                    fillStyle: "green",
                    font: "30px Righteous, Serif",
                    textAlign: "center"
                },
                "Press 'S' to Play", this.graphics.width / 2, this.graphics.height / 2 + 50, 200,
            );
        }
        this.graphics.paint();
    }

    animate() {
        this.move();
        this.draw();
        window.setTimeout(function () {
            this.animate()
        }.bind(this), 20);
    }

    keyHandler(e, isPressed) {
        switch (e.code) {
            case 'KeyA':
                this.ship?.setRotation((isPressed) ? 5 : 0);
                break;
            case 'KeyD':
                this.ship?.setRotation((isPressed) ? -5 : 0);
                break;
            case 'KeyW':
                this.ship?.setThrust(isPressed);
                break;
            case 'KeyL':
                if (isPressed) {
                    this.ship?.fire(this);
                }
                break;
            case 'KeyS':
                if (isPressed && this.lives === 0) {
                    this.newGame();
                }
                break;
            default:
                break;
        }
    }


    start() {
        document.addEventListener("keydown", function (e) {
            this.keyHandler(e, true);
        }.bind(this));
        document.addEventListener("keyup", function (e) {
            this.keyHandler(e, false);
        }.bind(this));
        this.demoMode();
        this.animate();
    }
}
