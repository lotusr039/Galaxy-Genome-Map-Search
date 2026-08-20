/**
 * Adobe AIR / Flash BitmapData.noise() compatible implementation
 *
 * Verified against the game's AIR 51.1.1.3 SDK and AIR 51.1.4.1.
 *
 * Pixel format:
 *   0xAARRGGBB
 *
 * Channel options:
 *   1  = RED
 *   2  = GREEN
 *   4  = BLUE
 *   8  = ALPHA
 *
 * Example:
 *   const bitmap = airNoise(4, 1, 1, 0, 255, 15, false);
 *   console.log(bitmap.getPixel32(0, 0).toString(16));
 */

class AirNoiseRNG {
    static MOD = 2147483647;
    static MUL = 16807;

    constructor(seed) {
        // Based on the tested AIR behavior.
        this.state = seed <= 0 ? 1 : seed;
    }

    nextInt(low, high) {
        // IMPORTANT:
        // JavaScript Number is exact for this multiplication because:
        //
        // 2147483646 * 16807 ≈ 3.61e13
        //
        // which is far below Number.MAX_SAFE_INTEGER ≈ 9e15.
        this.state =
            (this.state * AirNoiseRNG.MUL) %
            AirNoiseRNG.MOD;

        const range = high - low + 1;

        return low + (this.state % range);
    }
}


/**
 * Approximate fallback for environments where the native conversion table
 * has not been loaded. AIR's exact 8-bit conversion is table-based.
 *
 * For positive values:
 *     floor(x + 0.5)
 */
function airRound(value) {
    return Math.floor(value + 0.5);
}

let pixelConversion = null;

function setPixelConversionTable(buffer) {
    const table = buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array(buffer);

    if (table.length !== 65536) {
        throw new Error(
            "AIR pixel conversion table must contain 65536 bytes"
        );
    }

    pixelConversion = table;
}


/**
 * Approximate BitmapData's 8-bit premultiplied-alpha storage.
 *
 * channel:
 *     original unpremultiplied channel [0..255]
 *
 * alpha:
 *     alpha [0..255]
 */
function premultiply(channel, alpha) {
    if (alpha === 0) {
        return 0;
    }

    return airRound(channel * alpha / 255);
}


/**
 * Approximate getPixel32() converting an internally
 * premultiplied 8-bit channel back to normal ARGB.
 */
function unpremultiply(channel, alpha) {
    if (alpha === 0) {
        return 0;
    }

    const value =
        airRound(channel * 255 / alpha);

    return Math.min(255, Math.max(0, value));
}


/**
 * Convert ARGB components to uint32.
 */
function packARGB(a, r, g, b) {
    return (
        ((a & 0xff) << 24) |
        ((r & 0xff) << 16) |
        ((g & 0xff) << 8) |
        (b & 0xff)
    ) >>> 0;
}


/**
 * Convert uint32 ARGB to hex.
 */
function hex8(value) {
    return value
        .toString(16)
        .toUpperCase()
        .padStart(8, "0");
}


/**
 * Simulated BitmapData.
 *
 * Internally stores premultiplied RGBA bytes.
 */
class AirBitmapData {
    constructor(width, height, transparent = true) {
        if (!Number.isInteger(width) || width <= 0) {
            throw new Error("Invalid width");
        }

        if (!Number.isInteger(height) || height <= 0) {
            throw new Error("Invalid height");
        }

        this.width = width;
        this.height = height;
        this.transparent = !!transparent;

        // Internal layout:
        //
        // R, G, B, A
        //
        // Values are premultiplied when transparent=true.
        this.data = new Uint8Array(width * height * 4);
        // BitmapData.noise() starts from unpremultiplied channel values.
        // Keep these so the native AIR conversion table can be applied
        // exactly when getPixel32() is called.
        this.original = new Uint8Array(width * height * 4);
    }

    _offset(x, y) {
        return (y * this.width + x) * 4;
    }

    /**
     * Write a pixel using unpremultiplied ARGB,
     * then simulate BitmapData internal storage.
     */
    _setPixelARGB(x, y, a, r, g, b) {
        const offset = this._offset(x, y);

        if (!this.transparent) {
            // Non-transparent BitmapData always has alpha FF.
            a = 255;
        }

        this.original[offset + 0] = r;
        this.original[offset + 1] = g;
        this.original[offset + 2] = b;
        this.original[offset + 3] = a;

        if (this.transparent) {
            this.data[offset + 0] = premultiply(r, a);
            this.data[offset + 1] = premultiply(g, a);
            this.data[offset + 2] = premultiply(b, a);
        } else {
            this.data[offset + 0] = r;
            this.data[offset + 1] = g;
            this.data[offset + 2] = b;
        }

        this.data[offset + 3] = a;
    }

