import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import type { ResponsiveDerivative, ResponsiveSettings, SupportedImageType } from '../../shared/types';
import type { TaskSettings } from '../core/types';
import { Logger } from '../logger';

const log = new Logger('Responsive');

export interface DerivativePlan {
	width: number | null;
	dpr: number | null;
	format: SupportedImageType;
	label: string;
}

export async function buildDerivativePlan(
	imagePath: string,
	config: ResponsiveSettings,
	originalWidth: number
): Promise<DerivativePlan[]> {
	const plans: DerivativePlan[] = [];
	const formats: SupportedImageType[] = [];

	if (config.formatPolicy === 'webp-only') {
		formats.push('webp');
	} else if (config.formatPolicy === 'webp-fallback') {
		formats.push('webp');
		const ext = path.extname(imagePath).toLowerCase();
		if (ext === '.png') formats.push('png');
		else formats.push('jpeg');
	} else {
		const ext = path.extname(imagePath).toLowerCase();
		if (ext === '.webp') formats.push('webp');
		else if (ext === '.png') formats.push('png');
		else formats.push('jpeg');
	}

	if (config.mode === 'width') {
		const widths = [...config.widths];
		if (config.includeOriginal) {
			if (!widths.includes(originalWidth)) {
				widths.push(originalWidth);
			}
		}
		widths.sort((a, b) => a - b);

		for (const width of widths) {
			if (!config.allowUpscale && width > originalWidth) {
				continue;
			}
			for (const format of formats) {
				plans.push({
					width,
					dpr: null,
					format,
					label: `${width}w`
				});
			}
		}
	} else {
		// DPR mode
		const factors = [1, 2, 3];
		for (const dpr of factors) {
			const targetWidth = Math.round(config.dprBaseWidth * dpr);
			if (!config.allowUpscale && targetWidth > originalWidth) {
				continue;
			}
			for (const format of formats) {
				plans.push({
					width: targetWidth,
					dpr,
					format,
					label: `${dpr}x`
				});
			}
		}
	}

	return plans;
}

export async function renderDerivative(
	inputPath: string,
	plan: DerivativePlan,
	settings: TaskSettings,
	outputFolder: string
): Promise<ResponsiveDerivative> {
	const baseName = path.basename(inputPath, path.extname(inputPath));
	const slugSafeName = baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase();

	const suffix = plan.dpr ? `@${plan.dpr}x` : `-${plan.width}w`;
	const ext = plan.format === 'jpeg' ? '.jpg' : `.${plan.format}`;
	const fileName = `${slugSafeName}${suffix}${ext}`;
	const targetPath = path.join(outputFolder, fileName);

	await fs.mkdir(path.dirname(targetPath), { recursive: true });

	const pipeline = sharp(inputPath);

	if (plan.width) {
		pipeline.resize(plan.width, null, {
			withoutEnlargement: !settings.responsiveSettings.allowUpscale,
			kernel: sharp.kernel.lanczos3
		});
	}

	const buffer = await (plan.format === 'webp'
		? pipeline.webp({ quality: settings.webpQuality, effort: settings.webpEffort }).toBuffer()
		: plan.format === 'jpeg'
			? pipeline.jpeg({ quality: settings.jpegQuality, mozjpeg: true }).toBuffer()
			: pipeline.png({ compressionLevel: 9 }).toBuffer());

	await fs.writeFile(targetPath, buffer);

	return {
		width: plan.width,
		dpr: plan.dpr,
		format: plan.format,
		outputPath: targetPath,
		size: buffer.length
	};
}

export function generateHtmlSnippet(
	inputPath: string,
	derivatives: ResponsiveDerivative[],
	config: ResponsiveSettings,
	originalWidth: number,
	originalHeight: number
): { img: string; picture: string } {
	const defaultDerivative = derivatives.find(d => d.width && d.width >= 640) || derivatives[Math.floor(derivatives.length / 2)];
	const defaultSrc = defaultDerivative ? path.basename(defaultDerivative.outputPath) : '';

	const aspectRatio = originalWidth / originalHeight;
	const targetWidth = defaultDerivative?.width || originalWidth;
	const targetHeight = Math.round(targetWidth / aspectRatio);

	const getSrcset = (format?: SupportedImageType) => {
		return derivatives
			.filter(d => !format || d.format === format)
			.map(d => `${path.basename(d.outputPath)} ${config.mode === 'width' ? `${d.width}w` : `${d.dpr}x`}`)
			.join(', ');
	};

	const sizesAttr = config.mode === 'width' ? `\n  sizes="${config.customSizes}"` : '';

	const imgSnippet = `<img
  src="${defaultSrc}"
  srcset="${getSrcset()}"${sizesAttr}
  width="${targetWidth}"
  height="${targetHeight}"
  alt=""
  loading="lazy"
  decoding="async"
/>`;

	let pictureSnippet = '';
	if (config.formatPolicy === 'webp-fallback') {
		const webpSrcset = getSrcset('webp');
		const fallbackFormat = derivatives.find(d => d.format !== 'webp')?.format;
		const fallbackSrcset = getSrcset(fallbackFormat);
		const fallbackSrc = derivatives.find(d => d.format !== 'webp' && d.width === defaultDerivative?.width)?.outputPath || defaultSrc;

		pictureSnippet = `<picture>
  <source type="image/webp" srcset="${webpSrcset}"${sizesAttr}>
  <img
    src="${path.basename(fallbackSrc)}"
    srcset="${fallbackSrcset}"${sizesAttr}
    width="${targetWidth}"
    height="${targetHeight}"
    alt=""
    loading="lazy"
    decoding="async"
  />
</picture>`;
	} else {
		pictureSnippet = imgSnippet;
	}

	return { img: imgSnippet, picture: pictureSnippet };
}

export function generateManifest(
	inputPath: string,
	derivatives: ResponsiveDerivative[],
	originalWidth: number,
	originalHeight: number
): any {
	return {
		source: inputPath,
		originalSize: { width: originalWidth, height: originalHeight },
		derivatives: derivatives.map(d => ({
			width: d.width,
			height: d.width ? Math.round(d.width / (originalWidth / originalHeight)) : null,
			format: d.format,
			path: d.outputPath,
			size: d.size
		}))
	};
}
