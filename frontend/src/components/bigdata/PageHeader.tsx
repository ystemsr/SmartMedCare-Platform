import React, { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    }}
  >
    <div style={{ minWidth: 0 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--smc-fs-2xl)',
          fontWeight: 700,
          letterSpacing: 0.2,
          color: 'var(--smc-text)',
        }}
      >
        {title}
      </h2>
      {description && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 'var(--smc-fs-sm)',
            color: 'var(--smc-text-2)',
          }}
        >
          {description}
        </p>
      )}
    </div>
    {actions && <div>{actions}</div>}
  </div>
);

export default PageHeader;
