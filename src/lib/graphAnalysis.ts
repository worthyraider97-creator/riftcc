import { Transaction, AnalysisResult, FraudRing, SuspiciousAccount, GraphNode, GraphEdge } from './types';

interface EdgeInfo {
  target: string;
  amount: number;
  timestamp: Date;
  transaction_id: string;
}

interface NodeStats {
  inDegree: number;
  outDegree: number;
  totalAmountIn: number;
  totalAmountOut: number;
  totalTransactions: number;
}

type AdjList = Record<string, EdgeInfo[]>;

// ── Main analysis ──────────────────────────────────────────
export function analyzeTransactions(transactions: Transaction[]): AnalysisResult {
  const startTime = performance.now();

  const adjList: AdjList = {};
  const reverseAdj: AdjList = {};
  const allNodes = new Set<string>();
  const nodeStats = new Map<string, NodeStats>();

  // Build adjacency lists
  for (const tx of transactions) {
    allNodes.add(tx.sender_id);
    allNodes.add(tx.receiver_id);
    if (!adjList[tx.sender_id]) adjList[tx.sender_id] = [];
    adjList[tx.sender_id].push({ target: tx.receiver_id, amount: tx.amount, timestamp: tx.timestamp, transaction_id: tx.transaction_id });
    if (!reverseAdj[tx.receiver_id]) reverseAdj[tx.receiver_id] = [];
    reverseAdj[tx.receiver_id].push({ target: tx.sender_id, amount: tx.amount, timestamp: tx.timestamp, transaction_id: tx.transaction_id });
  }

  // Compute stats
  for (const id of allNodes) {
    const out = adjList[id] || [];
    const inc = reverseAdj[id] || [];
    nodeStats.set(id, {
      inDegree: inc.length,
      outDegree: out.length,
      totalAmountIn: inc.reduce((s, e) => s + e.amount, 0),
      totalAmountOut: out.reduce((s, e) => s + e.amount, 0),
      totalTransactions: inc.length + out.length,
    });
  }

  // Detect patterns
  const cycles = findCycles(adjList, allNodes, 3, 5);
  const smurfing = detectSmurfing(transactions, nodeStats);
  const shells = detectShellNetworks(adjList, nodeStats, allNodes);

  // False-positive filters
  const merchants = detectMerchants(nodeStats, transactions);
  const payroll = detectPayroll(nodeStats, transactions);
  const legit = new Set([...merchants, ...payroll]);

  // Build rings & scoring
  let ringCounter = 0;
  const fraudRings: FraudRing[] = [];
  const acctRings = new Map<string, string[]>();
  const acctPatterns = new Map<string, Set<string>>();

  const addRing = (members: string[], patternType: string, baseScore: number, patternTag: string) => {
    const filtered = members.filter(id => !legit.has(id));
    if (filtered.length < 2) return;
    ringCounter++;
    const ringId = `RING_${String(ringCounter).padStart(3, '0')}`;
    fraudRings.push({ ring_id: ringId, member_accounts: filtered, pattern_type: patternType, risk_score: Math.min(100, baseScore + filtered.length * 2) });
    for (const id of filtered) {
      if (!acctRings.has(id)) acctRings.set(id, []);
      acctRings.get(id)!.push(ringId);
      if (!acctPatterns.has(id)) acctPatterns.set(id, new Set());
      acctPatterns.get(id)!.add(patternTag);
    }
  };

  for (const cycle of cycles) addRing(cycle, 'cycle', 75 + cycle.length * 3, `cycle_length_${cycle.length}`);
  for (const p of smurfing) addRing(p.accounts, p.type, 65, p.type);
  for (const chain of shells) addRing(chain, 'shell_network', 70, 'shell_network');

  // Score
  const suspiciousAccounts: SuspiciousAccount[] = [];
  for (const [id, ringIds] of acctRings) {
    if (legit.has(id)) continue;
    const patterns = acctPatterns.get(id) || new Set();
    let score = 0;
    if ([...patterns].some(p => p.startsWith('cycle_'))) score += 35;
    if (patterns.has('fan_in')) score += 25;
    if (patterns.has('fan_out')) score += 25;
    if (patterns.has('shell_network')) score += 20;
    if (ringIds.length > 1) score += 15;

    // Velocity
    const txs = transactions.filter(t => t.sender_id === id || t.receiver_id === id);
    if (txs.length > 1) {
      const sorted = txs.map(t => t.timestamp.getTime()).sort((a, b) => a - b);
      const spanH = (sorted[sorted.length - 1] - sorted[0]) / 3_600_000;
      if (spanH < 24 && txs.length > 5) { score += 15; patterns.add('high_velocity'); }
    }

    suspiciousAccounts.push({
      account_id: id,
      suspicion_score: Math.min(100, parseFloat(score.toFixed(1))),
      detected_patterns: [...patterns],
      ring_id: ringIds[0],
    });
  }
  suspiciousAccounts.sort((a, b) => b.suspicion_score - a.suspicion_score);

  // Graph data
  const graphNodes: GraphNode[] = [...allNodes].map(id => {
    const s = nodeStats.get(id)!;
    const sa = suspiciousAccounts.find(a => a.account_id === id);
    return {
      id, suspicious: acctRings.has(id) && !legit.has(id),
      suspicion_score: sa?.suspicion_score || 0,
      ring_ids: acctRings.get(id) || [],
      in_degree: s.inDegree, out_degree: s.outDegree,
      total_amount_in: s.totalAmountIn, total_amount_out: s.totalAmountOut,
    };
  });

  const graphEdges: GraphEdge[] = transactions.map(tx => ({
    source: tx.sender_id, target: tx.receiver_id,
    amount: tx.amount, transaction_id: tx.transaction_id, timestamp: tx.timestamp,
  }));

  return {
    suspicious_accounts: suspiciousAccounts,
    fraud_rings: fraudRings,
    summary: {
      total_accounts_analyzed: allNodes.size,
      suspicious_accounts_flagged: suspiciousAccounts.length,
      fraud_rings_detected: fraudRings.length,
      processing_time_seconds: parseFloat(((performance.now() - startTime) / 1000).toFixed(1)),
    },
    graph: { nodes: graphNodes, edges: graphEdges },
  };
}

