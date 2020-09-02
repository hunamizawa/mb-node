# mb-node
Print PNG image using MBrush, on node.js

# How to Build

Due to copyright reasons, this project contains patches for [dukelec/mb](https://github.com/dukelec/mb) repository.

## Cloning the repository

```
git clone https://github.com/hunamizawa/mb-node --recursive
```

Make sure the `--recursive` flag is set to clone all submodules.

## Building

Run build script in `mb-node` directory to create `mbc.js`, `mbc-head.js` and `mbc-m.js`.

```
./build.sh
```

# On Contribution

Before commiting, run `create-patch.sh` in `mb-node` directory.

```
./create-patch.sh
```

The following files will be ignored by `.gitignore`:

```
mbc.js
mbc-*.js
```

# Getting Started

## Requirements

- Node.js (>= v10)

## Simple Usage

1. Clone & build this repo
1. Run `npm ci --production` to install dependencies
1. Turn on your MBrush
1. Connect it to your PC
1. Run `node app.js foo.png` (If the MBrush has connected via USB, add `-c usb` option)
1. After exited, push the button on the top of MBrush
1. Slide it from left to right on the paper

# Server Mode

To avoid spending a lot of time on initializing WebAssembly, you can use this app as a HTTP server.

Run `node app.js -s 8080`, then access http://localhost:8080/ in your browser for more info.

# Usage

```
USAGE
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
```