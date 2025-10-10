import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({ 
  size = 'md', 
  text = 'Carregando...',
  className 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className={cn('flex flex-col items-center justify-center space-y-4', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
};

export const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('flex items-center justify-center p-8', className)}>
    <Loading size="lg" />
  </div>
);

export const LoadingPage: React.FC<{ text?: string }> = ({ text }) => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loading size="lg" text={text} />
  </div>
); 