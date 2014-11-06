#!/bin/bash
# this is jsonvalues.sh


# Needs 
# daggr >= 0.0.2 https://github.com/joyent/daggr

if [ $# != 2 ]
then
        echo "Uses to daggr extract tag's values from JSON file"
        echo "usage `basename $0` [jsonfile] [tag]"
        echo "   "
        exit 1
fi

echo Extracting Values. Counts for tag ${2} from JSON file ${1}

cat $1 | daggr -j -k $2 count | sed '/^$/d' > ${1}.${2}.txt

cat ${1}.${2}.txt |  awk '$1 != "undefined"' | awk '{n += $NF}; END{print n}' > ${1}.${2}.n_defined
cat ${1}.${2}.txt |  awk '$1 == "undefined"' | awk '{n += $NF}; END{print n}' > ${1}.${2}.n_undefined

## these need to operate on reduced, unique'd .txt files
# cat ${1}.${2}.txt | awk '$1 != "undefined"' | wc -l > ${1}.${2}.n_unique
# cat ${1}.${2}.txt | awk '$1 != "undefined"' | awk '{$NF=""}1' | pbzip2 -c > ${1}.${2}.bz2
# wc -c  < ${1}.${2}.bz2 > ${1}.${2}.bz2_bytes

