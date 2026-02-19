export interface Transaction {
  transaction_id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  timestamp: Date;
}

export interface SuspiciousAccount {
  account_id: string;
  suspicion_score: number;
  detected_patterns: string[];
  ring_id: string;
}

export interface FraudRing {
  ring_id: string;
  member_accounts: string[];
  pattern_type: string;
  risk_score: number;
}

export interface AnalysisResult {
  suspicious_accounts: SuspiciousAccount[];
  fraud_rings: FraudRing[];
  summary: {
    total_accounts_analyzed: number;
    suspicious_accounts_flagged: number;
    fraud_rings_detected: number;
    processing_time_seconds: number;
  };
  graph: GraphData;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  suspicious: boolean;
  suspicion_score: number;
  ring_ids: string[];
  in_degree: number;
  out_degree: number;
  total_amount_in: number;
  total_amount_out: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  amount: number;
  transaction_id: string;
  timestamp: Date;
}

export interface AggregatedEdge {
  source: string;
  target: string;
  totalAmount: number;
  count: number;
}
