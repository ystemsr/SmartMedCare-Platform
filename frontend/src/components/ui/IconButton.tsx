import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md';
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', className, type = 'button', ...rest },
  ref,
) {
  const classes = ['smc-iconbtn', size === 'sm' && 'smc-iconbtn--sm', className || '']
    .filter(Boolean)
    .join(' ');
  return <button ref={ref} type={type} className={classes} {...rest} />;
});

export default IconButton;
