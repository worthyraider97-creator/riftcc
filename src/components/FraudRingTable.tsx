import { FraudRing } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Props {
  rings: FraudRing[];
  selectedRingId: string | null;
  onSelectRing: (ringId: string | null) => void;
}

const patternLabel: Record<string, string> = {
  cycle: 'Circular Routing',
  fan_in: 'Fan-In (Smurfing)',
  fan_out: 'Fan-Out (Smurfing)',
  shell_network: 'Shell Network',
};

const FraudRingTable = ({ rings, selectedRingId, onSelectRing }: Props) => {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="text-xs font-semibold text-muted-foreground">Ring ID</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Pattern Type</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-center">Members</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-center">Risk Score</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Member Account IDs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rings.map((ring) => (
            <TableRow
              key={ring.ring_id}
              className={`cursor-pointer transition-colors ${selectedRingId === ring.ring_id ? 'bg-primary/10' : 'hover:bg-muted/20'}`}
              onClick={() => onSelectRing(selectedRingId === ring.ring_id ? null : ring.ring_id)}
            >
              <TableCell className="font-mono text-sm text-primary">{ring.ring_id}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs border-border text-foreground">
                  {patternLabel[ring.pattern_type] || ring.pattern_type}
                </Badge>
              </TableCell>
              <TableCell className="text-center font-semibold">{ring.member_accounts.length}</TableCell>
              <TableCell className="text-center">
                <span className={`font-bold ${ring.risk_score >= 80 ? 'text-suspicious' : ring.risk_score >= 60 ? 'text-warning' : 'text-foreground'}`}>
                  {ring.risk_score.toFixed(1)}
                </span>
              </TableCell>
              <TableCell className="max-w-[300px]">
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {ring.member_accounts.join(', ')}
                </p>
              </TableCell>
            </TableRow>
          ))}
          {rings.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No fraud rings detected</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default FraudRingTable;
