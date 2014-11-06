#!/bin/bash

if [ $# != 1 ]
then
        echo "Usage:"
        echo " "
        echo "`basename $0` [yyyy/mm/dd/mm] "
        echo " "
        echo "e.g:      `basename $0` \"2014/08/01/00\" "
        echo " "
        exit 1
fi


DATEPATH=$1



##################################
# cleans only the _m, _r, _s directories

OUTPUTPREFIX="wf_jobs"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

echo Cleaning ${OUTPUTPREFIX}
mrm -r ${MPATH}/_m/
mrm -r ${MPATH}/_s/
mrm -r ${MPATH}/_r/



OUTPUTPREFIX="cnapi_servers"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

echo Cleaning ${OUTPUTPREFIX}
mrm -r ${MPATH}/_m/
mrm -r ${MPATH}/_s/
mrm -r ${MPATH}/_r/


OUTPUTPREFIX="vmapi_vms"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

echo Cleaning ${OUTPUTPREFIX}
mrm -r ${MPATH}/_m/
mrm -r ${MPATH}/_s/
mrm -r ${MPATH}/_r/

OUTPUTPREFIX="ufds_o_sdc"
MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

echo Cleaning ${OUTPUTPREFIX}
mrm -r ${MPATH}/_m/
mrm -r ${MPATH}/_s/
mrm -r ${MPATH}/_r/