    /**
     * Simulate BitmapData.getPixel32().
     *
     * Returns 0xAARRGGBB.
     */
    getPixel32(x, y) {
        if (
            x < 0 ||
            y < 0 ||
            x >= this.width ||
            y >= this.height
        ) {
            throw new Error("Pixel coordinates out of range");
        }

        const offset = this._offset(x, y);

        const a = this.data[offset + 3];

        let r;
        let g;
        let b;

        if (this.transparent) {
            if (pixelConversion) {
                r = pixelConversion[(a << 8) | this.original[offset + 0]];
                g = pixelConversion[(a << 8) | this.original[offset + 1]];
                b = pixelConversion[(a << 8) | this.original[offset + 2]];
            } else {
                r = unpremultiply(this.data[offset + 0], a);
                g = unpremultiply(this.data[offset + 1], a);
                b = unpremultiply(this.data[offset + 2], a);
            }
        } else {
            r = this.data[offset + 0];
            g = this.data[offset + 1];
            b = this.data[offset + 2];
        }

        return packARGB(a, r, g, b);
    }

    /**
     * Get the internally stored premultiplied RGBA bytes.
     */
    getInternalRGBA() {
        return this.data;
    }

    /**
     * Export getPixel32() results as an array.
     */
    getPixel32Array() {
        const result = new Uint32Array(
            this.width * this.height
        );

        let index = 0;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                result[index++] =
                    this.getPixel32(x, y);
            }
        }

        return result;
    }
}


/**
 * Reimplementation of BitmapData.noise().
 *
 * Parameters:
 *
 *   width
 *   height
 *   seed
 *   low
 *   high
 *   channelOptions
 *   grayScale
 *   transparent
 *
 * Example:
 *
 *   airNoise(
 *       1000,
 *       200,
 *       1,
 *       0,
 *       255,
 *       15,
 *       false,
 *       true
 *   );
 */
function airNoise(
    width,
    height,
    seed,
    low = 0,
    high = 255,
    channelOptions = 7,
    grayScale = false,
    transparent = true
) {
    if (low < 0 || low > 255) {
        throw new Error("low must be in [0,255]");
    }

    if (high < 0 || high > 255) {
        throw new Error("high must be in [0,255]");
    }

    if (low > high) {
        throw new Error("low must be <= high");
    }

    if (
        channelOptions < 0 ||
        channelOptions > 15
    ) {
        throw new Error(
            "channelOptions must be in [0,15]"
        );
    }

    const bitmap =
        new AirBitmapData(
            width,
            height,
            transparent
        );

    const rng = new AirNoiseRNG(seed);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {

            let r = 0;
            let g = 0;
            let b = 0;
            let a = 255;

            /*
             * Channel consumption order:
             *
             * R -> G -> B -> A
             *
             * A selected channel consumes exactly
             * one PRNG value.
             */

            if (channelOptions & 1) {
                r = rng.nextInt(low, high);
            }

            if (channelOptions & 2) {
                g = rng.nextInt(low, high);
            }

            if (channelOptions & 4) {
                b = rng.nextInt(low, high);
            }

            if (transparent && (channelOptions & 8)) {
                a = rng.nextInt(low, high);
            }

            /*
             * grayScale handling.
             *
             * The fully verified reverse-engineered path
             * is grayScale=false.
             *
             * For grayScale=true, Flash uses one generated
             * value for RGB rather than independent RGB
             * channels. Keep this isolated so the normal
             * noise implementation remains clear.
             */
            if (grayScale) {
                /*
                 * The exact grayScale behavior has not been
                 * included in the current AIR Golden Tests.
                 *
                 * Do not silently claim this branch is
                 * completely verified.
                 */
                throw new Error(
                    "grayScale=true is not covered by the current verified implementation"
                );
            }

            /*
             * BitmapData with transparent=false:
             *
             * Alpha is always FF.
             */
            if (!transparent) {
                a = 255;
            }

            bitmap._setPixelARGB(
                x,
                y,
                a,
                r,
                g,
                b
            );
        }
    }

    return bitmap;
}


/* ============================================================
 * Golden Tests
 * ============================================================
 */

function assertEqual(actual, expected, message = "") {
    if (actual !== expected) {
        throw new Error(
            `${message}\n` +
            `Expected: ${expected}\n` +
            `Actual:   ${actual}`
        );
    }
}


function testNoise(
    name,
    {
        seed,
        low,
        high,
        channelOptions,
        transparent,
        expected
    }
) {
    const bitmap = airNoise(
        expected.length,
        1,
        seed,
        low,
        high,
        channelOptions,
        false,
        transparent
    );

    const actual = [];

    for (let x = 0; x < expected.length; x++) {
        actual.push(
            hex8(bitmap.getPixel32(x, 0))
        );
    }

    console.log(name);

    if (expected.length <= 16) {
        console.log("expected:", expected.join(" "));
        console.log("actual:  ", actual.join(" "));
    } else {
        console.log(`comparing ${expected.length} pixels`);
    }

    for (let i = 0; i < expected.length; i++) {
        assertEqual(
            actual[i],
            expected[i],
            `${name}, pixel ${i}`
        );
    }

    console.log("PASS\n");
}


/* ============================================================
 * Tests from Adobe AIR 51.1.1.3 and 51.1.4.1
 * ============================================================
 */

