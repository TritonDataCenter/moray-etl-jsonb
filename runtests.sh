#!/bin/bash

# Script to run tests on library components
# Output populates examples in jsonbQdemo

DIR=`pwd`
set -e


echo 'Building Manifests'

./lib/cnapi_keys_tojson.js
cat cnapi_keys.json | json -H > cnapi_keys_.json
mv cnapi_keys_.json lib/cnapi_keys.json
rm -f cnapi_keys.json
	
./lib/lastfm_flat_tojson.js	
cat lastfm_flat.json | json -H > lastfm_flat_.json
mv lastfm_flat_.json lib/lastfm_flat.json
rm -f lastfm_flat.json

./lib/ufds_keys_tojson.js	
cat ufds_keys.json | json -H > ufds_keys_.json
mv ufds_keys_.json lib/ufds_keys.json
rm -f ufds_keys.json

./lib/vmapi_keys_tojson.js	
cat vmapi_keys.json | json -H > vmapi_keys_.json
mv vmapi_keys_.json lib/vmapi_keys.json
rm -f vmapi_keys.json

./lib/wf_flat_tojson.js	
cat wf_flat.json | json -H > wf_flat_.json
mv wf_flat_.json lib/wf_flat.json
rm -f wf_flat.json

./lib/wf_keys_tojson.js
cat wf_keys.json | json -H > wf_keys_.json
mv wf_keys_.json lib/wf_keys.json
rm -f wf_keys.json

./lib/papi_keys_tojson.js
cat papi_keys.json | json -H > papi_keys_.json
mv papi_keys_.json lib/papi_keys.json
rm -f papi_keys.json

./lib/imgapi_keys_tojson.js
cat imgapi_keys.json | json -H > imgapi_keys_.json
mv imgapi_keys_.json lib/imgapi_keys.json
rm -f imgapi_keys.json

./lib/napi_ips_tojson.js
cat napi_ips_keys.json | json -H > napi_ips_keys_.json
mv napi_ips_keys_.json lib/napi_ips_keys.json
rm -f napi_ips_keys.json

./lib/napi_nic_tags_tojson.js
cat napi_nic_tags_keys.json | json -H > napi_nic_tags_keys_.json
mv napi_nic_tags_keys_.json lib/napi_nic_tags_keys.json
rm -f napi_nic_tags_keys.json

./lib/napi_network_pools_tojson.js
cat napi_network_pools_keys.json | json -H > napi_network_pools_keys_.json
mv napi_network_pools_keys_.json lib/napi_network_pools_keys.json
rm -f napi_network_pools_keys.json

./lib/napi_nics_tojson.js
cat napi_nics_keys.json | json -H > napi_nics_keys_.json
mv napi_nics_keys_.json lib/napi_nics_keys.json
rm -f napi_nics_keys.json

./lib/napi_networks_tojson.js
cat napi_networks_keys.json | json -H > napi_networks_keys_.json
mv napi_networks_keys_.json lib/napi_networks_keys.json
rm -f napi_networks_keys.json




echo 'Testing wrap_values.js'
if cat ${DIR}/test/lastfm_subset.json | ./lib/wrap_values.js > lastfm_wrap.json; then
    echo '          [PASS] wrap_values.js'
else
    echo '          [FAIL] wrap_values.js'
fi



echo 'Testing moraydump_reorg.js'
if cat lastfm_wrap.json | ./lib/moraydump_reorg.js -t ${DIR}/lib/lastfm_flat.json -o lastfm; then
    echo '          [PASS] moraydump_reorg.js Test 1 - lastfm'
else
    echo '          [FAIL] moraydump_reorg.js Test 1 - lastfm'
fi

if cat ${DIR}/test/wf_jobs.json | ./lib/moraydump_reorg.js -t ${DIR}/lib/wf_flat.json -o wf_; then
    echo '          [PASS] moraydump_reorg.js Test 1 - wf flat'
else
    echo '          [FAIL] moraydump_reorg.js Test 1 - wf flat'
fi

if cat ${DIR}/test/wf_jobs.json | ./lib/moraydump_reorg.js -t ${DIR}/lib/wf_keys.json -o wf; then
    echo '          [PASS] moraydump_reorg.js Test 1 - wf 3-table'
else
    echo '          [FAIL] moraydump_reorg.js Test 1 - wf 3-table'
fi


cat wf_r.json | sort -r | uniq > wf_rU.json
mv wf_rU.json wf_r.json

   
echo 'Testing json2pgtypes.js'
if cat lastfm_flat_m.json | ./lib/json2pgtypes.js -o lastfm_flat_m_types; then
    echo '          [PASS] json2pgtypes.js Test 1'
else
    echo '          [FAIL] json2pgtypes.js Test 1'
fi

