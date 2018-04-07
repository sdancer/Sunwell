import LineBreaker from "linebreak";
import CardDef from "./CardDef";
import AttackGem from "./Components/AttackGem";
import CardFrame from "./Components/CardFrame";
import CostGem from "./Components/CostGem";
import HealthGem from "./Components/HealthGem";
import MultiClassBanner from "./Components/MultiClassBanner";
import RaceBanner from "./Components/RaceBanner";
import RarityGem from "./Components/RarityGem";
import Watermark from "./Components/Watermark";
import {CardClass, CardSet, CardType, MultiClassGroup, Rarity} from "./Enums";
import {
	contextBoundingBox,
	drawPolygon,
	finishLine,
	getCardFrameClass,
	getCharDimensions,
	getNumberStyle,
	getPointOnCurve,
	getRaceText,
	getRarityGem,
} from "./helpers";
import {ICoords, IPoint} from "./interfaces";
import Sunwell from "./Sunwell";

const CTRL_BOLD_START = "\x11";
const CTRL_BOLD_END = "\x12";
const CTRL_ITALIC_START = "\x13";
const CTRL_ITALIC_END = "\x14";

const ReferenceWidth = 670;
const ReferenceHeight = 1000;

export default abstract class Card {
	public cardDef: CardDef;
	public target;
	public texture;
	public canvas: HTMLCanvasElement;
	public bodyText: string;
	public raceText: string;
	public language: string;
	public costColor: string;
	public attackColor: string;
	public healthColor: string;
	public width: number;
	public key: number;
	public opposing: boolean;
	public attackGem: AttackGem;
	public cardFrame: CardFrame;
	public costGem: CostGem;
	public healthGem: HealthGem;
	public multiClassBanner: MultiClassBanner;
	public raceBanner: RaceBanner;
	public rarityGem: RarityGem;
	public watermark: Watermark;
	public raceBannerAsset = "";
	public raceTextCoords = {dx: 337, dy: 829};
	public raceBannerCoords: ICoords = {
		dx: 129,
		dy: 791,
		dWidth: 408,
		dHeight: 69,
		sWidth: 408,
		sHeight: 69,
	};

	public abstract baseCardFrameAsset: string;
	public abstract baseCardFrameCoords: ICoords;
	public abstract baseRarityGemAsset: string;
	public abstract rarityGemCoords: ICoords;
	public abstract bodyTextColor: string;
	public abstract nameBannerAsset: string;
	public abstract dragonAsset: string;
	public abstract dragonCoords: ICoords;
	public abstract nameBannerCoords: ICoords;
	public abstract bodyTextCoords: ICoords;
	public abstract nameTextCurve: {
		pathMiddle: number;
		maxWidth: number;
		curve: IPoint[];
	};
	public abstract artClipPolygon: IPoint[];
	public abstract artCoords: ICoords;
	public abstract cardFoundationAsset: string;
	public abstract cardFoundationCoords: ICoords;
	public abstract premium: boolean;

	private callback: (HTMLCanvasElement) => void;
	private cacheKey: number;
	private propsJson: string;
	private sunwell: Sunwell;

	constructor(sunwell: Sunwell, props) {
		this.sunwell = sunwell;
		if (!props) {
			throw new Error("No card properties given");
		}

		this.cardDef = new CardDef(props);
		this.language = props.language || "enUS";

		// Sets the player or opponent HeroPower texture
		this.opposing = props.opposing || false;

		this.bodyText = this.cardDef.collectionText || this.cardDef.text;
		this.raceText = getRaceText(this.cardDef.race, this.cardDef.type, this.language);
		this.costColor = getNumberStyle(props.costStyle);
		this.attackColor = getNumberStyle(props.costStyle);
		this.healthColor = getNumberStyle(props.healthStyle);
		this.texture = props.texture;
		this.propsJson = JSON.stringify(props);

		this.cardFrame = new CardFrame(sunwell, this);
		this.attackGem = new AttackGem(sunwell, this);
		this.costGem = new CostGem(sunwell, this);
		this.healthGem = new HealthGem(sunwell, this);
		this.multiClassBanner = new MultiClassBanner(sunwell, this);
		this.raceBanner = new RaceBanner(sunwell, this);
		this.rarityGem = new RarityGem(sunwell, this);
		this.watermark = new Watermark(sunwell, this);
	}

