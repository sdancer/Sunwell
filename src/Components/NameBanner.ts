import Card from "../Card";
import {getCharDimensions, getPointOnCurve} from "../helpers";
import {ICoords, IPoint} from "../interfaces";
import Sunwell from "../Sunwell";

export default class NameBanner {
	private sunwell: Sunwell;
	private parent: Card;

	constructor(sunwell: Sunwell, parent: Card) {
		this.sunwell = sunwell;
		this.parent = parent;
	}

	public assets(): string[] {
		return [this.parent.nameBannerAsset];
	}

	public render(context: CanvasRenderingContext2D, ratio: number) {
		if (!this.parent.nameBannerAsset) {
			return;
		}
		const coords = this.parent.nameBannerCoords;
		coords.ratio = ratio;
		this.sunwell.drawImage(context, this.parent.nameBannerAsset, coords);

		this.renderName(context, ratio, this.parent.cardDef.name);
	}

	private renderName(context: CanvasRenderingContext2D, ratio: number, name: string): void {
		// define a box to contain the curved text
		const boxDims = {width: 460, height: 160};
		const boxBottomCenter = {x: 335, y: 612};
		// create a new buffer to draw onto
		const buffer = this.sunwell.getBuffer(boxDims.width * 2, boxDims.height, true);
		const textContext = buffer.getContext("2d");
		const maxWidth = this.parent.nameTextCurve.maxWidth;
		const curve = this.parent.nameTextCurve.curve;
		textContext.save();

		textContext.lineCap = "round";
		textContext.lineJoin = "round";
		textContext.lineWidth = 10;
		textContext.strokeStyle = "black";
		textContext.textAlign = "left";
		textContext.textBaseline = "middle";

		let fontSize = 45;
		let dimensions = [];
		do {
			fontSize -= 1;
			textContext.font = `${fontSize}px ${this.sunwell.options.titleFont}`;
		} while (
			(dimensions = getCharDimensions(name, textContext)).reduce((a, b) => a + b.width, 0) >
				maxWidth &&
			fontSize > 10
		);

		const textWidth = dimensions.reduce((a, b) => a + b.width, 0) / maxWidth;
		const begin = this.parent.nameTextCurve.pathMiddle - textWidth / 2;
		const steps = textWidth / name.length;

		// draw text
		let p: IPoint;
		let t: number;
		let leftPos = 0;
		for (let i = 0; i < name.length; i++) {
			const char = name[i].trim();
			const dimension = dimensions[i];
			if (leftPos === 0) {
				t = begin + steps * i;
				p = getPointOnCurve(curve, t);
				leftPos = p.x;
			} else {
				t += 0.01;
				p = getPointOnCurve(curve, t);
				while (p.x < leftPos) {
					t += 0.001;
					p = getPointOnCurve(curve, t);
				}
			}

			if (char.length) {
				textContext.save();
				textContext.translate(p.x, p.y);

				if (dimension.scale.x) {
					textContext.scale(dimension.scale.x, dimension.scale.y);
				}
				// textContext.setTransform(1.2, p.r, 0, 1, p.x, p.y);
				textContext.rotate(p.r);

				// shadow
				textContext.lineWidth = 9 * (fontSize / 50);
				textContext.strokeStyle = "black";
				textContext.fillStyle = "black";
				textContext.fillText(char, 0, 0);
				textContext.strokeText(char, 0, 0);

				// text
				textContext.fillStyle = "white";
				textContext.strokeStyle = "white";
				textContext.lineWidth = 2.5 * (fontSize / 50);
				textContext.fillText(char, 0, 0);

				textContext.restore();
			}

			leftPos += dimension.width;
		}

		const coords: ICoords = {
			sx: 0,
			sy: 0,
			sWidth: boxDims.width,
			sHeight: boxDims.height,
			dx: (boxBottomCenter.x - boxDims.width / 2) * ratio,
			dy: (boxBottomCenter.y - boxDims.height) * ratio,
			dWidth: boxDims.width * ratio,
			dHeight: boxDims.height * ratio,
		};
		context.drawImage(
			buffer,
			coords.sx,
			coords.sy,
			coords.sWidth,
			coords.sHeight,
			coords.dx,
			coords.dy,
			coords.dWidth,
			coords.dHeight
		);
		this.sunwell.freeBuffer(buffer);
	}
}
