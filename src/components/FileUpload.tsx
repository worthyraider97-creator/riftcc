import { useCallback, useRef, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isProcessing: boolean;
}

const FileUpload = ({ onFileUpload, isProcessing }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file.name.endsWith('.csv') || file.type === 'text/csv') {
      onFileUpload(file);
    }
  }, [onFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-xl p-16 text-center transition-all duration-300 cursor-pointer group',
        isDragging ? 'border-primary bg-primary/5 glow-primary' : 'border-border hover:border-primary/50 hover:bg-card/50',
        isProcessing && 'pointer-events-none opacity-60'
      )}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
          isDragging ? 'bg-primary/20' : 'bg-muted group-hover:bg-primary/10'
        )}>
          {isProcessing ? (
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-primary" />
          )}
        </div>

        <div>
          <p className="text-lg font-semibold text-foreground mb-1">
            {isProcessing ? 'Analyzing transactions...' : 'Upload Transaction CSV'}
          </p>
          <p className="text-sm text-muted-foreground">
            Drag & drop or click to browse
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
          <FileText className="w-3.5 h-3.5" />
          <span>Required: transaction_id, sender_id, receiver_id, amount, timestamp</span>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
