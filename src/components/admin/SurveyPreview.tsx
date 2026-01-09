import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Competency {
  id: string;
  name: string;
  definition: string;
  observable_behaviors: string;
  display_order: number;
  is_active: boolean;
}

interface SurveyPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SurveyPreview({ open, onOpenChange }: SurveyPreviewProps) {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      fetchCompetencies();
    }
  }, [open]);

  const fetchCompetencies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pep_competencies")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (!error && data) {
      setCompetencies(data as Competency[]);
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center justify-between">
            <span>Survey Preview (Blank Form)</span>
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print Survey
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="space-y-6 p-4 print:p-0">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h1 className="text-2xl font-bold text-foreground">BUNTING MAGNETICS</h1>
            <h2 className="text-xl font-semibold text-muted-foreground mt-2">
              Performance Self-Evaluation Form
            </h2>
            <p className="text-sm text-muted-foreground mt-1">(Blank Preview for Review)</p>
          </div>

          {/* Section A: Employee Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Section A: Employee Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Employee Name:</label>
                  <div className="border-b border-dashed border-muted-foreground h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Job Title:</label>
                  <div className="border-b border-dashed border-muted-foreground h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Department:</label>
                  <div className="border-b border-dashed border-muted-foreground h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Hire Date:</label>
                  <div className="border-b border-dashed border-muted-foreground h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Supervisor:</label>
                  <div className="border-b border-dashed border-muted-foreground h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Evaluation Period:</label>
                  <div className="border-b border-dashed border-muted-foreground h-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section II: Performance Competencies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Section III: Performance Competencies Evaluation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Rate yourself on each competency using a 1-5 scale (1 = Needs Improvement, 5 = Exceptional)
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading competencies...</p>
              ) : (
                <div className="space-y-6">
                  {competencies.map((competency, index) => (
                    <div key={competency.id} className="border rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-primary">{index + 1}.</span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{competency.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            <strong>Definition:</strong> {competency.definition}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            <strong>Observable Behaviors:</strong> {competency.observable_behaviors}
                          </p>
                          
                          <div className="mt-4 flex items-center gap-4">
                            <span className="text-sm font-medium">Rating:</span>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map((num) => (
                                <div
                                  key={num}
                                  className="w-8 h-8 border rounded flex items-center justify-center text-sm"
                                >
                                  {num}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <span className="text-sm font-medium">Comments:</span>
                            <div className="border border-dashed border-muted-foreground h-16 mt-1 rounded" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section IV: Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Section IV: Employee Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Employee Summary (Key accomplishments and contributions this year):
                </label>
                <div className="border border-dashed border-muted-foreground h-32 rounded" />
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Overall Self-Evaluation Rating:</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <div
                      key={num}
                      className="w-8 h-8 border rounded flex items-center justify-center text-sm"
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Employee Signature:</label>
                  <div className="border-b border-muted-foreground h-8" />
                  <label className="text-sm font-medium">Date:</label>
                  <div className="border-b border-muted-foreground h-8 w-32" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Supervisor Signature:</label>
                  <div className="border-b border-muted-foreground h-8" />
                  <label className="text-sm font-medium">Date:</label>
                  <div className="border-b border-muted-foreground h-8 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
