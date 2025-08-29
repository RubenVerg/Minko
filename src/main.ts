import './style.scss';

interface Line {
	type: 'line';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

interface Point {
	type: 'point';
	x: number;
	y: number;
}

interface Polygon {
	type: 'polygon';
	points: [number, number][];
}

interface Circle {
	type: 'circle';
	cx: number;
	cy: number;
	radius: number;
}

interface DOMPath {
	type: 'dom-path';
	path: Path2D;
}

type Path = Line | Point | Polygon | Circle | DOMPath;

class Shape {
	static offscreen = new OffscreenCanvas(800, 600);

	private readonly path: Path[];
	private isAlreadyCentered;

	constructor(isAlreadyCentered = false) {
		this.isAlreadyCentered = isAlreadyCentered;
		this.path = [];
	}

	clear() {
		this.path.splice(0, this.path.length);
		return this;
	}

	copy(that: Shape) {
		this.path.push(...that.path);
		this.isAlreadyCentered = that.isAlreadyCentered;
	}

	erasePoint(x: number, y: number) {
		const oldPath = this.path.slice();
		this.path.splice(0, this.path.length);
		this.path.push(...oldPath.flatMap((path): Path[] => {
			switch (path.type) {
				case 'point':
					if (path.x === x && path.y === y) return [];
					else return [path];
				case 'line':
					if ((path.x1 === x && path.y1 === y) || (path.x2 === x && path.y2 === y)) return [];
					else return [path];
				case 'polygon':
					for (const point of path.points) {
						if (point[0] === x && point[1] === y) return [];
					}
					return [path];
				case 'circle':
					if (Math.abs(Math.hypot(path.cx - x, path.cy - y) - path.radius) < 1e-6) return [];
					return [path];
				case 'dom-path':
					return [path];
			}
		}));
	}

	line(x1: number, y1: number, x2: number, y2: number) {
		this.path.push({
			type: 'line',
			x1, y1, x2, y2,
		});
		return this;
	}

	point(x: number, y: number) {
		this.path.push({
			type: 'point',
			x, y,
		});
		return this;
	}

	polygon(points: [number, number][]) {
		this.path.push({
			type: 'polygon',
			points,
		});
		return this;
	}

	circle(cx: number, cy: number, radius: number) {
		this.path.push({
			type: 'circle',
			cx, cy, radius,
		});
		return this;
	}

	domPath(path: Path2D) {
		this.path.push({
			type: 'dom-path',
			path,
		});
		return this;
	}

	draw(ctx: (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D), forDisplay: boolean, color: string) {
		ctx.save();
		for (const datum of this.path) {
			switch (datum.type) {
				case 'line': {
					ctx.strokeStyle = color;
					ctx.lineWidth = forDisplay ? 3 : 1;
					ctx.beginPath();
					ctx.moveTo(datum.x1, datum.y1);
					ctx.lineTo(datum.x2, datum.y2);
					ctx.stroke();
					break;
				}
				case 'point': {
					ctx.fillStyle = color;
					if (forDisplay) {
						ctx.beginPath();
						ctx.arc(datum.x, datum.y, 5, 0, 2 * Math.PI);
						ctx.fill();
						ctx.beginPath();
					} else {
						ctx.fillRect(datum.x, datum.y, 1, 1);
					}
					break;
				}
				case 'polygon': {
					ctx.strokeStyle = forDisplay ? color : 'transparent';
					ctx.fillStyle = forDisplay ? `rgb(from ${color} r g b / calc(8 / 15))` : color;
					ctx.lineWidth = forDisplay ? 3 : 1;
					ctx.beginPath();
					if (datum.points.length == 0) break;
					ctx.moveTo(...datum.points[0]);
					for (const point of datum.points.slice(1)) ctx.lineTo(...point);
					ctx.closePath();
					ctx.fill();
					ctx.stroke();
					break;
				}
				case 'circle': {
					ctx.strokeStyle = forDisplay ? color : 'transparent';
					ctx.fillStyle = forDisplay ? `rgb(from ${color} r g b / calc(8 / 15))` : color;
					ctx.lineWidth = forDisplay ? 3 : 1;
					ctx.beginPath();
					ctx.arc(datum.cx, datum.cy, datum.radius, 0, 2 * Math.PI);
					ctx.fill();
					ctx.stroke();
					break;
				}
				case 'dom-path': {
					ctx.strokeStyle = forDisplay ? color : 'transparent';
					ctx.fillStyle = forDisplay ? `rgb(from ${color} r g b / calc(8 / 15))` : color;
					ctx.lineWidth = forDisplay ? 3 : 1;
					ctx.beginPath();
					ctx.fill(datum.path);
					ctx.stroke(datum.path);
					break;
				}
			}
		}
		ctx.restore();
	}

	drawAlwaysCentered(tCtx: (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D), forDisplay: boolean, dsColor: string) {
		tCtx.save();
		const ctx = Shape.offscreen.getContext('2d')!;
		ctx.save();
		const pixels = this.pixels();
		let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
		for (const [idx, on] of pixels.entries()) {
			if (on) {
				const px = idx % ctx.canvas.width;
				const py = Math.floor(idx / ctx.canvas.width);
				xmin = Math.min(xmin, px);
				ymin = Math.min(ymin, py);
				xmax = Math.max(xmax, px);
				ymax = Math.max(ymax, py);
			}
		}
		const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
		tCtx.save();
		tCtx.translate(tCtx.canvas.width / 2 - cx, tCtx.canvas.height / 2 - cy);
		this.draw(tCtx, forDisplay, dsColor);
		tCtx.restore();
		tCtx.restore();
		ctx.restore();
	}

	drawCentered(ctx: (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D), forDisplay: boolean, dsColor: string) {
		if (this.isAlreadyCentered) {
			this.draw(ctx, forDisplay, dsColor);
		} else {
			this.drawAlwaysCentered(ctx, forDisplay, dsColor);
		}
	}

