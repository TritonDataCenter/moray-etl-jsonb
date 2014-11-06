#!/bin/bash

git clone https://github.com/joyent/moray-etl-jsonb.git
cd moray-etl-jsonb/
make
./runtests.sh
rm -rf jsonbQdemo/
cd ..
mkdir tarball
tar -cvzf tarball/moray-etl-jsonb.tgz moray-etl-jsonb/
mput -f tarball/moray-etl-jsonb.tgz /cwvhogue/stor/moray-etl-jsonb.tgz
