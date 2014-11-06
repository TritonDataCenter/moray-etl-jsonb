#!/bin/bash
SPLITWC=????
#this is jsonreduceobjects.sh

# Needs 
# daggr >= 0.0.2 https://github.com/joyent/daggr

if [ $# != 2 ]
then
        echo "Use to recombine split inner JSON Objects into new JSON file"
        echo "usage `basename $0` [jsonfile] [object]"
        echo "   "
        exit 1
fi

# echo Reducing split objects ${2} tags 

# cat ${1}.splits | xargs -I {} cat {}.${2}.json.__1._tags | sort | uniq > ${1}.${2}.json.__1._tags

# echo Reducing split object ${2} JSON to JSON file ${1}.${2}.json

# cat ${1}.splits | xargs -I {} cat {}.${2}.json > ${1}.${2}.json

#echo Reducing data for consolidated object ${2}

ls ${1}_.${SPLITWC}.${2}.json > ${1}.${2}.json.splits

./jsonreduceinfo.sh ${1}.${2}.json 
