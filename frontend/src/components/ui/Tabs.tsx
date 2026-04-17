import React, { useState } from 'react';

export interface TabItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  defaultActiveKey,
  onChange,
  className,
}) => {
  const [internal, setInternal] = useState(defaultActiveKey ?? items[0]?.key ?? '');
  const current = activeKey ?? internal;

  const handleClick = (k: string) => {
    if (activeKey === undefined) setInternal(k);
    onChange?.(k);
  };

  const active = items.find((i) => i.key === current);

  return (
    <div className={className}>
      <div className="smc-tabs__bar" role="tablist">
        {items.map((it) => (
          <button
            key={it.key}
            role="tab"
            aria-selected={it.key === current}
            disabled={it.disabled}
            className={['smc-tab', it.key === current && 'smc-tab--active'].filter(Boolean).join(' ')}
            onClick={() => handleClick(it.key)}
            type="button"
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
      {active?.children !== undefined && <div key={current} className="smc-tabs__panel">{active.children}</div>}
    </div>
  );
};

export default Tabs;