	static pixels(ctx?: (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D)) {
		if (!ctx) ctx = Shape.offscreen.getContext('2d')!;
		const data = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
		const pixels = new Uint32Array(data.data.buffer);
		return [...pixels].map(px => Math.floor(px / 2 ** 12) > 0x80);
	}

	pixels() {
		const ctx = Shape.offscreen.getContext('2d')!;
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.save();
		this.draw(ctx, false, 'black');
		const pixels = Shape.pixels();
		ctx.restore();
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		return pixels;
	}

	sum(that: Shape, tCtx: (CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D), color: string) {
		const ctx = Shape.offscreen.getContext('2d')!;
		for (const [idx, on] of this.pixels().entries()) {
			if (on) {
				const x = idx % ctx.canvas.width;
				const y = Math.floor(idx / ctx.canvas.width);
				ctx.save();
				ctx.translate(x, y);
				that.draw(ctx, false, color);
				ctx.restore();
			}
		}
		const pixels = Shape.pixels();
		let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
		for (const [idx, on] of pixels.entries()) {
			if (on) {
				const px = idx % ctx.canvas.width;
				const py = Math.floor(idx / ctx.canvas.width);
				xmin = Math.min(xmin, px);
				ymin = Math.min(ymin, py);
				xmax = Math.max(xmax, px);
				ymax = Math.max(ymax, py);
			}
		}
		const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
		tCtx.drawImage(ctx.canvas, tCtx.canvas.width / 2 - cx, tCtx.canvas.height / 2 - cy);
	}
}

/*
function grid(ctx: CanvasRenderingContext2D, color: string, gridSize: number) {
	ctx.save();
	ctx.strokeStyle = color;
	const width = ctx.canvas.clientWidth;
	const height = ctx.canvas.clientHeight;
	for (let yo = 0; yo <= height / 2; yo += gridSize) {
		ctx.lineWidth = yo == 0 ? 2 : 1;
		ctx.beginPath();
		ctx.moveTo(0, height / 2 + yo);
		ctx.lineTo(width, height / 2 + yo);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(0, height / 2 - yo);
		ctx.lineTo(width, height / 2 - yo);
		ctx.stroke();
	}
	for (let xo = 0; xo <= width / 2; xo += gridSize) {
		ctx.lineWidth = xo == 0 ? 2 : 1;
		ctx.beginPath();
		ctx.moveTo(width / 2 + xo, 0);
		ctx.lineTo(width / 2 + xo, height);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(width / 2 - xo, 0);
		ctx.lineTo(width / 2 - xo, height);
		ctx.stroke();
	}
	ctx.restore();
}
*/

function grid(ctx: CanvasRenderingContext2D, color: string, gridSize: number, angles: number[]) {
	ctx.save();
	ctx.strokeStyle = color;
	const width = ctx.canvas.clientWidth;
	const height = ctx.canvas.clientHeight;
	const bound = Math.max(width, height);
	ctx.translate(width / 2, height / 2);
	for (const angle of angles) {
		ctx.save();
		ctx.rotate(angle);
		for (let off = 0; off <= bound; off += gridSize) {
			ctx.lineWidth = off == 0 ? 2 : 1;
			ctx.beginPath();
			ctx.moveTo(-bound, off);
			ctx.lineTo(bound, off);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-bound, -off);
			ctx.lineTo(bound, -off);
			ctx.stroke();
		}
		ctx.restore();
	}
	ctx.restore();
}

type Grid = 'square' | 'triangle' | 'fine-square' | 'fine-triangle';

function gridAngles(g: Grid): number[] {
	switch (g) {
		case 'square':
		case 'fine-square':
			return [0, Math.PI / 2];
		case 'triangle':
		case 'fine-triangle':
			return [0, Math.PI * 2 / 3, Math.PI * 4 / 3];
	}
}

function gridSize(g: Grid): number {
	switch (g) {
		case 'square':
		case 'triangle':
			return gridUnit;
		case 'fine-square':
		case 'fine-triangle':
			return gridUnit / 2;
	}
}

const left = document.querySelector<HTMLCanvasElement>('#left')!;
const leftCtx = left.getContext('2d')!;
const leftShape = new Shape();
let leftGrid: Grid = 'square';
const leftClearButton = document.querySelector<HTMLButtonElement>('#clear-left')!;
let leftEditable = true;

const right = document.querySelector<HTMLCanvasElement>('#right')!;
const rightCtx = right.getContext('2d')!;
const rightShape = new Shape();
let rightGrid: Grid = 'square';
const rightClearButton = document.querySelector<HTMLButtonElement>('#clear-right')!;
let rightEditable = false;

let building: any = null, buildingSide = 0, buildingWhat = 'point';

const sum = document.querySelector<HTMLCanvasElement>('#sum')!;
const sumCtx = sum.getContext('2d')!;
const sumShape = new Shape();
let sumGrid: Grid = 'square';
const sumClearButton = document.querySelector<HTMLButtonElement>('#clear-sum')!;
let sumEditable = false;

const tutorialBlock = document.querySelector<HTMLDialogElement>('#tutorial')!;
const tutorialText = document.querySelector<HTMLParagraphElement>('#tutorial-text')!;
const confirmButton = document.querySelector<HTMLButtonElement>('#tutorial-confirm')!;
const nextLevelButton = document.querySelector<HTMLButtonElement>('#next-level')!;
const skipTutorialButton = document.querySelector<HTMLButtonElement>('#skip-tutorial')!;

const levelNameText = document.querySelector<HTMLSpanElement>('#level-name')!;
const levelSelect = document.querySelector<HTMLDialogElement>('#level-select')!;

const grids = document.querySelector<HTMLSpanElement>('#grids')!;

let mouseX = 0, mouseY = 0;

document.body.addEventListener('mousemove', evt => {
	mouseX = evt.clientX;
	mouseY = evt.clientY;
	render();
});

function snapCoord(pos: number, size: number, gridSize: number) {
	return Math.round((pos - size / 2) / gridSize) * gridUnit + size / 2;
}

