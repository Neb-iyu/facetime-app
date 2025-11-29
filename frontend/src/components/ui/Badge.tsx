// components/ui/Badge.tsx
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  title
}) => {
  const baseClasses = 'badge';
  
  const variantClasses = {
    default: 'badge-default',
    secondary: 'badge-secondary',
    destructive: 'badge-destructive',
    outline: 'badge-outline',
    success: 'badge-success',
    warning: 'badge-warning'
  };

  const sizeClasses = {
    sm: 'badge-sm',
    md: 'badge-md',
    lg: 'badge-lg'
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <span className={classes} title={title}>
      {children}
    </span>
  );
};

// Specialized badge components
export const StatusBadge: React.FC<{
  status: 'online' | 'away' | 'busy' | 'offline' | 'in-call';
  showLabel?: boolean;
}> = ({ status, showLabel = false }) => {
  const statusConfig = {
    online: { variant: 'success' as const, label: 'Online', icon: '🟢' },
    away: { variant: 'warning' as const, label: 'Away', icon: '🟡' },
    busy: { variant: 'destructive' as const, label: 'Busy', icon: '🔴' },
    offline: { variant: 'outline' as const, label: 'Offline', icon: '⚫' },
    'in-call': { variant: 'secondary' as const, label: 'In Call', icon: '📞' }
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size="sm">
      <span className="badge-content">
        <span className="badge-icon">{config.icon}</span>
        {showLabel && <span className="badge-label">{config.label}</span>}
      </span>
    </Badge>
  );
};

export const ConnectionQualityBadge: React.FC<{
  quality: 'excellent' | 'good' | 'poor' | 'disconnected';
}> = ({ quality }) => {
  const qualityConfig = {
    excellent: { variant: 'success' as const, label: 'Excellent', icon: '📶' },
    good: { variant: 'success' as const, label: 'Good', icon: '📶' },
    poor: { variant: 'warning' as const, label: 'Poor', icon: '📶' },
    disconnected: { variant: 'destructive' as const, label: 'Disconnected', icon: '❌' }
  };

  const config = qualityConfig[quality];

  return (
    <Badge variant={config.variant} size="sm">
      <span className="badge-content">
        <span className="badge-icon">{config.icon}</span>
        <span className="badge-label">{config.label}</span>
      </span>
    </Badge>
  );
};

export const ParticipantCountBadge: React.FC<{
  count: number;
  max?: number;
}> = ({ count, max }) => {
  return (
    <Badge variant="secondary" size="sm">
      👥 {count}{max ? `/${max}` : ''}
    </Badge>
  );
};