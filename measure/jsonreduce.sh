#!/bin/bash
#this is jsonreduce.sh

SPLITSUFFIX=4
SPLITWC="????"
# split required for inputs to Trent's json tool which runs out of memory on big JSON
# split -a 4 -l 30000 gives unique names for up to  13 709 280 000 lines of json
# Assuming 512 bytes per line that is about 7 TB 
# Changing to  5 will handle about 180 TB at this size, or 360 Tb at 1024 bytes per line

if [ $# != 2 ]
then
        echo "Reduces data with given tag "
        echo "usage `basename $0` [jsonfile] [tag]"
        echo "   "
        exit 1
fi


### Loop through each split and accumulate data 
echo Accumulating data for tag ${2}

cat ${1}.splits | xargs -I {} cat {}.${2}.n_defined  | awk '{l += $1} END { print l }' > ${1}.${2}.n_defined
cat ${1}.splits | xargs -I {} cat {}.${2}.n_undefined  | awk '{l += $1} END { print l }' > ${1}.${2}.n_undefined

## Accumulate all the values of this tag into one file, strip off counts at end

cat ${1}.splits | xargs -I {} cat {}.${2}.txt | awk '$1 != "undefined"' | sed '/^$/d' | awk '{$NF=""}1'  > ${1}.${2}.txt

## Count the number of unique tag values

cat ${1}.${2}.txt | sort | uniq |  wc -l  > ${1}.${2}.n_unique

## Compress it , get the compressed size

### NOTE THIS DOES NOT SORT / UNIQUE THE LIST...   

cat ${1}.${2}.txt | pbzip2 -c > ${1}.${2}.bz2
wc -c  < ${1}.${2}.bz2 > ${1}.${2}.bz2_bytes

# Remove split files
# rm ${1}_.${SPLITWC}*