const triMatrix: [number, number, number, number] = [2 / Math.sqrt(3), 1 / Math.sqrt(3), 0, 1];
const triInvMatrix: [number, number, number, number] = [Math.sqrt(3) / 2, -1 / 2, 0, 1];

function snap(x: number, y: number, width: number, height: number, grid: Grid): [number, number] {
	switch (grid) {
		case 'square':
		case 'fine-square':
			return [snapCoord(x, width, gridSize(grid)), snapCoord(y, height, gridSize(grid))];
		case 'triangle':
		case 'fine-triangle':
		{
			const xr = x - width / 2, yr = y - height / 2;
			const x1 = triInvMatrix[0] * xr + triInvMatrix[1] * yr;
			const y1 = triInvMatrix[2] * xr + triInvMatrix[3] * yr;
			const xs = Math.round(x1 / gridSize(grid)) * gridSize(grid);
			const ys = Math.round(y1 / gridSize(grid)) * gridSize(grid);
			const x2 = triMatrix[0] * xs + triMatrix[1] * ys;
			const y2 = triMatrix[2] * xs + triMatrix[3] * ys;
			return [x2 + width / 2, y2 + height / 2];
		}
	}
}

const gridUnit = 40;

function render() {
	if (lastRenderStage !== stage) {
		// stage changed
		lastRenderStage = stage;
		const st = stages[stage]!;
		grids.classList.add('hidden');
		switch (st.type) {
			case 'tutorial-welcome':
			case 'tutorial-confirm':
			case 'tutorial-select-tool':
			case 'tutorial-place-object':
			case 'tutorial-complete-level':
				{
					if (skipTutorial && st.type !== 'tutorial-complete-level') {
						stage++;
						break;
					}
					tutorialBlock.classList.remove('hidden');
					if (st.type === 'tutorial-confirm' || st.type === 'tutorial-welcome') confirmButton.classList.remove('hidden');
					else confirmButton.classList.add('hidden');
					if (st.type === 'tutorial-welcome') skipTutorialButton.classList.remove('hidden');
					else skipTutorialButton.classList.add('hidden');
					tutorialText.textContent = st.message;
					if (st.type === 'tutorial-place-object' && st.hands) {
						for (const hand of st.hands) {
							document.getElementById(hand)?.classList?.remove?.('hidden');
						}
					}
					break;
				}
			case 'show-level-bc':
			case 'level-bc':
				{
					levelNameText.textContent = st.name;
					rightShape.clear();
					rightShape.copy(st.right);
					sumShape.clear();
					sumShape.copy(st.target);
					leftEditable = true;
					rightEditable = false;
					sumEditable = false;
					leftGrid = rightGrid = sumGrid = st.grid ?? 'square';
					if (st.type === 'show-level-bc') stage++;
					break;
				}
			case 'show-level-ab':
			case 'level-ab':
				{
					levelNameText.textContent = st.name;
					leftShape.clear();
					leftShape.copy(st.left);
					rightShape.clear();
					rightShape.copy(st.right);
					leftEditable = false;
					rightEditable = false;
					sumEditable = true;
					leftGrid = rightGrid = sumGrid = st.grid ?? 'square';
					if (st.type === 'show-level-ab') stage++;
					break;
				}
			case 'win':
				{
					tutorialBlock.classList.remove('hidden');
					confirmButton.classList.add('hidden');
					skipTutorialButton.classList.add('hidden');
					tutorialText.textContent = st.message;
					leftShape.clear();
					leftShape.copy(st.shape);
					rightShape.clear();
					rightShape.copy(st.shape);
					sumShape.clear();
					leftEditable = false;
					rightEditable = false;
					sumEditable = false;
					break;
				}
		}
	}
	leftCtx.clearRect(0, 0, left.clientWidth, left.clientHeight);
	rightCtx.clearRect(0, 0, right.clientWidth, right.clientHeight);
	sumCtx.clearRect(0, 0, sum.clientWidth, sum.clientHeight);
	grid(leftCtx, '#aaa', gridSize(leftGrid), gridAngles(leftGrid));
	grid(rightCtx, '#aaa', gridSize(rightGrid), gridAngles(rightGrid));
	grid(sumCtx, '#aaa', gridSize(sumGrid), gridAngles(sumGrid));
	const leftRect = left.getBoundingClientRect();
	const leftX = mouseX - leftRect.left;
	const leftY = mouseY - leftRect.top;
	const rightRect = right.getBoundingClientRect();
	const rightX = mouseX - rightRect.left;
	const rightY = mouseY - rightRect.top;
	const sumRect = sum.getBoundingClientRect();
	const sumX = mouseX - sumRect.left;
	const sumY = mouseY - sumRect.top;
	if (leftEditable) leftShape.draw(leftCtx, true, 'red');
	else leftShape.drawCentered(leftCtx, true, 'red');
	if (rightEditable) rightShape.draw(rightCtx, true, 'blue');
	else rightShape.drawCentered(rightCtx, true, 'blue');
	if (sumEditable) sumShape.draw(sumCtx, true, 'purple');
	else sumShape.drawCentered(sumCtx, true, 'green');
	if (!sumEditable) leftShape.sum(rightShape, sumCtx, 'purple');
	sumCtx.font = '50px serif';
	sumCtx.fillStyle = 'green';
	if (building !== null) {
		const buildingCtx = [leftCtx, rightCtx, sumCtx][buildingSide]!;
		switch (buildingWhat) {
			case 'line':
			case 'circle': {
				buildingCtx.fillStyle = 'red';
				buildingCtx.beginPath();
				buildingCtx.arc(...(building as [number, number]), 5, 0, 2 * Math.PI);
				buildingCtx.fill();
				break;
			}
			case 'polygon': {
				buildingCtx.fillStyle = 'red';
				for (const [pointX, pointY] of building) {
					buildingCtx.beginPath();
					buildingCtx.arc(pointX, pointY, 5, 0, 2 * Math.PI);
					buildingCtx.fill();
				}
				buildingCtx.fillStyle = '#ff000088'
				buildingCtx.strokeStyle = 'red';
				buildingCtx.lineWidth = 3;
				buildingCtx.setLineDash([3, 3]);
				buildingCtx.beginPath();
				buildingCtx.moveTo(...(building[0] as [number, number]));
				for (const [pointX, pointY] of building.slice(1)) {
					buildingCtx.lineTo(pointX, pointY);
				}
				buildingCtx.stroke();
				buildingCtx.lineTo(...(building[0] as [number, number]));
				buildingCtx.fill();
				buildingCtx.setLineDash([]);
				break;
			}
		}
	}
	if (leftEditable) leftClearButton.classList.remove('hidden');
	else leftClearButton.classList.add('hidden');
	if (rightEditable) rightClearButton.classList.remove('hidden');
	else rightClearButton.classList.add('hidden');
	if (sumEditable) sumClearButton.classList.remove('hidden');
	else sumClearButton.classList.add('hidden');
	if (leftEditable && leftX >= 0 && leftX < left.clientWidth && leftY >= 0 && leftY < left.clientHeight) {
		drawHover(leftCtx, leftX, leftY, left.clientWidth, left.clientHeight, leftGrid);
	}
	if (rightEditable && rightX >= 0 && rightX < right.clientWidth && rightY >= 0 && rightY < right.clientHeight) {
		drawHover(rightCtx, rightX, rightY, right.clientWidth, right.clientHeight, rightGrid);
	}
	if (sumEditable && sumX >= 0 && sumX < sum.clientWidth && sumY >= 0 && sumY < sum.clientHeight) {
		drawHover(sumCtx, sumX, sumY, sum.clientWidth, sum.clientHeight, sumGrid);
	}
	if (compare(leftShape, rightShape, sumShape)) {
		tutorialText.innerText = '';
		confirmButton.classList.add('hidden');
		nextLevelButton.classList.remove('hidden');
		tutorialBlock.classList.remove('hidden');
	}
	for (const toolButton of document.querySelectorAll<HTMLButtonElement>('.tool')) {
		if (toolButton.dataset.tool! === buildingWhat) toolButton.classList.add('active');
		else toolButton.classList.remove('active');
	}
	for (const gridButton of document.querySelectorAll<HTMLButtonElement>('.grid')) {
		if (buildingWhat === 'grid-selection' && gridButton.dataset.grid! === building) gridButton.classList.add('active');
		else gridButton.classList.remove('active');
	}
}

