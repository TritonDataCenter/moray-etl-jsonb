#!/bin/bash
# this is jsonsplitinfo.sh

SPLITSUFFIX=4
SPLITWC="????"
# split required for inputs to Trent's json tool which runs out of memory on big JSON
# split -a 4 -l 30000 gives unique names for up to  13 709 280 000 lines of json
# Assuming 512 bytes per line that is about 7 TB 
# Changing to  5 will handle about 180 TB at this size, or 360 Tb at 1024 bytes per line

SPLITSIZE=30000
# Assuming 512 bytes per JSON line - roughly 15KB files in size
# Assuming 1024 bytes per JSONN line - roughly 30KB files in size

if [ $# != 1 ]
then
        echo "Uses split to pass JSON information to jsoninfo script"
        echo "usage `basename $0` [jsonfile]"
        echo "   "
        exit 1
fi

split -a ${SPLITSUFFIX} -l ${SPLITSIZE} ${1} ${1}_.     

ls ${1}_.${SPLITWC} > ${1}.splits

### Loop through each split and accumulate jsoninfo

cat ${1}.splits | xargs -I {} ./jsoninfo.sh {}