	public abstract getWatermarkCoords(): ICoords;

	public getAttackGemAsset(): string {
		return "";
	}

	public getAttackGemCoords(): ICoords {
		return null;
	}

	public getAttackTextCoords(): ICoords {
		return null;
	}

	public getCostGemCoords(): ICoords {
		if (this.cardDef.costsHealth) {
			return {dx: 43, dy: 58};
		} else {
			return {dx: 47, dy: 105};
		}
	}

	public getCostTextCoords(): ICoords {
		return {dx: 115, dy: 174};
	}

	public getCostGemAsset(): string {
		if (this.cardDef.hideStats) {
			return "";
		} else if (this.cardDef.costsHealth) {
			return "cost-health";
		} else {
			return "cost-mana";
		}
	}

	public getHealthGemAsset(): string {
		return "";
	}

	public getHealthGemCoords(): ICoords {
		return null;
	}

	public getHealthTextCoords(): ICoords {
		return null;
	}

	public initRender(width: number, target, callback?: (HTMLCanvasElement) => void): void {
		this.width = width;
		this.target = target;
		this.callback = callback;
		this.cacheKey = this.checksum();
		this.key = this.cacheKey;
	}

	public getAssetsToLoad(): string[] {
		const assetsToCheck = [this.cardFoundationAsset, this.nameBannerAsset];
		const assetsToLoad: string[] = [];
		for (const asset of assetsToCheck) {
			if (asset) {
				assetsToLoad.push(asset);
			}
		}

		if (this.cardDef.elite && this.dragonAsset) {
			assetsToLoad.push(this.dragonAsset);
		}

		assetsToLoad.push(...this.attackGem.assets());
		assetsToLoad.push(...this.cardFrame.assets());
		assetsToLoad.push(...this.costGem.assets());
		assetsToLoad.push(...this.healthGem.assets());
		assetsToLoad.push(...this.multiClassBanner.assets());
		assetsToLoad.push(...this.raceBanner.assets());
		assetsToLoad.push(...this.rarityGem.assets());
		assetsToLoad.push(...this.watermark.assets());

		if (this.cardDef.silenced) {
			assetsToLoad.push("silence-x");
		}

		return assetsToLoad;
	}

	public getCardArtTexture(): any {
		if (!this.texture) {
			this.sunwell.log("No card texture specified. Creating empty texture.");
			return this.sunwell.getBuffer(1024, 1024);
		} else if (this.texture instanceof this.sunwell.platform.Image) {
			return this.texture;
		} else if (typeof this.texture === "string") {
			return this.sunwell.assets[this.texture];
		} else {
			const t = this.sunwell.getBuffer(this.texture.crop.w, this.texture.crop.h);
			const tCtx = t.getContext("2d");
			tCtx.drawImage(
				this.texture.image,
				this.texture.crop.x,
				this.texture.crop.y,
				this.texture.crop.w,
				this.texture.crop.h,
				0,
				0,
				t.width,
				t.height
			);
			return t;
		}
	}