if diff -q lastfm_flat_m_types.sql test/lastfm_types.sql > /dev/null; then
    echo '          [PASS] json2pgtypes.js Test 2'
else
    echo '          [FAIL] json2pgtypes.js Test 2'
fi

cat test/test_json2pgtypes.json | ./lib/json2pgtypes.js -o test_3 &>/dev/null
if diff -q test_3.sql test/json2pgtypes_test1.sql > /dev/null; then
    echo '          [PASS] json2pgtypes.js Test 3'
else
    echo '          [FAIL] json2pgtypes.js Test 3'
fi

cat test/test_json2pgtypes_array.json | ./lib/json2pgtypes.js -o test_4 &>/dev/null
if diff -q test_4.sql test/json2pgtypes_test2.sql > /dev/null; then
    echo '          [PASS] json2pgtypes.js Test 4'
else
    echo '          [FAIL] json2pgtypes.js Test 4'
fi

cat wf_flat_m.json | ./lib/json2pgtypes.js -o wf_flat_m_types &>/dev/null
if diff -q wf_flat_m_types.sql test/wf_flat.sql > /dev/null; then
    echo '          [PASS] json2pgtypes.js Test 5'
else
    echo '          [FAIL] json2pgtypes.js Test 5'
fi

cat wf_s.json | ./lib/json2pgtypes.js -o wf_s_types &>/dev/null
if diff -q wf_s_types.sql test/wf_s.sql > /dev/null; then
    echo '          [PASS] json2pgtypes.js Test 6'
else
    echo '          [FAIL] json2pgtypes.js Test 6'
fi

cat wf_r.json | ./lib/json2pgtypes.js -o wf_r_types &>/dev/null
if diff -q wf_r_types.sql test/wf_r.sql > /dev/null; then
    echo '          [PASS] json2pgtypes.js Test 7'
else
    echo '          [FAIL] json2pgtypes.js Test 7'
fi


cat wf_m.json | ./lib/json2pgtypes.js -o wf_m_types &>/dev/null
if diff -q wf_m_types.sql test/wf_m.sql > /dev/null; then
    echo '          [PASS] json2pgtypes.js Test 8'
else
    echo '          [FAIL] json2pgtypes.js Test 8'
fi



echo 'Testing json_tsv.js'
if cat lastfm_flat_m.json | ./lib/json_tsv.js -i ${DIR}/lastfm_flat_m_types.json > lastfm_flat_m.tsv; then
    echo '          [PASS] json_tsv.js Test 1 lastfm'
else
    echo '          [FAIL] json_tsv.js Test 1 lastfm'
fi

if cat wf_flat_m.json | ./lib/json_tsv.js -i ${DIR}/wf_flat_m_types.json > wf_flat_m.tsv; then
    echo '          [PASS] json_tsv.js Test 2 wf_flat'
else
    echo '          [FAIL] json_tsv.js Test 2 wf_flat'
fi

if cat wf_s.json | ./lib/json_tsv.js -i ${DIR}/wf_s_types.json > wf_s.tsv; then
    echo '          [PASS] json_tsv.js Test 3 wf_s'
else
    echo '          [FAIL] json_tsv.js Test 3 wf_s'
fi

if cat wf_r.json | ./lib/json_tsv.js -i ${DIR}/wf_r_types.json > wf_r.tsv; then
    echo '          [PASS] json_tsv.js Test 4 wf_r'
else
    echo '          [FAIL] json_tsv.js Test 4 wf_r'
fi

if cat wf_m.json | ./lib/json_tsv.js -i ${DIR}/wf_m_types.json > wf_m.tsv; then
    echo '          [PASS] json_tsv.js Test 5 wf_m'
else
    echo '          [FAIL] json_tsv.js Test 5 wf_m'
fi


echo 'Testing pgtypes_reduce.js'
if cat ${DIR}/test/test_pgtypes_reduce.json | ./lib/pgtypes_reduce.js -o test_1; then
    echo '          [PASS] pgtypes_reduce.js Test 1'
else
    echo '          [FAIL] pgtypes_reduce.js Test 1'
fi


if diff -q test_1.json test/pgtypes_reduce_out.json > /dev/null; then
    echo '          [PASS] pgtypes_reduce.js Test 2'
else
    echo '          [FAIL] pgtypes_reduce.js Test 2'
fi


echo 'Copying examples to jsonbQdemo'
rm -f test_*
mv *.tsv jsonbQdemo/
mv *.sql jsonbQdemo/
rm -f wf_*
rm -f lastfm_*
sed -i.bak 's/_jobs//g' jsonbQdemo/wf_m_types.sql
sed -i.bak 's/_jobs//g' jsonbQdemo/wf_r_types.sql
sed -i.bak 's/_jobs//g' jsonbQdemo/wf_s_types.sql
rm -f jsonbQdemo/wf_?_types.sql.bak
