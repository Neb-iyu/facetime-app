// components/ui/Avatar.tsx
import React from 'react';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ 
  name, 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
    xl: 'avatar-xl',
    xxl: 'avatar-xxl'
  };

  const classes = `avatar ${sizeClasses[size]} ${className}`;
  const initials = name.charAt(0).toUpperCase();

  return (
    <div className={classes}>
      <span className="avatar-initials">{initials}</span>
    </div>
  );
};