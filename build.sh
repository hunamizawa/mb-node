#!/bin/bash -eu

cp mb/mb_ser/js/workers/mbc/mbc-head.js .
cp mb/mb_ser/js/workers/mbc/mbc-head-node.js .
cp mb/mb_ser/js/workers/mbc.js .
patch -u mbc-head.js < mbc-head.patch
patch -u mbc.js < mbc.patch
cat mbc-head.js mb/mb_ser/js/workers/mbc/mbc.js > mbc-m.js
#cat mbc-head-node.js mbc.js > mbc-node.js
#chmod +x mbc-node.js
echo 'Module["FS"] = FS;' >> mbc-m.js
echo 'process.off("unhandledRejection", Module["abort"]);' >> mbc-m.js