function drawHover(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, grid: Grid) {
	ctx.strokeStyle = 'blue';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(...snap(x, y, width, height, grid), 6, 0, 2 * Math.PI);
	ctx.stroke();
}

function makeClickListener(canvas: HTMLCanvasElement, shape: Shape, clickable: () => boolean, grid: () => Grid, setGrid: (grid: Grid) => void, side: 0 | 1 | 2) {
	return (evt: MouseEvent) => {
		if (buildingWhat === 'grid-selection') {
			setGrid(building);
			render();
			return;
		}
		if (clickable()) {
			const point = snap(evt.offsetX, evt.offsetY, canvas.clientWidth, canvas.clientHeight, grid());
			sw: switch (buildingWhat) {
				case 'point': {
					building = null;
					shape.point(...point);
					advancePlaceObject();
					break;
				}
				case 'line': {
					if (buildingSide !== side) {
						building = null;
						buildingSide = side;
					}
					if (building === null) {
						building = point;
					} else {
						shape.line(...(building as [number, number]), ...point);
						building = null;
						advancePlaceObject();
					}
					break;
				}
				case 'circle': {
					if (buildingSide !== side) {
						building = null;
						buildingSide = side;
					}
					if (building === null) {
						building = point;
					} else {
						shape.circle(...(building as [number, number]), Math.hypot(building[0] - point[0], building[1] - point[1]));
						building = null;
						advancePlaceObject();
					}
					break;
				}
				case 'polygon': {
					if (building === null || buildingSide !== side) {
						building = [];
						buildingSide = side;
					}
					for (const [idx, other] of building.entries()) {
						if (other[0] == point[0] && other[1] == point[1]) {
							if (idx == 0) {
								shape.polygon(building);
								building = null;
								advancePlaceObject();
								break sw;
							} else {
								building.splice(idx, 1);
								break sw;
							}
						}
					}
					building.push(point);
					break;
				}
				case 'eraser': {
					shape.erasePoint(...point);
					break;
				}
			}
			render();
		}
	};
}

function compare(a: Shape, b: Shape, target: Shape) {
	const ctx = new OffscreenCanvas(400, 300).getContext('2d')!;
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	target.drawAlwaysCentered(ctx, false, 'black');
	const targetPixels = Shape.pixels(ctx);
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	a.sum(b, ctx, 'black');
	const sumPixels = Shape.pixels(ctx);
	let sumC = 0, targetC = 0, bothC = 0;
	for (let i = 0; i < sumPixels.length; i++) {
		const targetPx = targetPixels[i], sumPx = sumPixels[i];
		sumC += Number(sumPx);
		targetC += Number(targetPx);
		bothC += Number(sumPx && targetPx);
	}
	const difference = sumC + targetC - 2 * bothC;
	return difference / targetC <= 0.1;
}

