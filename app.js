"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const path = require("path");
const bodyParser = require("body-parser");
const node_fetch_1 = require("node-fetch");
const FormData = require("form-data");
const arg = require("arg");
const express = require("express");
const multer = require("multer");
const Module = require("./mbc-m");
const mbc_1 = require("./mbc");
require('source-map-support').install();
let moduleLoaded = false;
Module.onRuntimeInitialized = () => {
    // To pause convertion while WASM initialized
    moduleLoaded = true;
};
function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
class ArgsParsingError extends Error {
}
/**
 * Ensures the value of the numeric option is between min and max
 * @param a The result of arg()
 * @param name Option name
 * @param min Minimum value for vaild option
 * @param max Maximum value for valid option
 * @param _default The default value if the option has omitted
 */
function ensureBetween(a, name, min, max, _default = null) {
    const v = +a[name];
    if (a[name] !== undefined && isNaN(v))
        throw new ArgsParsingError(`Parameter ${name} must be number`);
    if (!v && v !== 0) {
        // If arg is not found, uses default value
        if (_default === null)
            throw new ArgsParsingError(`Missing parameter ${name}`);
        return _default;
    }
    if (v < min)
        throw new ArgsParsingError(`Parameter ${name} is too small`);
    if (v > max)
        throw new ArgsParsingError(`Parameter ${name} is too big`);
    return Math.round(v);
}
/**
 * Ensures the value of the option is any of possibleValues
 * @param a The result of arg()
 * @param name Option name
 * @param possibleValues Possible values for the option
 * @param _default The default value if the option has omitted
 * @param preCheck Convertion function applied before validation
 */
function ensureAny(a, name, possibleValues, _default = null, preCheck) {
    if (!possibleValues.includes(_default))
        throw new Error('possibleValues must contains _default');
    let v = a[name];
    if (!v && v !== 0) {
        // If arg is not found, uses default value
        if (_default === null)
            throw new ArgsParsingError(`Missing parameter ${name}`);
        return _default;
    }
    if (preCheck)
        v = preCheck(v);
    if (!v && v !== 0) {
        // If arg is not found, uses default value
        if (_default === null)
            throw new ArgsParsingError(`Missing parameter ${name}`);
        return _default;
    }
    if (!possibleValues.includes(v)) {
        const p = possibleValues.slice();
        const last = p.pop();
        const others = p.join(', ');
        throw new ArgsParsingError(`ERROR: Parameter ${name} must be ${others} or ${last}`);
    }
    return v;
}
function raiseUnknownValue(obj, key) {
    throw new ArgsParsingError(`Unknown value '${obj[key]}' for '${key}'`);
}
function convertArgsToOptions(options) {
    return {
        brightness: options.brightness,
        saturation: options.saturation,
        density: options.density - 1,
        cal: options.cal,
        invert: options.rtl ? 1 : 0,
        c_order: options.c_order === 'cmy' ? 0 : options.c_order === 'cym' ? 1 : raiseUnknownValue(options, 'c_order'),
        c_width: options.c_width === 4.4 ? 0 : options.c_width === 4.9 ? 1 : raiseUnknownValue(options, 'c_width'),
        dpi_step: options.dpi === 1200 ? 1 : options.dpi === 600 ? 2 : options.dpi === 300 ? 4 : raiseUnknownValue(options, 'dpi'),
    };
}
function convertOptionsToArgs(options) {
    return {
        brightness: options.brightness,
        saturation: options.saturation,
        density: options.density + 1,
        cal: options.cal,
        rtl: options.invert === 1,
        c_order: options.c_order === 0 ? 'cmy' : 'cym',
        c_width: options.c_width === 0 ? 4.4 : 4.9,
        dpi: options.dpi_step === 1 ? 300 : options.dpi_step === 2 ? 600 : 1200,
    };
}
/**
 * Converts PNG to MBD (MBrush internal format)
 * @param input A PNG file for convert
 * @param options
 */