	public draw(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
		const ratio = this.width / ReferenceWidth;

		const drawTimeout = setTimeout(() => {
			this.sunwell.error("Drawing timed out", this.cardDef.name);
		}, this.sunwell.options.drawTimeout);

		context.save();
		context.clearRect(0, 0, canvas.width, canvas.height);

		// >>>>> Begin Skeleton drawing
		if (this.sunwell.renderCache[this.cacheKey]) {
			this.sunwell.log("Skipping skeleton draw");
			context.drawImage(this.sunwell.renderCache[this.cacheKey], 0, 0);
		} else {
			this.drawCardArt(context, ratio);

			if (this.cardFoundationAsset) {
				this.drawCardFoundationAsset(context, ratio);
			}

			this.cardFrame.render(context, ratio);
			this.raceBanner.render(context, ratio);
			this.attackGem.render(context, ratio);
			this.multiClassBanner.render(context, ratio);
			this.costGem.render(context, ratio);
			this.healthGem.render(context, ratio);
			this.rarityGem.render(context, ratio);

			if (this.nameBannerAsset) {
				this.drawNameBanner(context, ratio);
			}

			if (this.cardDef.elite && this.dragonAsset) {
				const coords = this.dragonCoords;
				coords.ratio = ratio;
				this.sunwell.drawImage(context, this.dragonAsset, coords);
			}

			this.watermark.render(context, ratio);

			if (this.sunwell.options.cacheSkeleton) {
				const cacheImage = new this.sunwell.platform.Image();
				cacheImage.src = canvas.toDataURL();
				this.sunwell.renderCache[this.cacheKey] = cacheImage;
			}
		}

		// <<<<<<<< Finished Skeleton drawing

		this.drawName(context, ratio, this.cardDef.name);
		this.drawBodyText(context, ratio, false, this.bodyText);

		if (this.cardDef.silenced) {
			this.sunwell.drawImage(context, "silence-x", {dx: 166, dy: 584, ratio: ratio});
		}

		context.restore();
		clearTimeout(drawTimeout);

		if (this.callback) {
			this.callback(canvas);
		}

		if (this.target) {
			this.target.src = canvas.toDataURL();
		}
	}

	public drawCardArt(context, ratio: number) {
		const t = this.getCardArtTexture();

		context.save();
		drawPolygon(context, this.artClipPolygon, ratio);
		context.clip();
		context.fillStyle = "grey";
		context.fillRect(0, 0, ReferenceWidth * ratio, ReferenceHeight * ratio);
		context.drawImage(
			t,
			0,
			0,
			t.width,
			t.height,
			this.artCoords.dx * ratio,
			this.artCoords.dy * ratio,
			this.artCoords.dWidth * ratio,
			this.artCoords.dHeight * ratio
		);
		context.restore();
	}

