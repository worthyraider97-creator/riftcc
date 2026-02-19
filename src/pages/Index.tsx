import { useState, useCallback } from 'react';
import { parseCSV } from '@/lib/csvParser';
import { analyzeTransactions } from '@/lib/graphAnalysis';
import { AnalysisResult } from '@/lib/types';
import FileUpload from '@/components/FileUpload';
import GraphVisualization from '@/components/GraphVisualization';
import FraudRingTable from '@/components/FraudRingTable';
import AnalysisDashboard from '@/components/AnalysisDashboard';
import { Shield, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const { toast } = useToast();

  const handleUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    setResult(null);
    setSelectedRingId(null);
    try {
      const transactions = await parseCSV(file);
      if (transactions.length === 0) throw new Error('No valid transactions found');
      const analysisResult = analyzeTransactions(transactions);
      setResult(analysisResult);
      toast({ title: 'Analysis complete', description: `Processed ${transactions.length} transactions in ${analysisResult.summary.processing_time_seconds}s` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to process file', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleReset = () => {
    setResult(null);
    setSelectedRingId(null);
    setSelectedNode(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight">Financial Forensics Engine</h1>
              <p className="text-[11px] text-muted-foreground">Money Muling Detection · Graph Analysis</p>
            </div>
          </div>
          {result && (
            <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
              <RotateCcw className="w-3 h-3 mr-1" /> New Analysis
            </Button>
          )}
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {!result ? (
          /* Upload State */
          <div className="max-w-2xl mx-auto pt-16 space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-foreground tracking-tight">
                Detect Money Muling <span className="text-primary">Networks</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Upload transaction data to expose circular fund routing, smurfing patterns, and layered shell networks through graph analysis.
              </p>
            </div>
            <FileUpload onFileUpload={handleUpload} isProcessing={isProcessing} />
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { title: 'Cycle Detection', desc: 'Circular fund routing (3-5 hops)' },
                { title: 'Smurfing Analysis', desc: 'Fan-in/fan-out patterns in 72h windows' },
                { title: 'Shell Networks', desc: 'Layered intermediary chains' },
              ].map(f => (
                <div key={f.title} className="bg-card border border-border rounded-xl p-4">
                  <p className="text-sm font-semibold text-foreground mb-1">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Results State */
          <div className="space-y-6 animate-fade-in-up">
            <AnalysisDashboard result={result} />

            <section>
              <h3 className="text-lg font-bold text-foreground mb-3">Transaction Network Graph</h3>
              <GraphVisualization
                data={result.graph}
                rings={result.fraud_rings}
                selectedRingId={selectedRingId}
                onNodeSelect={setSelectedNode}
              />
              {selectedNode && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Selected: <span className="font-mono text-foreground">{selectedNode}</span>
                  {' '}
                  <button className="text-primary underline" onClick={() => setSelectedNode(null)}>clear</button>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-lg font-bold text-foreground mb-3">
                Fraud Ring Summary
                {selectedRingId && (
                  <button className="text-xs text-primary font-normal ml-2 underline" onClick={() => setSelectedRingId(null)}>
                    Clear filter
                  </button>
                )}
              </h3>
              <FraudRingTable
                rings={result.fraud_rings}
                selectedRingId={selectedRingId}
                onSelectRing={setSelectedRingId}
              />
            </section>

            {result.suspicious_accounts.length > 0 && (
              <section>
                <h3 className="text-lg font-bold text-foreground mb-3">Top Suspicious Accounts</h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Account ID</th>
                          <th className="text-center px-4 py-2 text-xs font-semibold text-muted-foreground">Score</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Patterns</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Ring</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.suspicious_accounts.slice(0, 20).map(a => (
                          <tr key={a.account_id} className="border-t border-border hover:bg-muted/10">
                            <td className="px-4 py-2 font-mono text-xs">{a.account_id}</td>
                            <td className="text-center px-4 py-2">
                              <span className={`font-bold text-xs ${a.suspicion_score >= 70 ? 'text-suspicious' : a.suspicion_score >= 40 ? 'text-warning' : 'text-foreground'}`}>
                                {a.suspicion_score}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-1">
                                {a.detected_patterns.map(p => (
                                  <span key={p} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{p}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-primary">{a.ring_id}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