// ── Cycle detection (length 3-5) ───────────────────────────
function findCycles(adj: AdjList, nodes: Set<string>, minLen: number, maxLen: number): string[][] {
  const allCycles: string[][] = [];
  const processed = new Set<string>();

  for (const start of nodes) {
    const path: string[] = [start];
    const inPath = new Set([start]);

    const dfs = (current: string, depth: number) => {
      for (const edge of adj[current] || []) {
        if (edge.target === start && depth + 1 >= minLen && depth + 1 <= maxLen) {
          allCycles.push([...path]);
        } else if (!inPath.has(edge.target) && !processed.has(edge.target) && depth + 1 < maxLen) {
          path.push(edge.target);
          inPath.add(edge.target);
          dfs(edge.target, depth + 1);
          path.pop();
          inPath.delete(edge.target);
        }
      }
    };
    dfs(start, 0);
    processed.add(start);
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique: string[][] = [];
  for (const cycle of allCycles) {
    const minId = cycle.reduce((m, id) => (id < m ? id : m), cycle[0]);
    const idx = cycle.indexOf(minId);
    const normalized = [...cycle.slice(idx), ...cycle.slice(0, idx)];
    const key = normalized.join('|');
    if (!seen.has(key)) { seen.add(key); unique.push(normalized); }
  }
  return unique;
}

// ── Smurfing (fan-in / fan-out within 72h) ────────────────
function detectSmurfing(transactions: Transaction[], nodeStats: Map<string, NodeStats>) {
  const patterns: { type: string; accounts: string[] }[] = [];
  const WINDOW_MS = 72 * 3_600_000;

  // Fan-in
  const byReceiver = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!byReceiver.has(tx.receiver_id)) byReceiver.set(tx.receiver_id, []);
    byReceiver.get(tx.receiver_id)!.push(tx);
  }
  for (const [recv, txs] of byReceiver) {
    const sorted = txs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (let i = 0; i < sorted.length; i++) {
      const windowEnd = sorted[i].timestamp.getTime() + WINDOW_MS;
      const windowTxs = sorted.filter(t => t.timestamp.getTime() >= sorted[i].timestamp.getTime() && t.timestamp.getTime() <= windowEnd);
      const uniqueSenders = new Set(windowTxs.map(t => t.sender_id));
      if (uniqueSenders.size >= 10) {
        patterns.push({ type: 'fan_in', accounts: [recv, ...uniqueSenders] });
        break;
      }
    }
  }

  // Fan-out
  const bySender = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!bySender.has(tx.sender_id)) bySender.set(tx.sender_id, []);
    bySender.get(tx.sender_id)!.push(tx);
  }
  for (const [sender, txs] of bySender) {
    const sorted = txs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (let i = 0; i < sorted.length; i++) {
      const windowEnd = sorted[i].timestamp.getTime() + WINDOW_MS;
      const windowTxs = sorted.filter(t => t.timestamp.getTime() >= sorted[i].timestamp.getTime() && t.timestamp.getTime() <= windowEnd);
      const uniqueRecvs = new Set(windowTxs.map(t => t.receiver_id));
      if (uniqueRecvs.size >= 10) {
        patterns.push({ type: 'fan_out', accounts: [sender, ...uniqueRecvs] });
        break;
      }
    }
  }
  return patterns;
}

