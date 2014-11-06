#!/bin/bash
# This is jsoninfo.sh

# Needs 
# jq >= 1.3  http://stedolan.github.io/jq/
# Node.js tools (use npm)
# json  >= 7.0.1  https://github.com/trentm/json
# daggr >= 0.0.2 https://github.com/joyent/daggr

if [ $# != 1 ]
then
        echo "Uses jq, json and daggr to analyze JSON information"
        echo "usage `basename $0` [jsonfile]"
        echo "   "
        exit 1
fi


echo Analyzing ${1} 

# cat $1 | json -g | jq 'map(keys) | unique' > ${1}.keymap


cat $1 | json --merge -k -a > ${1}.__1._tags


### Loop through each tag and create counts

cat ${1}.__1._tags | xargs -I {} ./jsonvalues.sh $1 {}


### Any objects ?

grep -null "\[object Object\]" ${1}.*.txt | sed -e "s/${1}.//" -e "s/.txt//" > ${1}.__1._objects

# cat ${1}.__1._objects | xargs -I {} ./jsonobjects.sh $1 {}


