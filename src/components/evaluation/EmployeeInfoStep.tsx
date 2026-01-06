import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EvaluationData } from '@/types/evaluation';
import { User, Briefcase, Building2, Calendar, Users } from 'lucide-react';

interface EmployeeInfoStepProps {
  data: EvaluationData['employeeInfo'];
  onUpdate: (updates: Partial<EvaluationData['employeeInfo']>) => void;
  isReadOnly?: boolean;
}

export const EmployeeInfoStep = ({ data, onUpdate, isReadOnly = false }: EmployeeInfoStepProps) => {
  return (
    <div className="form-section animate-slide-up">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
          Employee Information
        </h2>
        <p className="text-muted-foreground">
          Verify and update your information. Changes will sync to your employee record.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name" className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Employee Name
          </Label>
          <Input
            id="name"
            value={data.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Enter your full name"
            className="h-12"
            disabled={isReadOnly}
          />
          <p className="text-xs text-muted-foreground">
            Updates your employee record
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            Job Title
          </Label>
          <Input
            id="title"
            value={data.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Enter your job title"
            className="h-12"
            disabled={isReadOnly}
          />
          <p className="text-xs text-muted-foreground">
            Updates your employee record
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="department" className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Department
          </Label>
          <Input
            id="department"
            value={data.department}
            onChange={(e) => onUpdate({ department: e.target.value })}
            placeholder="Enter your department"
            className="h-12"
            disabled={isReadOnly}
          />
          <p className="text-xs text-muted-foreground">
            Updates your employee record
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supervisor" className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Direct Supervisor/Manager
          </Label>
          <Input
            id="supervisor"
            value={data.supervisorName || ''}
            placeholder="Supervisor name"
            className="h-12 bg-muted/50"
            disabled
            readOnly
          />
          <p className="text-xs text-muted-foreground">
            Auto-populated from employee records
          </p>
        </div>

        <div className="space-y-2 md:col-span-2 md:max-w-[calc(50%-12px)]">
          <Label htmlFor="periodYear" className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Evaluation Period
          </Label>
          <Input
            id="periodYear"
            type="number"
            value={data.periodYear}
            onChange={(e) => onUpdate({ periodYear: parseInt(e.target.value) || new Date().getFullYear() })}
            placeholder="Year"
            min={2020}
            max={2030}
            className="h-12"
            disabled={isReadOnly}
          />
          <p className="text-xs text-muted-foreground">
            January 1 – December 31, {data.periodYear}
          </p>
        </div>
      </div>
    </div>
  );
};
