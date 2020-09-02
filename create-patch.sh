#!/bin/bash -u

diff -up mb/mb_ser/js/workers/mbc/mbc-head.js ./mbc-head.js > mbc-head.patch
diff -up mb/mb_ser/js/workers/mbc.js ./mbc.js > mbc.patch
