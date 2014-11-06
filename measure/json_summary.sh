#!/bin/bash

if [ $# != 1 ]
then
        echo "Usage:"
        echo " "
        echo "`basename $0` [json file]"
        echo " "
        exit 1
fi


FILE=$1

echo "Splitting out json elements"
./jsonsplitinfo.sh ${FILE}

echo "Aggregating json element counts"
./jsonreduceinfo.sh ${FILE}

echo "Collating table"
mkdir fini
mv ${FILE}.* fini
cd fini
ls *.n_unique > col1
cat *.n_unique > col2
cat *.n_defined > col4
cat *.n_undefined > col6
cat *.bz2_bytes > col8
paste -d "," col1 col2 col4 col6 col8 > table
echo "name,unique,defined,undefined,bytes" > header
cat header table | sed -e "s/${FILE}.//" -e "s/.n_unique//" > table.csv

echo "Finished Table:"
cat table.csv
