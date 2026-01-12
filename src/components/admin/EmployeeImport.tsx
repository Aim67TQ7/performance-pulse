import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseCSV, ParsedEmployee, ParseResult } from '@/lib/csvParser';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EmployeeImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  linked: number;
  errors: { row: number; error: string }[];
}

type ImportState = 'idle' | 'parsed' | 'importing' | 'complete';

export const EmployeeImport = ({ open, onOpenChange, onImportComplete }: EmployeeImportProps) => {
  const [state, setState] = useState<ImportState>('idle');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [progress, setProgress] = useState(0);

  const handleClose = () => {
    if (state !== 'importing') {
      setState('idle');
      setParseResult(null);
      setImportResult(null);
      setFileName('');
      setProgress(0);
      onOpenChange(false);
    }
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a CSV file.',
        variant: 'destructive',
      });
      return;
    }

    setFileName(file.name);

    try {
      const text = await file.text();
      const result = parseCSV(text);
      setParseResult(result);
      setState('parsed');
    } catch (error) {
      toast({
        title: 'Parse error',
        description: 'Failed to parse CSV file.',
        variant: 'destructive',
      });
    }

    // Reset input
    e.target.value = '';
  }, []);

  const handleImport = async () => {
    if (!parseResult?.employees.length) return;

    setState('importing');
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call edge function
      const response = await fetch(
        `https://qzwxisdfwswsrbzvpzlo.supabase.co/functions/v1/import-employees`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ employees: parseResult.employees }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const result: ImportResult = await response.json();
      setImportResult(result);
      setState('complete');
      setProgress(100);

      if (result.success) {
        toast({
          title: 'Import complete',
          description: `${result.inserted} added, ${result.updated} updated, ${result.linked} linked to users.`,
        });
      } else {
        toast({
          title: 'Import completed with errors',
          description: `${result.errors.length} records failed. Check the results for details.`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message || 'An error occurred during import.',
        variant: 'destructive',
      });
      setState('parsed');
    }
  };

  const handleFinish = () => {
    onImportComplete();
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import Employees from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import or update employee records.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {state === 'idle' && (
            <div className="py-8">
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">CSV files only</p>
                </div>
                <Input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>

              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Expected columns:</strong> name_first, name_last, job_title, department, location, 
                  badge_number, user_email, employee_number, hire_date, benefit_class, job_level.
                  Column headers are matched flexibly (e.g., "First Name" → name_first).
                </AlertDescription>
              </Alert>
            </div>
          )}

          {state === 'parsed' && parseResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="font-medium">{fileName}</span>
                  <Badge variant="secondary">{parseResult.employees.length} records</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setState('idle')}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {parseResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {parseResult.errors.length} rows have errors and will be skipped.
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground">
                Detected columns: {parseResult.headers.join(', ')}
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.employees.slice(0, 50).map((emp, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{emp.name_first} {emp.name_last}</TableCell>
                        <TableCell className="text-sm">{emp.user_email || '—'}</TableCell>
                        <TableCell className="text-sm">{emp.department || '—'}</TableCell>
                        <TableCell className="text-sm">{emp.location || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parseResult.employees.length > 50 && (
                  <div className="p-3 text-center text-sm text-muted-foreground border-t">
                    ... and {parseResult.employees.length - 50} more records
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {state === 'importing' && (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-lg font-medium">Importing employees...</p>
              <Progress value={progress} className="w-64" />
              <p className="text-sm text-muted-foreground">
                Processing {parseResult?.employees.length || 0} records
              </p>
            </div>
          )}

          {state === 'complete' && importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 py-4">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Import Complete</h3>
                  <p className="text-muted-foreground">
                    Successfully processed employee records.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold text-green-600">{importResult.inserted}</p>
                  <p className="text-sm text-muted-foreground">New Employees</p>
                </div>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                  <p className="text-sm text-muted-foreground">Updated</p>
                </div>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-2xl font-bold text-purple-600">{importResult.linked}</p>
                  <p className="text-sm text-muted-foreground">Linked to Users</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">{importResult.errors.length} records failed:</p>
                    <ScrollArea className="h-[100px]">
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {importResult.errors.slice(0, 10).map((err, idx) => (
                          <li key={idx}>Row {err.row}: {err.error}</li>
                        ))}
                        {importResult.errors.length > 10 && (
                          <li>... and {importResult.errors.length - 10} more errors</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          {state === 'idle' && (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          )}
          
          {state === 'parsed' && (
            <>
              <Button variant="outline" onClick={() => setState('idle')}>
                Choose Different File
              </Button>
              <Button onClick={handleImport} disabled={!parseResult?.employees.length}>
                <Users className="w-4 h-4 mr-2" />
                Import {parseResult?.employees.length} Employees
              </Button>
            </>
          )}
          
          {state === 'complete' && (
            <Button onClick={handleFinish}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
