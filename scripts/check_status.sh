#!/bin/bash

echo "=============================================="
echo "  EnergyChain 服务状态检查"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"

# ═══ 1. 链节点 ═══
echo ""
echo "═══ 1. 链节点 ═══"
NODE_COUNT=$(ps aux | grep 'energychaind start' | grep -v grep | wc -l)
echo "  运行中: ${NODE_COUNT}/8"

for role in seed sentry-0 sentry-1 fullnode validator-0 validator-1 validator-2 validator-3; do
  pid=$(ps aux | grep "energychaind start.*/${role}" | grep -v grep | awk '{print $2}')
  if [ -n "$pid" ]; then
    echo "    ✅ ${role} (PID: $pid)"
  else
    echo "    ❌ ${role}"
  fi
done

# ═══ 2. 区块高度 ═══
echo ""
echo "═══ 2. 区块高度 ═══"
HEIGHT=$(curl -s --max-time 3 http://127.0.0.1:26687/status 2>/dev/null | jq -r '.result.sync_info.latest_block_height // empty' 2>/dev/null)
BLOCK_TIME=$(curl -s --max-time 3 http://127.0.0.1:26687/status 2>/dev/null | jq -r '.result.sync_info.latest_block_time // empty' 2>/dev/null)
if [ -n "$HEIGHT" ]; then
  echo "  Cosmos 高度: $HEIGHT"
  echo "  出块时间:    $BLOCK_TIME"
else
  echo "  ❌ 无法获取 (CometBFT RPC 不可达)"
fi

EVM_HEX=$(curl -s --max-time 3 -X POST http://127.0.0.1:8575 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' 2>/dev/null | jq -r '.result // empty' 2>/dev/null)
if [ -n "$EVM_HEX" ]; then
  EVM_DEC=$(printf "%d" "$EVM_HEX" 2>/dev/null)
  echo "  EVM 高度:    $EVM_DEC"
else
  echo "  ❌ EVM RPC 不可达"
fi

# ═══ 3. Blockscout ═══
echo ""
echo "═══ 3. Blockscout (Docker) ═══"
if command -v docker >/dev/null 2>&1; then
  CONTAINERS=$(docker ps --format "{{.Names}}\t{{.Status}}" --filter "name=blockscout" --filter "name=stats" 2>/dev/null)
  if [ -n "$CONTAINERS" ]; then
    echo "$CONTAINERS" | while IFS=$'\t' read -r name status; do
      echo "    ✅ $name — $status"
    done
    INDEXING=$(curl -s --max-time 3 "http://127.0.0.1:3001/api/v2/main-page/indexing-status" 2>/dev/null | jq -r '"已索引: " + (.indexed_blocks_ratio // "?") + " 区块"' 2>/dev/null)
    [ -n "$INDEXING" ] && echo "    $INDEXING"
  else
    echo "    ❌ 无 Blockscout 容器运行"
  fi
else
  echo "    ⚠️  Docker 未安装"
fi

# ═══ 4. DEX 前端 ═══
echo ""
echo "═══ 4. DEX 前端 ═══"
DEX_PID=$(ps aux | grep -E 'vite preview.*3000|vite.*--port 3000' | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$DEX_PID" ]; then
  echo "    ✅ 运行中 (PID: $DEX_PID)"
  echo "       http://${SERVER_IP}:3000"
else
  echo "    ❌ 未运行"
fi

# ═══ 5. Ping.pub ═══
echo ""
echo "═══ 5. Ping.pub ═══"
PING_PID=$(ps aux | grep -E 'serve.*5173|serve.*dist' | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$PING_PID" ]; then
  echo "    ✅ 运行中 (PID: $PING_PID)"
  echo "       http://${SERVER_IP}:5173/energychain"
else
  echo "    ❌ 未运行"
fi

# ═══ 6. 交易机器人 ═══
echo ""
echo "═══ 6. DEX 交易机器人 ═══"
BOT_PID=$(ps aux | grep -E 'run_trade_bot|simulate_trades' | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$BOT_PID" ]; then
  echo "    ✅ 运行中 (PID: $BOT_PID)"
  if [ -f /tmp/trades.log ]; then
    echo "    最近交易:"
    tail -3 /tmp/trades.log 2>/dev/null | sed 's/^/       /'
  fi
else
  echo "    ❌ 未运行"
fi

# ═══ 7. 数据上链 ═══
echo ""
echo "═══ 7. 有功功率数据上链 ═══"
UP_PID=$(ps aux | grep -E 'run_data_uploader|batch_upload_loop' | grep -v grep | awk '{print $2}' | head -1)
if [ -n "$UP_PID" ]; then
  echo "    ✅ 运行中 (PID: $UP_PID)"
  if [ -f /tmp/batch_upload.log ]; then
    echo "    最近日志:"
    tail -3 /tmp/batch_upload.log 2>/dev/null | sed 's/^/       /'
  fi
else
  echo "    ❌ 未运行"
fi

# ═══ 8. 端口检查 ═══
echo ""
echo "═══ 8. 端口监听 ═══"
PORTS="26687:CometBFT_RPC 1320:REST_API 8575:EVM_HTTP 8576:EVM_WS 9390:gRPC 3000:DEX前端 3001:Blockscout 5173:Ping.pub 8080:Stats_API"

for entry in $PORTS; do
  port="${entry%%:*}"
  name="${entry##*:}"
  if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
    echo "    ✅ :${port}  ${name}"
  elif command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:${port} -sTCP:LISTEN >/dev/null 2>&1; then
    echo "    ✅ :${port}  ${name}"
  else
    echo "    ❌ :${port}  ${name}"
  fi
done

# ═══ 汇总 ═══
echo ""
echo "═══ 访问地址 ═══"
echo "  DEX 前端:      http://${SERVER_IP}:3000"
echo "  Blockscout:    http://${SERVER_IP}:3001"
echo "  Ping.pub:      http://${SERVER_IP}:5173/energychain"
echo "  EVM JSON-RPC:  http://${SERVER_IP}:8575"
echo "  REST API:      http://${SERVER_IP}:1320"
echo ""
echo "=============================================="
