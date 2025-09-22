import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle, Edit3 } from 'lucide-react';

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  isCollapsible?: boolean;
  defaultCollapsed?: boolean;
  isRequired?: boolean;
  hasErrors?: boolean;
  errorCount?: number;
  completedFields?: number;
  totalFields?: number;
  className?: string;
  onEdit?: () => void;
  isEditing?: boolean;
}

export function FormSection({
  title,
  description,
  children,
  icon,
  isCollapsible = false,
  defaultCollapsed = false,
  isRequired = false,
  hasErrors = false,
  errorCount = 0,
  completedFields,
  totalFields,
  className = '',
  onEdit,
  isEditing: _isEditing = false,
}: FormSectionProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const toggleCollapsed = () => {
    if (isCollapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  // Calculate completion percentage
  const completionPercentage = React.useMemo(() => {
    if (typeof completedFields === 'number' && typeof totalFields === 'number' && totalFields > 0) {
      return Math.round((completedFields / totalFields) * 100);
    }
    return undefined;
  }, [completedFields, totalFields]);

  // Determine status badge
  const statusBadge = React.useMemo(() => {
    if (hasErrors) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {errorCount > 0 ? `${errorCount} error${errorCount !== 1 ? 's' : ''}` : 'Error'}
        </Badge>
      );
    }

    if (completionPercentage === 100) {
      return (
        <Badge variant="default" className="bg-green-600 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Complete
        </Badge>
      );
    }

    if (completionPercentage !== undefined) {
      return (
        <Badge variant="secondary">
          {completionPercentage}% complete
        </Badge>
      );
    }

    if (isRequired) {
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-600">
          Required
        </Badge>
      );
    }

    return null;
  }, [hasErrors, errorCount, completionPercentage, isRequired]);

  return (
    <Card className={`${className} ${hasErrors ? 'border-red-200' : ''}`}>
      <CardHeader
        className={`${isCollapsible ? 'cursor-pointer' : ''} ${isCollapsed ? 'pb-6' : ''}`}
        onClick={toggleCollapsed}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isCollapsible && (
              <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            )}

            {icon && <div className="text-muted-foreground">{icon}</div>}

            <div>
              <CardTitle className="flex items-center gap-2">
                {title}
                {isRequired && <span className="text-red-500">*</span>}
              </CardTitle>
              {description && (
                <CardDescription className="mt-1">{description}</CardDescription>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {statusBadge}

            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1 h-8 w-8"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar for completion */}
        {completionPercentage !== undefined && completionPercentage < 100 && !isCollapsed && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{completedFields}/{totalFields} fields</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  hasErrors
                    ? 'bg-red-500'
                    : completionPercentage >= 75
                    ? 'bg-green-500'
                    : completionPercentage >= 50
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>

      {!isCollapsed && <CardContent>{children}</CardContent>}
    </Card>
  );
}

// Specialized section for form fields with automatic field counting
interface FieldSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  isRequired?: boolean;
  className?: string;
}

export function FieldSection({
  title,
  description,
  children,
  icon,
  isRequired = false,
  className = '',
}: FieldSectionProps) {
  const [fieldStats, setFieldStats] = React.useState<{
    total: number;
    completed: number;
    errors: number;
  }>({ total: 0, completed: 0, errors: 0 });

  // Analyze form fields in children to get statistics
  React.useEffect(() => {
    const element = document.querySelector(`[data-section="${title}"]`);
    if (element) {
      const inputs = element.querySelectorAll('input, select, textarea');
      const total = inputs.length;
      let completed = 0;
      let errors = 0;

      inputs.forEach((input) => {
        const inputElement = input as HTMLInputElement;

        // Check if field has value
        if (inputElement.value && inputElement.value.trim() !== '') {
          completed++;
        }

        // Check if field has error (aria-invalid or error class)
        if (inputElement.getAttribute('aria-invalid') === 'true' ||
            inputElement.classList.contains('border-red-500')) {
          errors++;
        }
      });

      setFieldStats({ total, completed, errors });
    }
  }, [children, title]);

  return (
    <div data-section={title}>
      <FormSection
        title={title}
        description={description}
        icon={icon}
        isRequired={isRequired}
        hasErrors={fieldStats.errors > 0}
        errorCount={fieldStats.errors}
        completedFields={fieldStats.completed}
        totalFields={fieldStats.total}
        className={className}
      >
        {children}
      </FormSection>
    </div>
  );
}

// Collapsible section for optional or advanced fields
interface CollapsibleSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
}

export function CollapsibleSection({
  title,
  description,
  children,
  defaultCollapsed = true,
  className = '',
}: CollapsibleSectionProps) {
  return (
    <FormSection
      title={title}
      description={description}
      isCollapsible={true}
      defaultCollapsed={defaultCollapsed}
      className={className}
    >
      {children}
    </FormSection>
  );
}

// Summary section showing overall form completion
interface FormSummaryProps {
  sections: Array<{
    name: string;
    completed: number;
    total: number;
    errors: number;
    required: boolean;
  }>;
  className?: string;
}

export function FormSummary({ sections, className = '' }: FormSummaryProps) {
  const totalStats = React.useMemo(() => {
    return sections.reduce(
      (acc, section) => ({
        completed: acc.completed + section.completed,
        total: acc.total + section.total,
        errors: acc.errors + section.errors,
        requiredSections: acc.requiredSections + (section.required ? 1 : 0),
        completedRequiredSections: acc.completedRequiredSections +
          (section.required && section.completed === section.total ? 1 : 0),
      }),
      { completed: 0, total: 0, errors: 0, requiredSections: 0, completedRequiredSections: 0 }
    );
  }, [sections]);

  const overallPercentage = totalStats.total > 0
    ? Math.round((totalStats.completed / totalStats.total) * 100)
    : 0;

  const canSubmit = totalStats.errors === 0 &&
    totalStats.completedRequiredSections === totalStats.requiredSections;

  return (
    <Card className={`${className} border-primary/20 bg-primary/5`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Form Summary</span>
          <Badge
            variant={canSubmit ? "default" : "secondary"}
            className={canSubmit ? "bg-green-600" : ""}
          >
            {overallPercentage}% Complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-lg">{totalStats.completed}</div>
              <div className="text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-lg">{totalStats.total}</div>
              <div className="text-muted-foreground">Total Fields</div>
            </div>
            <div className="text-center">
              <div className={`font-medium text-lg ${totalStats.errors > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {totalStats.errors}
              </div>
              <div className="text-muted-foreground">Errors</div>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                canSubmit
                  ? 'bg-green-500'
                  : totalStats.errors > 0
                  ? 'bg-red-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${overallPercentage}%` }}
            />
          </div>

          <div className="text-xs text-muted-foreground text-center">
            {canSubmit
              ? 'Ready for confirmation'
              : `${totalStats.requiredSections - totalStats.completedRequiredSections} required sections remaining`
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
}