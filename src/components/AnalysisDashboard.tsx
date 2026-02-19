import { AnalysisResult } from '@/lib/types';
import { Download, Shield, AlertTriangle, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  result: AnalysisResult;
}

const AnalysisDashboard = ({ result }: Props) => {
  const { summary } = result;

  const handleDownload = () => {
    const output = {
      suspicious_accounts: result.suspicious_accounts,
      fraud_rings: result.fraud_rings,
      summary: result.summary,
    };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'forensics_report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    { icon: Users, label: 'Accounts Analyzed', value: summary.total_accounts_analyzed, color: 'text-primary' },
    { icon: AlertTriangle, label: 'Suspicious Flagged', value: summary.suspicious_accounts_flagged, color: 'text-suspicious' },
    { icon: Shield, label: 'Fraud Rings', value: summary.fraud_rings_detected, color: 'text-warning' },
    { icon: Clock, label: 'Processing Time', value: `${summary.processing_time_seconds}s`, color: 'text-safe' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <Button onClick={handleDownload} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        <Download className="w-4 h-4 mr-2" />
        Download JSON Report
      </Button>
    </div>
  );
};

export default AnalysisDashboard;
