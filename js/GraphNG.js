class GraphNG {

    constructor(id) {

        this.canvas = document.getElementById(id);
        this.context = this.canvas.getContext("2d");
        this.context.color = "#808080";
        this.context.lineWidth = 1;
    }

    get width() {
        return this.canvas.width;
    }

    get height() {
        return this.canvas.height;
    }

    setStyle(properties) {
        Object.entries(properties).forEach(([key, value]) => this.context[key] = value);

    }


    drawPolyline(points) {
        this.context.beginPath();
        this.context.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.context.lineTo(points[i].x, points[i].y);
        }
        this.context.closePath();
        this.context.stroke();
    };

    polyfill(style, points) {
        this.context.save();
        this.setStyle(style);
        this.drawPolyline(points);
        this.context.fill();
        this.context.restore();
    };

    drawPolylineWithStyle(style, points) {
        this.context.save();
        this.setStyle(style);
        this.drawPolyline(points);
        this.context.restore();
    };


    drawArc(x, y, radius, startAngle, endAngle) {
        this.context.beginPath();
        this.context.arc(x, y, radius, startAngle, endAngle);
        this.context.fill();
        this.context.stroke();

    }

    arcWithStyle(style, coordinates, radius, startAngle, endAngle) {
        this.context.save();
        this.setStyle(style);
        this.drawArc(coordinates.x, coordinates.y, radius, startAngle, endAngle);
        this.context.restore();
    }

    paint() {
    }

    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawText(style, txt, x, y, width) {
        this.context.save();
        this.setStyle(style);
        this.context.fillText(txt, x, y, width);
        this.context.restore();
    };

}