async function convert(input, options) {
    // Wait for complete WASM initializing
    while (!moduleLoaded)
        await delay(100);
    // Gets color correction parameters
    const mt = mbc_1.get_mt({ c: 0xff, m: 0xff, y: 0xff });
    // Writes original image and color correction parameters to MEMFS
    Module.FS.writeFile('m.bmp', mt);
    Module.FS.writeFile('ori.png', Uint8Array.from(input));
    // Do convertion
    const args = [
        String(options.brightness),
        String(options.saturation),
        String(options.density),
        '-i' + options.invert,
        '-o' + options.c_order,
        '-w' + options.c_width,
        '-s' + options.dpi_step
    ];
    Module.verbose(args);
    Module.callMain(args);
    // Reads mbd data out from MEMFS
    const mbd = Module.FS.readFile('mb.dat');
    return Buffer.from(mbd);
}
function parseArgs() {
    const help = `USAGE
node app.js [OPTIONS] [input.png [input2.png ...]]

OPERATING OPTIONS
    -s, --server [ADDR:]PORT         Serve as a server
                                     default ADDR is localhost
                                     Access http://ADDR:PORT/ in your browser
                                     to see HTTP API usage

NETWORK OPTIONS
    -c, --connect ["wifi", "usb"]    Connection method, default "wifi"

PRINTING OPTIONS
    --brightness VALUE               0 (dark) to 200 (light), default 128
    --saturation VALUE               0 (gray) to 500 (vivid), default 168
    --density VALUE                  1 (dark) to 100 (light), default 50
    --cal-c, --cal-m, --cal-y VALUE  Color calibration, 1 to 255, default 255
    --rtl                            Sets printing direction Right-To-Left
    --c-order ["cmy", "cym"]         Printer head order, default "cmy"
    --c-width [4.4, 4.9]             Printer head width in mm, default 4.4
    --dpi     [1200, 600, 300]       Horizontal resolution, default 600

GENERAL OPTIONS
    -h, --help                       Shows this
    -v, --verbose                    More verbose

SAMPLE
    node app.js test.png
        Sends image 'test.png' to MBrush via Wi-Fi.

    node app.js -c usb --density 1 test.png
        Sends image 'test.png' to MBrush via USB, with maximum density.

    node app.js -s 8080
        Serves as a HTTP server at port 8080.
`;
    const args = (() => {
        try {
            return arg({
                '--server': String,
                '-s': '--server',
                '--connect': String,
                '-c': '--connect',
                '--brightness': Number,
                '--saturation': Number,
                '--density': Number,
                '--cal-c': Number,
                '--cal-m': Number,
                '--cal-y': Number,
                '--rtl': Boolean,
                '--c-order': String,
                '--c-width': Number,
                '--dpi': Number,
                '--help': Boolean,
                '-h': '--help',
                '--verbose': Boolean,
                '-v': '--verbose',
            });
        }
        catch (error) {
            process.stdout.write('ERROR: ');
            process.stdout.write(error.message);
            process.exit(2);
        }
    })();
    const files = args._;
    if (args['--help'] || (!args['--server'] && (!files || files.length === 0))) {
        process.stdout.write(help);
        process.exit(2);
    }
    const verbose = ((v) => {
        if (v)
            return console.log;
        return () => { };
    })(args['--verbose']);
    try {
        const server = ((c) => {
            if (!c || c === '')
                return null;
            const x = c.split(/\:[0-9]+?$/);
            const port = x.length === 1 ? x[0] : x[1];
            if (isNaN(+port))
                throw new ArgsParsingError('Invalid port number: ' + c);
            return { addr: x.length > 1 ? x[0] : 'localhost', port: +port };
        })(args['--server']);
        const ipaddr = ((c) => {
            if (!c || c.toLowerCase() == 'wifi')
                return '192.168.44.1';
            if (c.toLowerCase() == 'usb')
                return '192.168.88.1';
            throw new ArgsParsingError('Unknown connection method: ' + c);
        })(args['--connect']);
        const brightness = ensureBetween(args, '--brightness', 0, 200, 128);
        const saturation = ensureBetween(args, '--saturation', 0, 500, 168);
        const density = ensureBetween(args, '--density', 1, 100, 60);
        const cal_c = ensureBetween(args, '--cal-c', 1, 255, 255);
        const cal_m = ensureBetween(args, '--cal-m', 1, 255, 255);
        const cal_y = ensureBetween(args, '--cal-y', 1, 255, 255);
        const rtl = args['--rtl'] ? true : false; // avoid undefined
        const c_order = ensureAny(args, '--c-order', ['cmy', 'cym'], 'cmy', v => v.toLowerCase());
        const c_width = ensureAny(args, '--c-width', [4.4, 4.9], 4.4);
        const dpi = ensureAny(args, '--c-width', [1200, 600, 300], 600);
        for (const file of files) {
            if (!fs.existsSync(file)) {
                console.error(`ERROR: No such file: '${file}'`);
                process.exit(2);
            }
        }
        return { ipaddr, verbose, brightness, saturation, density, cal: { c: cal_c, m: cal_m, y: cal_y }, rtl, c_order, c_width, dpi, server, files };
    }
    catch (err) {
        if (err instanceof ArgsParsingError) {
            console.error('ERROR: ' + err.message);
            process.exit(2);
        }
        else {
            throw err;
        }
    }
}
function copyToEnd(src, dest) {
    return new Promise((resolve, reject) => {
        src.pipe(dest)
            .on('close', () => resolve())
            .on('error', (e) => reject(e));
    });
}
async function main() {
    const options = parseArgs();
    Module.verbose = options.verbose;
    options.verbose(options);
    if (options.server) {
        const app = expressInit(options);
        // Wait for complete WASM initializing
        while (!moduleLoaded)
            await delay(100);
        app.listen(options.server.port, options.server.addr);
        options.verbose(`Start listening ${options.server.addr}:${options.server.port}`);
        return;
    }
    await doJob(options);
}
/**
 * Create new express instance
 * @param options
 */
