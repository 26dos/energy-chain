#!/bin/bash
set -e

CLI="node /Users/jiangdanhui/Desktop/code/nd-pro/energy-chain/cli/bin/energy-cli.js"
RPC="--rpc http://127.0.0.1:8545"
CONTRACT="--contract 0x6a407DD067d79659F58a4887Fb7ec188207Fc1A6"
KEY="--key 0x8be1e5311e4cb31002c5c84cea459b5e598592f1d00c796e3de2880d55fe9990"
COMMON="$RPC $CONTRACT $KEY"
MOCK_DIR="$(dirname "$0")"

echo "========================================"
echo " 能源公链 Mock 数据上链"
echo "========================================"
echo ""

echo "📋 [1/5] 虚拟电厂合同数据 (5条)..."
$CLI batch-attest -f "$MOCK_DIR/vpp_contracts.json" -t "vpp_contract" -m "虚拟电厂合同存证-2026年度" $COMMON
echo ""

echo "📋 [2/5] 充电桩订单数据 (5条)..."
$CLI batch-attest -f "$MOCK_DIR/charging_orders.json" -t "charging_order" -m "充电桩订单存证-20260315" $COMMON
echo ""

echo "📋 [3/5] 电表抄表数据 (5条)..."
$CLI batch-attest -f "$MOCK_DIR/meter_readings.json" -t "meter_reading" -m "电表抄表数据存证-20260315" $COMMON
echo ""

echo "📋 [4/5] 现货交易数据 (4条)..."
$CLI batch-attest -f "$MOCK_DIR/spot_trades.json" -t "spot_trade" -m "电力现货交易存证-20260315" $COMMON
echo ""

echo "📋 [5/5] 零售套餐数据 (4条)..."
$CLI batch-attest -f "$MOCK_DIR/retail_packages.json" -t "retail_package" -m "售电零售套餐存证-2026年度" $COMMON
echo ""

echo "========================================"
echo " 批量上链完成，提交单条存证..."
echo "========================================"
echo ""

echo "📋 [6] 单条存证: 光伏发电数据..."
$CLI attest -d '{"station_id":"PV-HZ-001","station_name":"杭州余杭光伏电站","date":"2026-03-15","generation_kwh":12580,"peak_power_kw":3200,"sunshine_hours":6.8,"efficiency":0.186}' -t "pv_generation" -m "光伏发电日报-20260315" $COMMON
echo ""

echo "📋 [7] 单条存证: 储能调度数据..."
$CLI attest -d '{"ess_id":"ESS-SZ-001","name":"深圳前海储能电站","date":"2026-03-15","charge_kwh":5000,"discharge_kwh":4800,"cycles":1.2,"soc_start":0.20,"soc_end":0.25,"revenue_yuan":3840}' -t "ess_dispatch" -m "储能调度日报-20260315" $COMMON
echo ""

echo "📋 [8] 单条存证: 需求响应事件..."
$CLI attest -d '{"event_id":"DR-20260315-001","region":"浙江","event_type":"削峰","target_mw":500,"actual_mw":485,"participants":128,"start_time":"2026-03-15T14:00:00","end_time":"2026-03-15T16:00:00","compensation_yuan":242500}' -t "demand_response" -m "需求响应事件存证" $COMMON
echo ""

echo "📋 [9] 单条存证: 碳排放数据..."
$CLI attest -d '{"entity_id":"ENT-GD-001","entity_name":"广东某火电厂","year":2026,"month":3,"co2_tons":18500,"so2_tons":12.3,"nox_tons":8.7,"carbon_intensity":0.82,"green_cert_count":0}' -t "carbon_emission" -m "碳排放月报-202603" $COMMON
echo ""

echo "📋 [10] 单条存证: 绿证交易..."
$CLI attest -d '{"cert_id":"GEC-2026-ZJ-00158","source":"浙江某风电场","type":"风电","volume_mwh":100,"price_yuan":50.00,"buyer":"杭州某科技公司","trade_date":"2026-03-15","serial_range":"GEC20260315-0001~0100"}' -t "green_certificate" -m "绿证交易存证" $COMMON
echo ""

echo "========================================"
echo " 全部完成! 查询总存证数..."
echo "========================================"
$CLI query --total $RPC $CONTRACT