left.addEventListener('click', makeClickListener(left, leftShape, () => leftEditable, () => leftGrid, g => { leftGrid = g; }, 0));
right.addEventListener('click', makeClickListener(right, rightShape, () => rightEditable, () => rightGrid, g => { rightGrid = g; }, 1));
sum.addEventListener('click', makeClickListener(sum, sumShape, () => sumEditable, () => sumGrid, g => { sumGrid = g; }, 2));
leftClearButton.addEventListener('click', () => {
	leftShape.clear();
	render();
});
rightClearButton.addEventListener('click', () => {
	rightShape.clear();
	render();
});
sumClearButton.addEventListener('click', () => {
	sumShape.clear();
	render();
});
confirmButton.addEventListener('click', () => {
	advanceConfirm();
	render();
});
nextLevelButton.addEventListener('click', () => {
	nextLevelButton.classList.add('hidden');
	advanceCompleteLevel();
	render();
});
skipTutorialButton.addEventListener('click', () => {
	skipTutorial = true;
	skipTutorialButton.classList.add('hidden');
	advanceConfirm();
	render();
});
document.querySelector<HTMLButtonElement>('#levels-button')!.addEventListener('click', () => {
	levelSelect.classList.remove('hidden');
});
document.querySelector<HTMLButtonElement>('#sandbox-button')!.addEventListener('click', () => {
	tutorialBlock.classList.add('hidden');
	levelNameText.innerText = 'Playground';
	leftShape.clear();
	rightShape.clear();
	sumShape.clear();
	leftEditable = true;
	rightEditable = true;
	sumEditable = false;
	grids.classList.remove('hidden');
	render();
});
document.querySelector<HTMLButtonElement>('#level-select-close')!.addEventListener('click', () => {
	levelSelect.classList.add('hidden');
})
for (const toolButton of [...document.querySelectorAll<HTMLButtonElement>('.tool')]) {
	toolButton.addEventListener('click', () => {
		building = null;
		buildingWhat = toolButton.dataset.tool!;
		advanceSelectTool(buildingWhat);
	});
}
for (const gridButton of [...document.querySelectorAll<HTMLButtonElement>('.grid')]) {
	gridButton.addEventListener('click', () => {
		buildingWhat = 'grid-selection';
		building = gridButton.dataset.grid!;
	});
}

interface Tutorial {
	message: string;
}

interface TutorialWelcome extends Tutorial {
	type: 'tutorial-welcome';
}

interface TutorialConfirm extends Tutorial {
	type: 'tutorial-confirm';
}

interface TutorialSelectTool extends Tutorial {
	type: 'tutorial-select-tool';
	tool: string;
}

interface TutorialPlaceObject extends Tutorial {
	type: 'tutorial-place-object';
	hands?: string[];
}

interface TutorialCompleteLevel extends Tutorial {
	type: 'tutorial-complete-level';
}

interface Level {
	name: string;
	grid?: Grid;
}

interface ShowLevelBC extends Level {
	type: 'show-level-bc';
	right: Shape;
	target: Shape;
}

interface LevelBC extends Level {
	type: 'level-bc';
	right: Shape;
	target: Shape;
}

interface ShowLevelAB extends Level {
	type: 'show-level-ab';
	left: Shape;
	right: Shape;
}

interface LevelAB extends Level {
	type: 'level-ab';
	left: Shape;
	right: Shape;
}

interface Win {
	type: 'win';
	message: string;
	shape: Shape;
}

type Stage = TutorialWelcome | TutorialConfirm | TutorialSelectTool | TutorialPlaceObject | TutorialCompleteLevel | ShowLevelBC | LevelBC | ShowLevelAB | LevelAB | Win;

let stage = 0, lastRenderStage = -1;
let skipTutorial = false;