function expressInit(options) {
    const app = express();
    const storage = multer.diskStorage({
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix);
        },
    });
    const upload = multer({
        storage,
        fileFilter: (req, file, cb) => {
            if (file.mimetype !== 'image/png')
                cb(new Error('File rejected: MIME type is not image/png'));
            else
                cb(null, true);
        }
    });
    app.use(express.static(path.join(__dirname, 'html')));
    const maxImagesCount = 10;
    const postFields = [];
    for (let i = 0; i < maxImagesCount; i++) {
        postFields.push({ name: 'img' + i, maxCount: 1 });
    }
    app.post('/print', upload.fields(postFields), async (req, res, next) => {
        options.verbose('HTTP request received');
        if (req.files instanceof Array) {
            options.files = req.files.map(p => p.path);
        }
        else {
            options.files = [];
            for (let i = 0; i < maxImagesCount; i++) {
                const file = req.files['img' + i];
                if (file)
                    options.files.push(...file.map(p => p.path));
            }
        }
        if (!options.files || options.files.length === 0) {
            res.status(400).send('Your request contains no image.');
            return;
        }
        try {
            await doJob(options);
            res.send('OK');
        }
        catch (error) {
            if (error instanceof node_fetch_1.FetchError) {
                res.status(502).send(error.message);
                return;
            }
            next(error);
        }
        finally {
            try {
                for (const file of options.files) {
                    if (await fs.pathExists(file))
                        await fs.unlink(file);
                }
            }
            catch (error) { }
        }
    });
    function resSetting(res) {
        res.json(options);
    }
    app.get('/setting', (req, res, next) => {
        try {
            resSetting(res);
        }
        catch (error) {
            next(error);
        }
    });
    app.post('/setting', bodyParser.json(), (req, res, next) => {
        try {
            if (req.body.brightness)
                options.brightness = ensureBetween(req.body, 'brightness', 0, 200);
            if (req.body.saturation)
                options.saturation = ensureBetween(req.body, 'saturation', 0, 500);
            if (req.body.density)
                options.density = ensureBetween(req.body, 'density', 1, 100);
            if (req.body.cal) {
                if (req.body.cal.c)
                    options.cal.c = ensureBetween(req.body.cal, 'c', 0, 255);
                if (req.body.cal.m)
                    options.cal.m = ensureBetween(req.body.cal, 'm', 0, 255);
                if (req.body.cal.y)
                    options.cal.y = ensureBetween(req.body.cal, 'y', 0, 255);
            }
            if (req.body.rtl)
                options.rtl = ensureAny(req.body, 'rtl', [true, false]);
            if (req.body.c_order)
                options.c_order = ensureAny(req.body, 'c_order', ['cmy', 'cym']);
            if (req.body.c_width)
                options.c_width = ensureAny(req.body, 'c_width', [4.4, 4.9]);
            if (req.body.dpi)
                options.dpi = ensureAny(req.body, 'dpi', [300, 600, 1200]);
            resSetting(res);
        }
        catch (error) {
            next(error);
        }
    });
    return app;
}
/**
 * Main job for convertion
 * @param options
 */
async function doJob(options) {
    const conv_param = convertArgsToOptions(options);
    const mbds = [];
    // Converts images
    for (const file of options.files) {
        mbds.push(await convert(await fs.readFile(file), conv_param));
    }
    // Wipes old datas on MBrush
    let res = await node_fetch_1.default(`http://${options.ipaddr}/cgi-bin/cmd?cmd=rm_upload`, {
        method: "GET",
        timeout: 3000,
    });
    let ret = await res.json();
    options.verbose(ret);
    if (!ret || ret.status !== 'ok')
        throw new Error('Failed to prepare upload; Printer respond not ok');
    // Sends new data
    for (let i = 0; i < mbds.length; i++) {
        const form = new FormData();
        form.append('file', mbds[i], { filename: i + '.mbd', contentType: 'application/octet-stream' });
        res = await node_fetch_1.default(`http://${options.ipaddr}/cgi-bin/upload`, {
            method: "POST",
            body: form,
            timeout: 3000,
        });
        ret = await res.json();
        options.verbose(ret);
        if (!ret || ret.status !== 'ok')
            throw new Error('Failed to upload; Printer respond not ok');
    }
}
main().then(() => { }, (err) => {
    console.error(err ? (err.stack || err) : err);
    process.exit(1);
});
//# sourceMappingURL=app.js.map