	public drawBodyText(
		context: CanvasRenderingContext2D,
		s: number,
		forceSmallerFirstLine: boolean,
		text: string
	): void {
		const manualBreak = text.substr(0, 3) === "[x]";
		let bodyText = manualBreak ? text.substr(3) : text;
		if (!bodyText) {
			return;
		}

		let xPos = 0;
		let yPos = 0;
		let italic = 0;
		let bold = 0;
		let lineCount = 0;
		let justLineBreak: boolean;
		let pBodyText: string;
		// size of the description text box
		const bodyWidth = this.bodyTextCoords.dWidth;
		const bodyHeight = this.bodyTextCoords.dHeight;
		// center of description box (x, y)
		const centerLeft = this.bodyTextCoords.dx + bodyWidth / 2;
		const centerTop = this.bodyTextCoords.dy + bodyHeight / 2;

		// draw the text box in debug mode
		if (this.sunwell.options.debug) {
			context.save();
			context.strokeStyle = "red";
			context.beginPath();
			context.rect(
				(centerLeft - bodyWidth / 2) * s,
				(centerTop - bodyHeight / 2) * s,
				bodyWidth * s,
				bodyHeight * s
			);
			context.closePath();
			context.stroke();
			context.restore();
		}

		// Replace HTML tags with control characters
		pBodyText = bodyText
			.replace(/<b>/g, CTRL_BOLD_START)
			.replace(/<\/b>/g, CTRL_BOLD_END)
			.replace(/<i>/g, CTRL_ITALIC_START)
			.replace(/<\/i>/g, CTRL_ITALIC_END);

		const pluralRegex = /(\d+)(.+?)\|4\((.+?),(.+?)\)/g;
		let plurals: RegExpExecArray;
		while ((plurals = pluralRegex.exec(bodyText)) !== null) {
			pBodyText = pBodyText.replace(
				plurals[0],
				plurals[1] + plurals[2] + (parseInt(plurals[1], 10) === 1 ? plurals[3] : plurals[4])
			);
		}

		let spellDmg: RegExpExecArray;
		const spellDamageRegex = /\$(\d+)/;
		while ((spellDmg = spellDamageRegex.exec(pBodyText)) !== null) {
			pBodyText = pBodyText.replace(spellDmg[0], spellDmg[1]);
		}

		let spellHeal: RegExpExecArray;
		const spellHealRegex = /#(\d+)/;
		while ((spellHeal = spellHealRegex.exec(pBodyText)) !== null) {
			pBodyText = pBodyText.replace(spellHeal[0], spellHeal[1]);
		}

		bodyText = pBodyText;
		this.sunwell.log("Rendering body", bodyText);

		const words = [];
		const breaker = new LineBreaker(bodyText);
		let last = 0;
		let bk;
		while ((bk = breaker.nextBreak())) {
			words.push(bodyText.slice(last, bk.position).replace("\n", ""));
			last = bk.position;
			if (bk.required) {
				words.push("\n");
			}
		}

		const bufferText = this.sunwell.getBuffer(bodyWidth, bodyHeight, true);
		const bufferTextCtx = bufferText.getContext("2d");
		bufferTextCtx.fillStyle = this.bodyTextColor;

		let fontSize = this.sunwell.options.bodyFontSize;
		let lineHeight = this.sunwell.options.bodyLineHeight;
		const totalLength = bodyText.length;
		this.sunwell.log("Length of text is " + totalLength);

		const bufferRow = this.sunwell.getBuffer(bufferText.width, lineHeight, true);
		const bufferRowCtx = bufferRow.getContext("2d");
		bufferRowCtx.fillStyle = this.bodyTextColor;
		// bufferRowCtx.textBaseline = this.sunwell.options.bodyBaseline;

		if (manualBreak) {
			let maxWidth = 0;
			bufferRowCtx.font = this.getFontMaterial(fontSize, false, false);
			bodyText.split("\n").forEach((line: string) => {
				const width = this.getLineWidth(bufferRowCtx, fontSize, line);
				if (width > maxWidth) {
					maxWidth = width;
				}
			});
			if (maxWidth > bufferText.width) {
				const ratio = bufferText.width / maxWidth;
				fontSize *= ratio;
				lineHeight *= ratio;
			}
		} else {
			if (totalLength >= 65) {
				fontSize = this.sunwell.options.bodyFontSize * 0.95;
				lineHeight = this.sunwell.options.bodyLineHeight * 0.95;
			}

			if (totalLength >= 80) {
				fontSize = this.sunwell.options.bodyFontSize * 0.9;
				lineHeight = this.sunwell.options.bodyLineHeight * 0.9;
			}

			if (totalLength >= 100) {
				fontSize = this.sunwell.options.bodyFontSize * 0.8;
				lineHeight = this.sunwell.options.bodyLineHeight * 0.8;
			}

			if (totalLength >= 120) {
				fontSize = this.sunwell.options.bodyFontSize * 0.62;
				lineHeight = this.sunwell.options.bodyLineHeight * 0.8;
			}
		}

		bufferRowCtx.font = this.getFontMaterial(fontSize, !!bold, !!italic);
		bufferRow.height = lineHeight;

		let smallerFirstLine = false;
		if (forceSmallerFirstLine || (totalLength >= 75 && this.cardDef.type === CardType.SPELL)) {
			smallerFirstLine = true;
		}

		for (const word of words) {
			const cleanWord = word.trim().replace(/<((?!>).)*>/g, "");

			const width = bufferRowCtx.measureText(cleanWord).width;
			this.sunwell.log("Next word:", word);

			if (
				!manualBreak &&
				(xPos + width > bufferRow.width ||
					(smallerFirstLine && xPos + width > bufferRow.width * 0.8)) &&
				!justLineBreak
			) {
				this.sunwell.log(xPos + width, ">", bufferRow.width);
				this.sunwell.log("Calculated line break");
				smallerFirstLine = false;
				justLineBreak = true;
				lineCount++;
				[xPos, yPos] = finishLine(
					bufferTextCtx,
					bufferRow,
					bufferRowCtx,
					xPos,
					yPos,
					bufferText.width
				);
			}

			if (word === "\n") {
				this.sunwell.log("Manual line break");
				lineCount++;
				[xPos, yPos] = finishLine(
					bufferTextCtx,
					bufferRow,
					bufferRowCtx,
					xPos,
					yPos,
					bufferText.width
				);

				justLineBreak = true;
				smallerFirstLine = false;
				continue;
			}

			justLineBreak = false;

			for (const char of word) {
				switch (char) {
					case CTRL_BOLD_START:
						bold += 1;
						continue;
					case CTRL_BOLD_END:
						bold -= 1;
						continue;
					case CTRL_ITALIC_START:
						italic += 1;
						continue;
					case CTRL_ITALIC_END:
						italic -= 1;
						continue;
				}

				// TODO investigate why the following two properites are being reset, for web
				// likely something to do with getLineWidth()
				bufferRowCtx.fillStyle = this.bodyTextColor;
				// move to here from pr.token block above,
				// text without markup ends up being default font otherwise
				bufferRowCtx.font = this.getFontMaterial(fontSize, !!bold, !!italic);

				bufferRowCtx.fillText(
					char,
					xPos + this.sunwell.options.bodyFontOffset.x,
					this.sunwell.options.bodyFontOffset.y
				);

				xPos += bufferRowCtx.measureText(char).width;
			}
			const em = bufferRowCtx.measureText("M").width;
			xPos += 0.275 * em;
		}

		lineCount++;
		finishLine(bufferTextCtx, bufferRow, bufferRowCtx, xPos, yPos, bufferText.width);

		this.sunwell.freeBuffer(bufferRow);

		if (this.cardDef.type === CardType.SPELL && lineCount === 4) {
			if (!smallerFirstLine && !forceSmallerFirstLine) {
				this.drawBodyText(context, s, true, this.bodyText);
				return;
			}
		}

		const b = contextBoundingBox(bufferTextCtx);

		b.h = Math.ceil(b.h / bufferRow.height) * bufferRow.height;

		context.drawImage(
			bufferText,
			b.x,
			b.y - 2,
			b.w,
			b.h,
			(centerLeft - b.w / 2) * s,
			(centerTop - b.h / 2) * s,
			b.w * s,
			(b.h + 2) * s
		);

		this.sunwell.freeBuffer(bufferText);
	}

