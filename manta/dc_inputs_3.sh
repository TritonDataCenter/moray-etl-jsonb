#!/bin/bash


if [ $# != 5 ]
then
        echo "Usage:"
        echo " "
        echo "`basename $0` [regexp] [yyyy/mm/dd/mm] [json manifest] [split file prefix] [disk in GB]"
        echo " "
        echo "e.g:      `basename $0` \"^wf_jobs-\" \"2014/08/01/00\" wf_keys.json wf_jobs 64"
        echo "          `basename $0` \"^cnapi_servers-\" \"2014/08/01/00\" cnapi_keys.json cnapi_servers 8"
        echo "          `basename $0` \"^vmapi_vms-\" \"2014/08/01/00\" vmapi_keys.json vmapi_vms 16"
        echo "          `basename $0` \"^ufds_o_smartdc-\" \"2014/08/01/00\" ufds_keys.json ufds_o_sdc 8"
        echo "          `basename $0` \"^sdc_packages-\" \"2014/08/01/00\" papi_keys.json sdc_packages 8"
        echo "          `basename $0` \"^imgapi_images-\" \"2014/08/01/00\" imgapi_keys.json imgapi_images 8"
        echo " "
        exit 1
fi

REGEXP=$1
DATEPATH=$2
MANIFEST=$3
OUTPUTPREFIX=$4
DISK=$5

MPATH="/${MANTA_USER}/stor/etl/${DATEPATH}/${OUTPUTPREFIX}"

ASSETS="/assets/$MANTA_USER/stor"


##################################
#  collect and reduce _tst.json typestate information

mfind -n '_tst.json$' ${MPATH}/_s/ | \
mjob create \
-w -m "cat" \
-s /$MANTA_USER/stor/moray-etl-jsonb.tgz \
--init "cd /var/tmp && tar -xzf ${ASSETS}/moray-etl-jsonb.tgz" \
-r "/var/tmp/moray-etl-jsonb/lib/pgtypes_reduce.js -o /var/tmp/all_s  && \
 mput -f /var/tmp/all_s.json $MPATH/_s/${OUTPUTPREFIX}_s.tst_json && \
 mput -f /var/tmp/all_s.sql $MPATH/_s/${OUTPUTPREFIX}_s.sql"



mfind -n '.U_tst.json$' ${MPATH}/_r/ | \
mjob create \
-w -m "cat" \
-s /$MANTA_USER/stor/moray-etl-jsonb.tgz \
--init "cd /var/tmp && tar -xzf ${ASSETS}/moray-etl-jsonb.tgz" \
-r "/var/tmp/moray-etl-jsonb/lib/pgtypes_reduce.js -o /var/tmp/all_r  && \
 mput -f /var/tmp/all_r.json $MPATH/_r/${OUTPUTPREFIX}_r.tst_json && \
 mput -f /var/tmp/all_r.sql $MPATH/_r/${OUTPUTPREFIX}_r.sql"


# wait on this one
mfind -n '_tst.json$' ${MPATH}/_m/ | \
mjob create \
-w -m "cat" \
-s /$MANTA_USER/stor/moray-etl-jsonb.tgz \
--init "cd /var/tmp && tar -xzf ${ASSETS}/moray-etl-jsonb.tgz" \
-r "/var/tmp/moray-etl-jsonb/lib/pgtypes_reduce.js -o /var/tmp/all_m  && \
 mput -f /var/tmp/all_m.json $MPATH/_m/${OUTPUTPREFIX}_m.tst_json && \
 mput -f /var/tmp/all_m.sql $MPATH/_m/${OUTPUTPREFIX}_m.sql"



#########################################
#  make tab separated value files

mfind -n '_m.json$' ${MPATH}/_m/ | \
mjob create --memory 4096 --disk ${DISK} \
-s /$MANTA_USER/stor/moray-etl-jsonb.tgz \
--init "cd /var/tmp && tar -xzf ${ASSETS}/moray-etl-jsonb.tgz && mget -q ${MPATH}/_m/${OUTPUTPREFIX}_m.tst_json > all_m.json" \
-w -m "/var/tmp/moray-etl-jsonb/lib/json_tsv.js -i /var/tmp/all_m.json > /var/tmp/tmp.tsv && \
mput -f /var/tmp/tmp.tsv $MPATH/_m/\$(basename \${MANTA_INPUT_FILE}).tsv"

mfind -n '_s.json$' ${MPATH}/_s/ | \
mjob create --memory 2048 \
-s /$MANTA_USER/stor/moray-etl-jsonb.tgz \
--init "cd /var/tmp && tar -xzf ${ASSETS}/moray-etl-jsonb.tgz && mget -q ${MPATH}/_s/${OUTPUTPREFIX}_s.tst_json > all_s.json" \
-w -m "/var/tmp/moray-etl-jsonb/lib/json_tsv.js -i /var/tmp/all_s.json > /var/tmp/tmp.tsv && \
mput -f /var/tmp/tmp.tsv $MPATH/_s/\$(basename \${MANTA_INPUT_FILE}).tsv"

mfind -n '_r.json.U$' ${MPATH}/_r/ | \
mjob create --memory 2048 \
-s /$MANTA_USER/stor/moray-etl-jsonb.tgz \
--init "cd /var/tmp && tar -xzf ${ASSETS}/moray-etl-jsonb.tgz && mget -q ${MPATH}/_r/${OUTPUTPREFIX}_r.tst_json > all_r.json" \
-w -m "/var/tmp/moray-etl-jsonb/lib/json_tsv.js -i /var/tmp/all_r.json > /var/tmp/tmp.tsv && \
mput -f /var/tmp/tmp.tsv $MPATH/_r/\$(basename \${MANTA_INPUT_FILE}).tsv"