const stages: Stage[] = [
	{
		type: 'tutorial-welcome',
		message: 'Welcome to Minko! In this game you will learn a way of summing two shapes and by the end you will be able to predict what any two shapes sum to.',
	},
	{
		type: 'show-level-bc',
		name: 'Beginnings',
		right: new Shape()
			.polygon([
				[4.5 * gridUnit, 3.25 * gridUnit],
				[5.5 * gridUnit, 3.25 * gridUnit],
				[5.5 * gridUnit, 4.25 * gridUnit],
				[4.5 * gridUnit, 4.25 * gridUnit],
			]),
		target: new Shape()
			.polygon([
				[0 * gridUnit, 0 * gridUnit],
				[0 * gridUnit, 1 * gridUnit],
				[1 * gridUnit, 1 * gridUnit],
				[1 * gridUnit, 0 * gridUnit]
			])
			.polygon([
				[2 * gridUnit, 0 * gridUnit],
				[2 * gridUnit, 1 * gridUnit],
				[3 * gridUnit, 1 * gridUnit],
				[3 * gridUnit, 0 * gridUnit],
			])
			.polygon([
				[2 * gridUnit, 2 * gridUnit],
				[2 * gridUnit, 3 * gridUnit],
				[3 * gridUnit, 3 * gridUnit],
				[3 * gridUnit, 2 * gridUnit],
			])
			.polygon([
				[0 * gridUnit, 2 * gridUnit],
				[0 * gridUnit, 3 * gridUnit],
				[1 * gridUnit, 3 * gridUnit],
				[1 * gridUnit, 2 * gridUnit],
			])
			.polygon([
				[1 * gridUnit, 1 * gridUnit],
				[1 * gridUnit, 2 * gridUnit],
				[2 * gridUnit, 2 * gridUnit],
				[2 * gridUnit, 1 * gridUnit],
			]),
	},
	{
		type: 'tutorial-confirm',
		message: 'In each level, you have to create a shape in the first grid that when summed to the blue shape gives the green shape.',
	},
	{
		type: 'tutorial-place-object',
		message: 'Start by placing a point in the middle of the grid.',
		hands: ['hand-first-point'],
	},
	{
		type: 'tutorial-place-object',
		message: 'Next, place a point where indicated by the hand.',
		hands: ['hand-second-point'],
	},
	{
		type: 'tutorial-confirm',
		message: 'If you accidentally draw something that you didn\'t mean to, you can use the Clear button.',
	},
	{
		type: 'tutorial-complete-level',
		message: 'Now complete the level!',
	},
	{
		type: 'show-level-bc',
		name: 'Lines',
		right: new Shape()
			.circle(5 * gridUnit, 3.75 * gridUnit, gridUnit),
		target: new Shape()
			.domPath(new Path2D(`M 0.5281912,0
A 0.26409412,0.26409411 0 0 0 0.2640956,0.26409558 0.26409412,0.26409411 0 0 0 0,0.52819116 0.26409412,0.26409411 0 0 0 0.2640956,0.79228684 0.26409412,0.26409411 0 0 0 0.5281912,1.0563824 0.26409412,0.26409411 0 0 0 0.79228683,0.79228684 0.26409412,0.26409411 0 0 0 1.0563824,0.52819116 0.26409412,0.26409411 0 0 0 0.79228683,0.26409558 0.26409412,0.26409411 0 0 0 0.5281912,0
Z`.replaceAll(/[\d\.-]+/g, digits => (Number.parseFloat(digits) * 3.8 * gridUnit).toString()))),
	},
	{
		type: 'tutorial-select-tool',
		message: 'Now select the Line tool.',
		tool: 'line',
	},
	{
		type: 'tutorial-place-object',
		message: 'Select these two points to draw a line between them.',
		hands: ['hand-first-line-a', 'hand-first-line-b'],
	},
	{
		type: 'tutorial-complete-level',
		message: 'Complete the level.',
	},
	{
		type: 'level-bc',
		name: 'By yourself',
		right: new Shape()
			.line(4 * gridUnit, 3.75 * gridUnit, 6 * gridUnit, 3.75 * gridUnit),
		target: new Shape()
			.polygon([
				[1 * gridUnit, 0 * gridUnit],
				[3 * gridUnit, 0 * gridUnit],
				[2 * gridUnit, 2 * gridUnit],
				[0 * gridUnit, 2 * gridUnit],
			]),
	},
	{
		type: 'show-level-bc',
		name: 'The second dimension',
		right: new Shape()
			.point(6 * gridUnit, 2.75 * gridUnit)
			.point(4 * gridUnit, 4.75 * gridUnit),
		target: new Shape()
			.polygon([
				[2 * gridUnit, 0 * gridUnit],
				[3 * gridUnit, 0 * gridUnit],
				[3 * gridUnit, 2 * gridUnit],
				[4 * gridUnit, 2 * gridUnit],
				[4 * gridUnit, 1 * gridUnit],
				[2 * gridUnit, 1 * gridUnit],
			])
			.polygon([
				[0 * gridUnit, 2 * gridUnit],
				[1 * gridUnit, 2 * gridUnit],
				[1 * gridUnit, 4 * gridUnit],
				[2 * gridUnit, 4 * gridUnit],
				[2 * gridUnit, 3 * gridUnit],
				[0 * gridUnit, 3 * gridUnit],
			]),
	},
	{
		type: 'tutorial-select-tool',
		message: 'Select the Polygon tool to draw a polygon.',
		tool: 'polygon',
	},
	{
		type: 'tutorial-place-object',
		message: 'Click the points in order (either clockwise or anticlockwise) to create a polygon.',
		hands: ['hand-first-polygon-a', 'hand-first-polygon-b', 'hand-first-polygon-c', 'hand-first-polygon-d'],
	},
	{
		type: 'tutorial-complete-level',
		message: 'Draw the correct polygon to complete the level.',
	},
	{
		type: 'level-bc',
		name: 'Dilation',
		right: new Shape()
			.polygon([
				[4.75 * gridUnit, 3.5 * gridUnit],
				[5.25 * gridUnit, 3.5 * gridUnit],
				[5.25 * gridUnit, 4 * gridUnit],
				[4.75 * gridUnit, 4 * gridUnit],
			]),
		target: new Shape()
			.domPath(new Path2D(`M 0.26458333,0 0,0.52916666
v 0.1322917
H 0.13229166 0.52916667 0.66145833
V 0.52916666
L 0.396875,0
Z`.replaceAll(/[\d\.-]+/g, digits => (Number.parseFloat(digits) * 3.7 * gridUnit).toString()))),
	},
	{
		type: 'level-bc',
		name: 'Dilation II',
		right: new Shape()
			.circle(5 * gridUnit, 3.75 * gridUnit, 0.25 * gridUnit),
		target: new Shape()
			.domPath(new Path2D(`M 0.33072914,4.4516127e-7
C 0.28508518,-0.00158536 0.26906978,0.04229238 0.25237742,0.07557201 0.17100769,0.23831145 0.08963795,0.40105088 0.00826823,0.56379032
c -0.03154812,0.0549088 0.02704046,0.10633546 0.08032829,0.0976685 0.16890534,0 0.33781068,0 0.50671602,0 0.0522796,0.002623 0.0828385,-0.0620195 0.0558837,-0.10268863
C 0.5638387,0.38405465 0.47648113,0.20933914 0.38912354,0.03462365 0.37796217,0.0135158 0.35460394,-3.3375947e-4 0.33072914,4.4516127e-7
Z`.replaceAll(/[\d\.-]+/g, digits => (Number.parseFloat(digits) * 3.8 * gridUnit).toString()))),
	},
	{
		type: 'level-bc',
		name: 'Enlargement',
		right: new Shape()
			.polygon([
				[3.5 * gridUnit, 4.75 * gridUnit],
				[5.5 * gridUnit, 2.75 * gridUnit],
				[6.5 * gridUnit, 4.75 * gridUnit],
			]),
		target: new Shape()
			.polygon([
				[0 * gridUnit, 4 * gridUnit],
				[4 * gridUnit, 0 * gridUnit],
				[6 * gridUnit, 4 * gridUnit],
			]),
	},
	{
		type: 'show-level-ab',
		name: 'Alternate request',
		left: new Shape()
			.polygon([
				[4.5 * gridUnit, 3.25 * gridUnit],
				[5.5 * gridUnit, 3.25 * gridUnit],
				[5.5 * gridUnit, 4.25 * gridUnit],
				[4.5 * gridUnit, 4.25 * gridUnit],
			]),
		right: new Shape()
			.polygon([
				[4.5 * gridUnit, 3.25 * gridUnit],
				[5.5 * gridUnit, 3.25 * gridUnit],
				[5.5 * gridUnit, 4.25 * gridUnit],
				[4.5 * gridUnit, 4.25 * gridUnit],
			]),
	},
	{
		type: 'tutorial-complete-level',
		message: 'In this level, you are given the red and blue shapes and must deduce the purple one.',
	},
	{
		type: 'level-ab',
		name: 'Two triangles',
		left: new Shape()
			.polygon([
				[0 * gridUnit, 2 * gridUnit],
				[1 * gridUnit, 0 * gridUnit],
				[2 * gridUnit, 2 * gridUnit],
			]),
		right: new Shape()
			.polygon([
				[0 * gridUnit, 0 * gridUnit],
				[1 * gridUnit, 2 * gridUnit],
				[2 * gridUnit, 0 * gridUnit],
			]),
	},
	{
		type: 'level-ab',
		name: 'Cap and cup',
		left: new Shape(true)
			.polygon([
				[3 * gridUnit, 2.75 * gridUnit],
				[7 * gridUnit, 2.75 * gridUnit],
				[7 * gridUnit, 4.75 * gridUnit],
				[6 * gridUnit, 4.75 * gridUnit],
				[6 * gridUnit, 3.75 * gridUnit],
				[4 * gridUnit, 3.75 * gridUnit],
				[4 * gridUnit, 4.75 * gridUnit],
				[3 * gridUnit, 4.75 * gridUnit],
			]),
		right: new Shape(true)
			.polygon([
				[3 * gridUnit, 4.75 * gridUnit],
				[7 * gridUnit, 4.75 * gridUnit],
				[7 * gridUnit, 2.75 * gridUnit],
				[6 * gridUnit, 2.75 * gridUnit],
				[6 * gridUnit, 3.75 * gridUnit],
				[4 * gridUnit, 3.75 * gridUnit],
				[4 * gridUnit, 2.75 * gridUnit],
				[3 * gridUnit, 2.75 * gridUnit],
			]),
	},
	{
		type: 'level-ab',
		name: 'Enlargement failure',
		left: new Shape(true)
			.polygon([
				[3 * gridUnit, 2.75 * gridUnit],
				[7 * gridUnit, 2.75 * gridUnit],
				[7 * gridUnit, 4.75 * gridUnit],
				[6 * gridUnit, 4.75 * gridUnit],
				[6 * gridUnit, 3.75 * gridUnit],
				[4 * gridUnit, 3.75 * gridUnit],
				[4 * gridUnit, 4.75 * gridUnit],
				[3 * gridUnit, 4.75 * gridUnit],
			]),
		right: new Shape(true)
			.polygon([
				[3 * gridUnit, 2.75 * gridUnit],
				[7 * gridUnit, 2.75 * gridUnit],
				[7 * gridUnit, 4.75 * gridUnit],
				[6 * gridUnit, 4.75 * gridUnit],
				[6 * gridUnit, 3.75 * gridUnit],
				[4 * gridUnit, 3.75 * gridUnit],
				[4 * gridUnit, 4.75 * gridUnit],
				[3 * gridUnit, 4.75 * gridUnit],
			]),
	},
	{
		type: 'show-level-bc',
		name: 'Two triangles II',
		grid: 'triangle',
		right: new Shape(true)
			.polygon([
				[right.clientWidth / 2 - 2 / Math.sqrt(3) * gridUnit, 3.75 * gridUnit],
				[right.clientWidth / 2, 5.75 * gridUnit],
				[right.clientWidth / 2 + 2 / Math.sqrt(3) * gridUnit, 3.75 * gridUnit],
			]),
		target: new Shape()
			.polygon([
				[2 / Math.sqrt(3) * gridUnit, 0 * gridUnit],
				[6 / Math.sqrt(3) * gridUnit, 0 * gridUnit],
				[8 / Math.sqrt(3) * gridUnit, 2 * gridUnit],
				[6 / Math.sqrt(3) * gridUnit, 4 * gridUnit],
				[2 / Math.sqrt(3) * gridUnit, 4 * gridUnit],
				[0 * gridUnit, 2 * gridUnit],
			]),
	},
	{
		type: 'tutorial-complete-level',
		message: 'This level has a triangular grid. It works the same way as the normal square grid but it has 60° angles, allowing you to draw regular triangles and hexagons.'
	},
	{
		type: 'show-level-bc',
		name: 'Sierpinski',
		grid: 'triangle',
		right: new Shape(true)
			.point(sum.clientWidth / 2 - 2 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2)
			.point(sum.clientWidth / 2 + 2 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2)
			.point(sum.clientWidth / 2, sum.clientHeight / 2 - 2 * gridUnit),
		target: new Shape(true)
			.polygon([
				[sum.clientWidth / 2 - 4 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 2 * gridUnit],
				[sum.clientWidth / 2 - 3 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 1 * gridUnit],
				[sum.clientWidth / 2 - 2 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 2 * gridUnit],
			])
			.polygon([
				[sum.clientWidth / 2 - 2 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 2 * gridUnit],
				[sum.clientWidth / 2 - 1 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 1 * gridUnit],
				[sum.clientWidth / 2 - 0 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 2 * gridUnit],
			])
			.polygon([
				[sum.clientWidth / 2 + 0 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 2 * gridUnit],
				[sum.clientWidth / 2 + 1 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 1 * gridUnit],
				[sum.clientWidth / 2 + 2 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 2 * gridUnit],
			])
			.polygon([
				[sum.clientWidth / 2 + 2 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 2 * gridUnit],
				[sum.clientWidth / 2 + 3 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 1 * gridUnit],
				[sum.clientWidth / 2 + 4 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 2 * gridUnit],
			])
			.polygon([
				[sum.clientWidth / 2 - 3 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 1 * gridUnit],
				[sum.clientWidth / 2 - 2 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 0 * gridUnit],
				[sum.clientWidth / 2 - 1 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 1 * gridUnit],
			])
			.polygon([
				[sum.clientWidth / 2 + 1 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 1 * gridUnit],
				[sum.clientWidth / 2 + 2 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 0 * gridUnit],
				[sum.clientWidth / 2 + 3 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 + 1 * gridUnit],
			])
			.polygon([
				[sum.clientWidth / 2 - 2 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 - 0 * gridUnit],
				[sum.clientWidth / 2 - 1 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 - 1 * gridUnit],
				[sum.clientWidth / 2 - 0 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 - 0 * gridUnit],
			])
			.polygon([
				[sum.clientWidth / 2 + 0 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 - 0 * gridUnit],
				[sum.clientWidth / 2 + 1 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 - 1 * gridUnit],
				[sum.clientWidth / 2 + 2 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 - 0 * gridUnit],
			])
			.polygon([
				[sum.clientWidth / 2 - 1 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 - 1 * gridUnit],
				[sum.clientWidth / 2 + 0 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 - 2 * gridUnit],
				[sum.clientWidth / 2 + 1 / Math.sqrt(3) * gridUnit, sum.clientHeight / 2 - 1 * gridUnit],
			]),
	},
	{
		type: 'level-ab',
		name: 'Washington Monument',
		grid: 'fine-triangle',
		left: new Shape(true)
			.polygon([
				[left.clientWidth / 2 - 1 / Math.sqrt(3) * gridUnit, left.clientHeight / 2 + gridUnit],
				[left.clientWidth / 2, left.clientHeight / 2],
				[left.clientWidth / 2 + 1 / Math.sqrt(3) * gridUnit, left.clientHeight / 2 + gridUnit],
			]),
		right: new Shape(true)
			.polygon([
				[right.clientWidth / 2 - 1 / Math.sqrt(3) * gridUnit, right.clientHeight / 2 + 3 * gridUnit],
				[right.clientWidth / 2 , right.clientHeight / 2 - 2 * gridUnit],
				[right.clientWidth / 2 + 1 / Math.sqrt(3) * gridUnit, right.clientHeight / 2 + 3 * gridUnit],
			]),
	},
	{
		type: 'win',
		message: 'You beat the game! Congratulations!',
		shape: new Shape()
			.domPath(new Path2D(`M 39.6875,2.711204e-7
C 35.599376,8.2832149 31.511256,16.56643 27.423132,24.849645 18.282088,26.177729 9.1410438,27.505813 -2.846231e-7,28.833898 6.614583,35.281564 13.229167,41.729233 19.84375,48.176902 18.282088,57.281257 16.720427,66.385608 15.158765,75.489963 23.33501,71.191518 31.511256,66.893073 39.6875,62.594625 47.863745,66.893073 56.03999,71.191518 64.216234,75.489963 62.654572,66.385608 61.092911,57.281257 59.531249,48.176902 66.145831,41.729233 72.760414,35.281564 79.375,28.833898 70.233955,27.505813 61.092911,26.177729 51.951866,24.849645 47.863745,16.56643 43.775621,8.2832149 39.6875,2.711204e-7
Z

M 39.6875,10.230383
c 3.065961,6.212023 6.131925,12.424047 9.197886,18.636071 6.855915,0.996321 13.711826,1.992642 20.567738,2.988963 -4.960938,4.835883 -9.921875,9.671763 -14.882813,14.507643 1.17099,6.828006 2.341977,13.656014 3.512964,20.48402
C 51.95135,63.623505 45.819425,60.399927 39.6875,57.176353 33.555575,60.399927 27.423649,63.623505 21.291724,66.84708 22.462712,60.019074 23.633699,53.191066 24.804687,46.36306 19.84375,41.52718 14.882813,36.6913 9.9218753,31.855417 16.777787,30.859096 23.633699,29.862775 30.489612,28.866454 33.555575,22.65443 36.621536,16.442406 39.6875,10.230383
Z`)),
	},
]