	public drawName(context: CanvasRenderingContext2D, ratio: number, name: string): void {
		// define a box to contain the curved text
		const boxDims = {width: 460, height: 160};
		const boxBottomCenter = {x: 335, y: 612};
		// create a new buffer to draw onto
		const buffer = this.sunwell.getBuffer(boxDims.width * 2, boxDims.height, true);
		const textContext = buffer.getContext("2d");
		const maxWidth = this.nameTextCurve.maxWidth;
		const curve = this.nameTextCurve.curve;
		textContext.save();

		if (this.sunwell.options.debug) {
			textContext.lineWidth = 2;
			textContext.strokeStyle = "blue";
			textContext.fillStyle = "red";
			// draw the curve
			textContext.beginPath();
			textContext.moveTo(curve[0].x, curve[0].y);
			textContext.bezierCurveTo(
				curve[1].x,
				curve[1].y,
				curve[2].x,
				curve[2].y,
				curve[3].x,
				curve[3].y
			);
			textContext.stroke();
			// draw the control points
			for (const point of curve) {
				textContext.fillRect(point.x - 4, point.y - 4, 8, 8);
			}
			textContext.restore();
		}

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
		const begin = this.nameTextCurve.pathMiddle - textWidth / 2;
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

	public drawNameBanner(context: CanvasRenderingContext2D, ratio: number) {
		const coords = this.nameBannerCoords;
		coords.ratio = ratio;
		this.sunwell.drawImage(context, this.nameBannerAsset, coords);
	}

	public drawCardFoundationAsset(context: CanvasRenderingContext2D, ratio: number): void {
		const coords = this.cardFoundationCoords;
		coords.ratio = ratio;
		this.sunwell.drawImage(context, this.cardFoundationAsset, coords);
	}

	public getCardFrameAsset(): string {
		const cardClass = getCardFrameClass(this.cardDef.cardClass);
		return this.baseCardFrameAsset + CardClass[cardClass].toLowerCase();
	}

	public getMultiClassBannerAsset(): string {
		if (this.cardDef.multiClassGroup) {
			return "multi-" + MultiClassGroup[this.cardDef.multiClassGroup].toLowerCase();
		} else {
			return "";
		}
	}

	public getRarityGemAsset(): string {
		const rarity = getRarityGem(this.cardDef.rarity, this.cardDef.cardSet, this.cardDef.type);
		if (rarity) {
			return this.baseRarityGemAsset + Rarity[rarity].toLowerCase();
		}
		return "";
	}

	public getWatermarkAsset(): string {
		switch (this.cardDef.cardSet) {
			case CardSet.EXPERT1:
			case CardSet.NAXX:
			case CardSet.GVG:
			case CardSet.BRM:
			case CardSet.TGT:
			case CardSet.LOE:
			case CardSet.OG:
			case CardSet.KARA:
			case CardSet.GANGS:
			case CardSet.UNGORO:
			case CardSet.ICECROWN:
			case CardSet.HOF:
			case CardSet.LOOTAPALOOZA:
				return "set-" + CardSet[this.cardDef.cardSet].toLowerCase();
			default:
				return "";
		}
	}

	protected getFontMaterial(size: number, bold: boolean, italic: boolean): string {
		let font: string;
		const weight = bold ? "bold" : "";
		const style = italic ? "italic" : "";
		let fontSize = `${size}px`;

		if (this.sunwell.options.bodyLineStyle !== "") {
			fontSize = `${fontSize}/${this.sunwell.options.bodyLineStyle}`;
		}

		if (bold && italic) {
			font = this.sunwell.options.bodyFontBoldItalic;
		} else if (bold) {
			font = this.sunwell.options.bodyFontBold;
		} else if (italic) {
			font = this.sunwell.options.bodyFontItalic;
		} else {
			font = this.sunwell.options.bodyFontRegular;
		}

		return [weight, style, fontSize, `"${font}", sans-serif`].join(" ");
	}

	protected getLineWidth(
		context: CanvasRenderingContext2D,
		fontSize: number,
		line: string
	): number {
		let width = 0;
		let bold = 0;
		let italic = 0;

		for (const word of line.split(" ")) {
			for (const char of word) {
				switch (char) {
					case CTRL_BOLD_START:
						bold += 1;
						context.font = this.getFontMaterial(fontSize, !!bold, !!italic);
						continue;
					case CTRL_BOLD_END:
						bold -= 1;
						context.font = this.getFontMaterial(fontSize, !!bold, !!italic);
						continue;
					case CTRL_ITALIC_START:
						italic += 1;
						context.font = this.getFontMaterial(fontSize, !!bold, !!italic);
						continue;
					case CTRL_ITALIC_END:
						italic -= 1;
						context.font = this.getFontMaterial(fontSize, !!bold, !!italic);
						continue;
				}

				context.fillText(
					char,
					width + this.sunwell.options.bodyFontOffset.x,
					this.sunwell.options.bodyFontOffset.y
				);

				width += context.measureText(char).width;
			}
			width += 0.275 * context.measureText("M").width;
		}

		return width;
	}

	private checksum(): number {
		const s = this.propsJson + this.width + this.premium;
		const length = s.length;
		let chk = 0;
		for (let i = 0; i < length; i++) {
			const char = s.charCodeAt(i);
			chk = (chk << 5) - chk + char;
			chk |= 0;
		}

		return chk;
	}
}