function runGoldenTests() {

    // channelOptions = 1
    testNoise(
        "channelOptions=1",
        {
            seed: 1,
            low: 0,
            high: 255,
            channelOptions: 1,
            transparent: true,

            expected: [
                "FFA70000",
                "FFF10000",
                "FFD90000",
                "FF2A0000"
            ]
        }
    );


    // channelOptions = 2
    testNoise(
        "channelOptions=2",
        {
            seed: 1,
            low: 0,
            high: 255,
            channelOptions: 2,
            transparent: true,

            expected: [
                "FF00A700",
                "FF00F100",
                "FF00D900",
                "FF002A00"
            ]
        }
    );


    // channelOptions = 4
    testNoise(
        "channelOptions=4",
        {
            seed: 1,
            low: 0,
            high: 255,
            channelOptions: 4,
            transparent: true,

            expected: [
                "FF0000A7",
                "FF0000F1",
                "FF0000D9",
                "FF00002A"
            ]
        }
    );


    // channelOptions = 8
    testNoise(
        "channelOptions=8",
        {
            seed: 1,
            low: 0,
            high: 255,
            channelOptions: 8,
            transparent: true,

            expected: [
                "A7000000",
                "F1000000",
                "D9000000",
                "2A000000"
            ]
        }
    );


    // channelOptions = 3
    testNoise(
        "channelOptions=3",
        {
            seed: 1,
            low: 0,
            high: 255,
            channelOptions: 3,
            transparent: true,

            expected: [
                "FFA7F100",
                "FFD92A00",
                "FF82C800",
                "FFD8FE00"
            ]
        }
    );


    // channelOptions = 5
    testNoise(
        "channelOptions=5",
        {
            seed: 1,
            low: 0,
            high: 255,
            channelOptions: 5,
            transparent: true,

            expected: [
                "FFA700F1",
                "FFD9002A",
                "FF8200C8",
                "FFD800FE"
            ]
        }
    );


    // channelOptions = 7
    testNoise(
        "channelOptions=7",
        {
            seed: 1,
            low: 0,
            high: 255,
            channelOptions: 7,
            transparent: true,

            expected: [
                "FFA7F1D9",
                "FF2A82C8",
                "FFD8FE43",
                "FF4D9855"
            ]
        }
    );


    // channelOptions = 15
    testNoise(
        "channelOptions=15, low=0, high=255",
        {
            seed: 1,
            low: 0,
            high: 255,
            channelOptions: 15,
            transparent: true,

            expected: [
                "2AAAF3DB",
                "FE82C8D8",
                "55424E99",
                "478CE2B3"
            ]
        }
    );


    // low=100, high=200
    testNoise(
        "channelOptions=15, low=100, high=200",
        {
            seed: 1,
            low: 100,
            high: 200,
            channelOptions: 15,
            transparent: true,

            expected: [
                "8D8DA482",
                "6F7773AC",
                "7BB2AA89",
                "6882A2AE"
            ]
        }
    );


    // low=1, high=2
    testNoise(
        "channelOptions=15, low=1, high=2",
        {
            seed: 1,
            low: 1,
            high: 2,
            channelOptions: 15,
            transparent: true,

            expected: [
                "01000000",
                "01000000",
                "02000000",
                "02000000"
            ]
        }
    );


    // transparent=false
    testNoise(
        "transparent=false, channelOptions=15",
        {
            seed: 1,
            low: 0,
            high: 255,
            channelOptions: 15,
            transparent: false,

            expected: [
                "FFA7F1D9",
                "FF2A82C8",
                "FFD8FE43",
                "FF4D9855"
            ]
        }
    );


    console.log(
        "All Golden Tests PASSED."
    );
}


function runNativeAirGoldenTests(text) {
    const groups = new Map();
    for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^(\d+),(\d+),([0-9A-F]{8})$/);
        if (!match) continue;
        const seed = Number(match[1]);
        if (!groups.has(seed)) groups.set(seed, []);
        groups.get(seed)[Number(match[2])] = match[3];
    }

    for (const [seed, expected] of groups) {
        testNoise(`AIR native seed=${seed}`, {
            seed,
            low: 0,
            high: 255,
            channelOptions: 15,
            transparent: true,
            expected
        });
    }
}

if (typeof module !== "undefined") {
    module.exports = {
        AirNoiseRNG,
        AirBitmapData,
        airNoise,
        setPixelConversionTable,
        runGoldenTests,
        runNativeAirGoldenTests
    };

    if (require.main === module) {
        const fs = require("fs");
        const path = require("path");
        setPixelConversionTable(
            fs.readFileSync(path.join(__dirname, "data", "PixelConversion.bin"))
        );
        runGoldenTests();
        runNativeAirGoldenTests(
            fs.readFileSync(
                path.join(__dirname, "..", "air-noise-test", "NoiseGolden.txt"),
                "utf8"
            )
        );
        console.log("All native AIR comparison tests PASSED.");
    }
}


/* ============================================================
 * Example
 * ============================================================
 *
 * const bitmap = airNoise(
 *     1000,
 *     200,
 *     1,
 *     0,
 *     255,
 *     15,
 *     false,
 *     true
 * );
 *
 * console.log(
 *     hex8(bitmap.getPixel32(0, 0))
 * );
 *
 * ============================================================
 */
