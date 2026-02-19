import Papa from 'papaparse';
import { Transaction } from './types';

interface RawRow {
  transaction_id: string;
  sender_id: string;
  receiver_id: string;
  amount: string;
  timestamp: string;
}

export function parseCSV(file: File): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions: Transaction[] = results.data
            .filter(row => row.transaction_id && row.sender_id && row.receiver_id && row.amount && row.timestamp)
            .map(row => ({
              transaction_id: row.transaction_id.trim(),
              sender_id: row.sender_id.trim(),
              receiver_id: row.receiver_id.trim(),
              amount: parseFloat(row.amount),
              timestamp: new Date(row.timestamp.trim()),
            }));
          resolve(transactions);
        } catch (err) {
          reject(new Error('Failed to parse CSV data'));
        }
      },
      error: (err) => reject(new Error(err.message)),
    });
  });
}
