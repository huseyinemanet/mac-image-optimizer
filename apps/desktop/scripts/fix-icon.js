const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, '../../../assets/icon.png');
const outputPath = path.join(__dirname, '../resources/icon.png'); // Overwrite directly

async function fixIcon() {
	try {
		const image = sharp(inputPath);
		const metadata = await image.metadata();
		const width = metadata.width;
		const height = metadata.height;

		// Sample background color (cream)
		const region = { left: 0, top: 0, width: 1, height: 1 };
		const { data: sampleData } = await image.extract(region).raw().toBuffer({ resolveWithObject: true });
		const [targetR, targetG, targetB] = sampleData;

		console.log(`Sampling background color: rgb(${targetR}, ${targetG}, ${targetB})`);

		// Get raw pixels
		const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
		const pixels = new Uint8ClampedArray(data);
		const newPixels = new Uint8ClampedArray(info.width * info.height * 4);

		const threshold = 30;

		for (let i = 0; i < pixels.length / 3; i++) {
			const r = pixels[i * 3];
			const g = pixels[i * 3 + 1];
			const b = pixels[i * 3 + 2];

			const distance = Math.sqrt(
				Math.pow(r - targetR, 2) +
				Math.pow(g - targetG, 2) +
				Math.pow(b - targetB, 2)
			);

			newPixels[i * 4] = r;
			newPixels[i * 4 + 1] = g;
			newPixels[i * 4 + 2] = b;

			// Heuristic: If it's the background color AND it's outside a certain radius,
			// or just if it's the background color.
			// Let's try just the color distance first, it's safer than a pure circle.
			if (distance < threshold) {
				newPixels[i * 4 + 3] = 0;
			} else {
				newPixels[i * 4 + 3] = 255;
			}
		}

		// Apply a circular mask anyway to clean up edges
		const circleSvg = Buffer.from(
			`<svg width="${info.width}" height="${info.height}">
                <circle cx="${info.width / 2}" cy="${info.height / 2}" r="${info.width / 2}" fill="black"/>
            </svg>`
		);

		await sharp(newPixels, {
			raw: {
				width: info.width,
				height: info.height,
				channels: 4
			}
		})
			.composite([{
				input: circleSvg,
				blend: 'dest-in'
			}])
			.png()
			.toFile(outputPath);

		console.log('✅ Icon updated successfully in resources/icon.png');
	} catch (err) {
		console.error('❌ Error processing icon:', err);
	}
}

fixIcon();
