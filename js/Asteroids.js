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

    pointCollision(x, y) {
        let crossed = false;
        let points = this.points;
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
        if (crossed) {
            console.log(`Crossed ${x},${y} : ${JSON.stringify(this.points)}`);
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
        let square = function (x) {
            return x * x;
        }
        if (Math.sqrt(square(this.x - poly.x) + square(this.y - poly.y)) > this.radius + poly.radius) {
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

class ShootablePolygon extends Polygon {

    constructor(...args) {
        super(...args);
        this.exploded = false;

    }

    isActive() {
        return !this.exploded;
    }

    explode(newShootables) {
        this.exploded = true;
    };


}


// ---------------
// Ship

const SHIP_STYLE = {
    strokeStyle: "white",
    lineWidth: 1,
    fillStyle: "teal",
    globalAlpha: 0.5
};
const SHIP_POLY = [
    0, 15,
    150, 15,
    180, 5,
    210, 15];
const SHIP_RADIUS = 15;
const THRUST_POLY = [170, 20, 180, 30, 190, 20];
const THRUST_COLORS = ["teal", "lightblue", "green", "blue"];

class Ship extends ShootablePolygon {

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
            let color = THRUST_COLORS[Math.floor(Math.random() * THRUST_POLY.length)];
            this.graphics.drawPolylineWithStyle({
                    strokeStyle: color,
                    lineWidth: 2,
                    shadowColor: "#DDDDFF",
                    shadowBlur: 10

                },
                points);
        }
    };


    move() {
        this.angle += this.rotation;
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
class Ufo extends ShootablePolygon {
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
        if (Math.random() > 0.995) { this.fire() };
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
        if (this.active) {
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
    globalAlpha: 0.5
};
const ASTEROID_COLORS = ["#800000", "#008000", "#000080", "#008080", "#804000", "#808000", "#808080"];

class Asteroid extends ShootablePolygon {

    constructor(game, category, coordinates, baseVelocity) {
        let config = ASTEROID_CONFIGURATIONS[category];
        let radius = config.radius;
        let poly = []
        for (let i = 0; i < config.complexity; i++) {
            poly[i * 2] = 360 * i / config.complexity;
            poly[i * 2 + 1] = radius - Math.random() * radius * 0.4;
        }
        let style = {...ASTEROID_STYLE, fillStyle: ASTEROID_COLORS[Math.floor(Math.random() * ASTEROID_COLORS.length)]};
        super(game, poly, style, {...coordinates}, baseVelocity, radius);
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
        this.shootableObjects = [];
        this.bulletArray = [];
        this.level = 1;
        this.score = 0;
        this.lives = 0;
    }

    newGame() {
        this.ship = new Ship(this);
        this.bulletArray = [];
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
        this.shootableObjects = [];
        for (let i = 0; i < this.level; i++) {
            this.shootableObjects[i] = new Asteroid(this, 1,
                {x: width * Math.random(), y: height * Math.random()},
                {x: 0, y: 0});
        }
        this.level++;
    }

    demoMode() {
        this.ship = null;
        this.bulletArray = [];
        for (let i = 0; i < MAX_BULLETS; i++) {
            this.bulletArray[i] = new Bullet(this);
        }
        this.level = DEMO_LEVEL;
        this.nextLevel();
    }

    move() {
        this.ship?.move();
        for (let ai in this.shootableObjects) {
            let shootable = this.shootableObjects[ai];
            shootable.move();
            if (this.ship && this.ship.points.length > 0 && shootable.polygonCollision(this.ship)) {
                this.ship.explode();
            }
        }
        let cleanup = false;
        let newShootables = [];
        for (let i in this.bulletArray) {
            if (!this.bulletArray[i].active) {
                continue;
            }
            this.bulletArray[i].move();

            for (let j in this.shootableObjects) {
                if (this.ship && this.ship.pointCollision(this.bulletArray[i].coordinates.x, this.bulletArray[i].coordinates.y)) {
                    this.ship.explode();
                }
                if (this.shootableObjects[j].pointCollision(this.bulletArray[i].coordinates.x, this.bulletArray[i].coordinates.y)) {
                    this.bulletArray[i].active = 0;
                    this.shootableObjects[j].explode(newShootables);
                    cleanup = true;
                }
            }
        }
        if (Math.random() < UFO_FREQUENCY) {
            let ufo = new Ufo(game);
            newShootables.push(ufo);
            ufo.move();
        }

        if (cleanup) {
            this.shootableObjects = this.shootableObjects.filter(function (shootable, _a, _b) {
                return shootable.isActive();
            });
        }
        this.shootableObjects.push(...newShootables);
        if (this.ship && !this.ship.isActive()) {
            if (--this.lives > 0) {
                this.ship = new Ship(this);
            } else {
                this.demoMode();
            }
        }


        if (this.shootableObjects.length === 0) {
            this.nextLevel();
        }

    }

    draw() {
        this.graphics.clear();
        this.bulletArray.forEach(function (bullet) {
            if (bullet.active) {
                bullet.draw();
            }
        });
        this.shootableObjects.forEach(function (asteroid) {
            asteroid.draw();
        });
        this.ship?.draw();
        this.ufo?.draw();

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
