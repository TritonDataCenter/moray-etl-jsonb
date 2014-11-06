#!/bin/bash
# this is jsonreduceinfo.sh

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
        echo "Reduces split jsonsplitinfo data back to summary - top level"
        echo "usage `basename $0` [jsonfile]"
        echo "   "
        exit 1
fi


### Accumulate unique set of top-level tags:

cat ${1}.splits | xargs -I {} cat {}.__1._tags | sort | uniq > ${1}.__1._tags

### Accumulate values for each tag
cat ${1}.__1._tags | xargs -I {} ./jsonreduce.sh ${1}  {}


### Do the objects...

# Find all the extracted objects
cat ${1}.splits | xargs -I {} cat {}.__1._objects | sort | uniq > ${1}.__1._objects


# Consolidate json for each object
cat ${1}.__1._objects | xargs -I {} ./jsonreduceobjects.sh $1 {}
