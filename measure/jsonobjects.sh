#!/bin/bash
# this is jsonobjects.sh

# Needs 
# daggr >= 0.0.2 https://github.com/joyent/daggr

if [ $# != 2 ]
then
        echo "Uses to daggr extract JSON Objects into new JSON file"
        echo "usage `basename $0` [jsonfile] [object]"
        echo "   "
        exit 1
fi

echo Extracting Object ${2} from JSON file ${1}

cat $1 | daggr -j -o $2 | sed -e 's/undefined//' -e '/^$/d' > ${1}.${2}.json

./jsoninfo.sh ${1}.${2}.json
