// components/ui/Loader.tsx
import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots' | 'pulse' | 'bars';
  color?: 'primary' | 'white' | 'muted';
  text?: string;
  overlay?: boolean;
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  variant = 'spinner',
  color = 'primary',
  text,
  overlay = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'loader-sm',
    md: 'loader-md',
    lg: 'loader-lg',
    xl: 'loader-xl'
  };

  const colorClasses = {
    primary: 'loader-primary',
    white: 'loader-white',
    muted: 'loader-muted'
  };

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className={`dots-loader ${sizeClasses[size]} ${colorClasses[color]}`}>
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        );
      
      case 'pulse':
        return (
          <div className={`pulse-loader ${sizeClasses[size]} ${colorClasses[color]}`}></div>
        );
      
      case 'bars':
        return (
          <div className={`bars-loader ${sizeClasses[size]} ${colorClasses[color]}`}>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
          </div>
        );
      
      case 'spinner':
      default:
        return (
          <div className={`spinner-loader ${sizeClasses[size]} ${colorClasses[color]}`}>
            <div className="spinner"></div>
          </div>
        );
    }
  };

  if (overlay) {
    return (
      <div className={`loader-overlay ${className}`}>
        <div className="loader-content">
          {renderLoader()}
          {text && <p className="loader-text">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`loader-wrapper ${className}`}>
      {renderLoader()}
      {text && <p className="loader-text">{text}</p>}
    </div>
  );
};

// Specialized Loader Components
export const PageLoader: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => {
  return (
    <div className="page-loader">
      <Loader size="xl" variant="spinner" text={text} />
    </div>
  );
};

export const ButtonLoader: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  return (
    <Loader 
      size={size} 
      variant="spinner" 
      color="white" 
      className="button-loader" 
    />
  );
};

export const VideoLoader: React.FC = () => {
  return (
    <div className="video-loader">
      <Loader variant="pulse" color="white" text="Connecting..." />
    </div>
  );
};

export const CallConnectingLoader: React.FC = () => {
  return (
    <div className="call-connecting-loader">
      <Loader size="lg" variant="dots" text="Connecting to call..." />
    </div>
  );
};