// ── Shell networks (chains of 3+ hops through low-tx intermediaries) ──
function detectShellNetworks(adj: AdjList, nodeStats: Map<string, NodeStats>, allNodes: Set<string>): string[][] {
  const chains: string[][] = [];
  const seen = new Set<string>();

  for (const start of allNodes) {
    const startStats = nodeStats.get(start);
    if (!startStats || startStats.totalTransactions <= 3) continue;

    for (const edge of adj[start] || []) {
      const firstStats = nodeStats.get(edge.target);
      if (!firstStats || firstStats.totalTransactions > 3) continue;

      const chain = [start, edge.target];
      const visited = new Set(chain);
      let current = edge.target;

      while (chain.length < 8) {
        const nextEdges = (adj[current] || []).filter(e => !visited.has(e.target));
        const nextShell = nextEdges.find(e => {
          const s = nodeStats.get(e.target);
          return s && s.totalTransactions <= 3;
        });

        if (nextShell) {
          chain.push(nextShell.target);
          visited.add(nextShell.target);
          current = nextShell.target;
        } else {
          if (nextEdges.length > 0) chain.push(nextEdges[0].target);
          break;
        }
      }

      if (chain.length >= 4) {
        const key = chain.join('→');
        if (!seen.has(key)) { seen.add(key); chains.push(chain); }
      }
    }
  }
  return chains;
}

// ── False positive filters ────────────────────────────────
function detectMerchants(nodeStats: Map<string, NodeStats>, transactions: Transaction[]): Set<string> {
  const merchants = new Set<string>();
  for (const [id, stats] of nodeStats) {
    if (stats.inDegree < 20) continue;
    const incoming = transactions.filter(t => t.receiver_id === id);
    const uniqueSenders = new Set(incoming.map(t => t.sender_id));
    if (uniqueSenders.size >= 15) {
      const ts = incoming.map(t => t.timestamp.getTime());
      if ((Math.max(...ts) - Math.min(...ts)) / 3_600_000 > 168) merchants.add(id);
    }
  }
  return merchants;
}

function detectPayroll(nodeStats: Map<string, NodeStats>, transactions: Transaction[]): Set<string> {
  const payroll = new Set<string>();
  for (const [id, stats] of nodeStats) {
    if (stats.outDegree < 10) continue;
    const outgoing = transactions.filter(t => t.sender_id === id);
    const amounts = outgoing.map(t => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    if (Math.sqrt(variance) / mean < 0.15) payroll.add(id);
  }
  return payroll;
}