function advanceCommon() {
	stage++;
	tutorialBlock.classList.add('hidden');
	document.querySelectorAll('.hand').forEach(hand => hand.classList.add('hidden'));
	render();
}

function advanceConfirm() {
	if (stages[stage]!.type === 'tutorial-confirm' || stages[stage]!.type === 'tutorial-welcome') advanceCommon();
}

function advanceSelectTool(tool: string) {
	if (stages[stage]!.type === 'tutorial-select-tool' && (stages[stage] as TutorialSelectTool).tool === tool) advanceCommon();
}

function advancePlaceObject() {
	if (stages[stage]!.type === 'tutorial-place-object') advanceCommon();
}

function advanceCompleteLevel() {
	if (stages[stage]!.type === 'tutorial-complete-level' || stages[stage]!.type === 'level-bc' || stages[stage]!.type === 'level-ab') {
		leftShape.clear();
		rightShape.clear();
		sumShape.clear();
		advanceCommon();
	} else {
		stage++;
		advanceCompleteLevel();
	}
}

{
	let levelIndex = 0;
	for (const [idx, st] of stages.entries()) {
		if (st.type === 'level-bc' || st.type === 'show-level-bc' || st.type === 'level-ab' || st.type === 'show-level-ab') {
			levelIndex++;
			const wrapper = document.createElement('div');
			const canv = document.createElement('canvas');
			canv.width = 200;
			canv.height = 150;
			const number = document.createElement('span');
			number.textContent = levelIndex.toString();
			const title = document.createElement('span');
			title.textContent = st.name;
			const offscreen = new OffscreenCanvas(400, 300);
			const offscreenCtx = offscreen.getContext('2d')!;
			if (st.type === 'level-bc' || st.type === 'show-level-bc') {
				st.target.drawCentered(offscreenCtx, true, 'green');
			} else if (st.type === 'level-ab' || st.type === 'show-level-ab') {
				st.left.drawCentered(offscreenCtx, true, 'red');
				st.right.drawCentered(offscreenCtx, true, 'blue');
			}
			const ctx = canv.getContext('2d')!;
			ctx.drawImage(offscreen, 0, 0, 200, 150);
			wrapper.appendChild(canv);
			wrapper.appendChild(number);
			wrapper.appendChild(title);
			levelSelect.appendChild(wrapper);
			wrapper.addEventListener('click', () => {
				stage = idx;
				levelSelect.classList.add('hidden');
				leftShape.clear();
				rightShape.clear();
				sumShape.clear();
				render();
			});
		}
	}
}

render();

